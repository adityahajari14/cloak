import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { LIMITS, clientIp, hit } from "@/lib/rate-limit";

/**
 * Which rate-limit bucket, if any, a request falls into.
 *
 * The ticket routes are the ones that matter: a pass can be opened with a short
 * public code, so an unthrottled endpoint lets someone walk the keyspace and
 * harvest guest records. Everything else here is spam protection.
 */
function bucketFor(pathname: string, method: string): keyof typeof LIMITS | null {
  if (pathname === "/ticket" || pathname.startsWith("/api/wallet")) return "ticketLookup";
  if (pathname === "/venuescanner") return "scanner";

  if (method === "POST") {
    if (
      pathname === "/customer-signup" ||
      pathname === "/checkin" ||
      pathname === "/cloak-club" ||
      pathname === "/book-a-demo" ||
      pathname === "/contact-us" ||
      pathname.startsWith("/venuesignup")
    ) {
      return "publicWrite";
    }
  }

  return null;
}

export async function proxy(request: NextRequest) {
  const bucket = bucketFor(request.nextUrl.pathname, request.method);
  if (bucket) {
    const [limit, windowMs] = LIMITS[bucket];
    const result = hit(`${bucket}:${clientIp(request.headers)}`, limit, windowMs);

    if (!result.allowed) {
      return new NextResponse("Too many requests. Please slow down and try again shortly.", {
        status: 429,
        headers: {
          "Retry-After": String(result.retryAfterSeconds),
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }
  }

  const env = getSupabaseEnv();
  let response = NextResponse.next({ request });

  if (!env.url || !env.key) {
    return response;
  }

  const supabase = createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  try {
    await supabase.auth.getUser();
  } catch {
    // Network unreachable — proceed without refreshing the session token.
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
