import "server-only";

/**
 * Fixed-window rate limiter, held in process memory.
 *
 * The thing this exists to stop: a ticket's public code is short and its date
 * prefix is public, so without a limiter an attacker can walk the keyspace and
 * pull out real guest records. Rate limiting is what makes that walk take
 * centuries instead of an afternoon.
 *
 * Caveat worth knowing: state is per-process. On a single instance that's
 * exact. Across N instances each keeps its own window, so the effective limit
 * is N x the configured one — still a very large reduction in enumeration
 * speed, but not a hard cap. If this ever runs behind a real autoscaler, swap
 * `hit()` for a Redis/Upstash INCR with the same signature and nothing else
 * needs to change.
 */

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

// Bound the map so a flood of unique IPs can't grow it without limit.
const MAX_TRACKED_KEYS = 20_000;

function sweep(now: number) {
  if (windows.size < MAX_TRACKED_KEYS) return;
  for (const [key, w] of windows) {
    if (w.resetAt <= now) windows.delete(key);
  }
  // Still full of live windows — drop the oldest rather than grow forever.
  if (windows.size >= MAX_TRACKED_KEYS) {
    const oldest = [...windows.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    for (let i = 0; i < Math.floor(MAX_TRACKED_KEYS / 4); i++) {
      windows.delete(oldest[i][0]);
    }
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Record one request against `key`. Returns whether it may proceed.
 *
 * @param key    Identity to limit on — typically `${bucket}:${ip}`.
 * @param limit  Requests permitted per window.
 * @param windowMs Window length in milliseconds.
 */
export function hit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;

  if (existing.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(Math.ceil((existing.resetAt - now) / 1000), 1),
    };
  }

  return { allowed: true, remaining: limit - existing.count, retryAfterSeconds: 0 };
}

/**
 * Best-effort client IP.
 *
 * Trusts the proxy headers the host sets (Vercel/Cloudflare/nginx all populate
 * these). A client can forge x-forwarded-for when the app is exposed directly,
 * which would let them dodge the limit by rotating the header — so this must
 * sit behind a proxy that overwrites it, which is the case for any normal
 * deployment.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? headers.get("cf-connecting-ip") ?? "unknown";
}

/** Limits per bucket: [requests, window ms]. */
export const LIMITS = {
  // The enumeration target. A guest opens their own pass a handful of times;
  // nobody legitimately needs 20 lookups a minute.
  ticketLookup: [20, 60_000],
  // Public write endpoints — signup, demo requests, contact forms. Generous
  // enough for a real person retrying a validation error, tight enough that
  // the form isn't a spam relay.
  publicWrite: [10, 60_000],
  // Staff scanning at a counter is genuinely rapid, so this is loose; it exists
  // to catch a runaway loop, not to police normal use.
  scanner: [120, 60_000],
} as const satisfies Record<string, readonly [number, number]>;
