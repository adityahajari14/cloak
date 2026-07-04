"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

// Map Supabase raw error messages to user-friendly ones
function friendlyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials") || m.includes("email not confirmed")) {
    return "Incorrect email or password.";
  }
  if (m.includes("already registered") || m.includes("user already exists")) {
    return "An account with this email already exists. Sign in instead.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (m.includes("network") || m.includes("fetch")) {
    return "Connection error. Please check your internet and try again.";
  }
  return "Something went wrong. Please try again.";
}

// Build a clean OAuth redirectTo URL — strips auth params so we never loop
function buildRedirectTo(): string {
  const params = new URLSearchParams(window.location.search);
  // Preserve a legitimate ?next= but strip ?signin=1
  const next = params.get("next");
  params.delete("signin");
  params.delete("next");
  const remainingSearch = params.toString();
  const cleanPath = window.location.pathname + (remainingSearch ? `?${remainingSearch}` : "");
  // Pass next separately so callback can resolve role-based destination
  const callbackParams = new URLSearchParams();
  callbackParams.set("next", next ?? cleanPath);
  return `${window.location.origin}/auth/callback?${callbackParams.toString()}`;
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 814 1000">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.3-150.3-96.8C67.3 716.9 24 599 24 481.3c0-170.7 111.4-261.1 221-261.1 75.8 0 138.3 43.4 186.9 43.4 46.3 0 118.5-48.8 208.3-48.8 31.5 0 134.4 2.6 204.4 99.4zm-340.2-168c31.5-37.1 54.2-88.8 54.2-140.5 0-7.1-.6-14.3-1.9-20.1-51.5 1.9-112.3 34.2-149.1 75.8-28.5 32.4-55.1 83.5-55.1 135.8 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 46.3 0 102.9-31.1 136.4-70.4z" />
    </svg>
  );
}

export default function AuthModal({
  open,
  onClose,
  defaultMode = "signin",
}: {
  open: boolean;
  onClose: () => void;
  defaultMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);
  const [isPending, startTransition] = useTransition();
  const emailRef = useRef<HTMLInputElement>(null);

  // Sync mode when defaultMode prop changes (e.g. opened as signup)
  useEffect(() => {
    if (open) {
      setMode(defaultMode);
      setEmail("");
      setPassword("");
      setName("");
      setError(null);
      setOauthLoading(null);
      // Focus email field after short delay for animation
      setTimeout(() => emailRef.current?.focus(), 50);
    }
  }, [open, defaultMode]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const supabase = createClient();
  const isLoading = isPending || oauthLoading !== null;

  async function handleOAuth(provider: "google" | "apple") {
    setError(null);
    setOauthLoading(provider);
    const redirectTo = buildRedirectTo();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    if (error) {
      setError(friendlyError(error.message));
      setOauthLoading(null);
    }
    // On success the browser navigates away — no cleanup needed
  }

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: buildRedirectTo(),
          },
        });
        if (error) { setError(friendlyError(error.message)); return; }
        setError("__confirm__");
        return;
      }

      const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !signInData.user) {
        setError(friendlyError(error?.message ?? ""));
        return;
      }

      onClose();

      // Pass the access token so the server can resolve the role without needing
      // a cookie (the cookie hasn't been written to the browser yet at this point)
      const accessToken = signInData.session?.access_token;
      const params = new URLSearchParams(window.location.search);
      const explicitNext = params.get("next");

      let destination = "/";
      if (accessToken) {
        const res = await fetch("/api/auth/role", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const json = await res.json() as { destination: string };
        destination = json.destination;
      }

      // For customers (destination "/"), honour an explicit ?next= if present
      const finalDestination = (destination === "/" && explicitNext && explicitNext.startsWith("/"))
        ? explicitNext
        : destination;

      // A hard navigation, not router.push — the destination (e.g. /venuedashboard)
      // is server-rendered and checks the session via cookies. The Supabase
      // browser client writes the session cookie asynchronously after
      // signInWithPassword resolves, so an immediate router.push can reach the
      // server before that cookie write lands, making the guard see no user
      // and bounce back to the sign-in page. A full page load always carries
      // whatever cookie is in the browser's jar at request time, closing the gap.
      window.location.href = finalDestination;
    });
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setTimeout(() => emailRef.current?.focus(), 50);
  }

  const isConfirm = error === "__confirm__";

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-label={mode === "signin" ? "Sign in" : "Create account"}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-sm rounded-t-2xl bg-panel shadow-2xl sm:rounded-2xl">
        {/* Close button */}
        <button
          aria-label="Close"
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-zinc-100 hover:text-foreground"
          onClick={onClose}
          type="button"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>

        <div className="p-6">
          {/* Header */}
          <div className="mb-5">
            <img alt="Cloak" className="mb-3 h-9 w-auto" src="/images/cloak-logo.png" />
            <h2 className="text-lg font-semibold text-foreground">
              {mode === "signin" ? "Welcome back" : "Create account"}
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              {mode === "signin"
                ? "Sign in to manage your cloakroom tickets."
                : "Create an account to manage your cloakroom tickets."}
            </p>
          </div>

          {isConfirm ? (
            /* Email confirmation state */
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-800">Check your email</p>
              <p className="mt-1 text-sm text-emerald-700">
                We sent a link to <strong>{email}</strong>. Click it to activate your account, then sign in.
              </p>
              <button
                className="mt-3 text-xs font-medium text-emerald-700 underline underline-offset-2"
                onClick={() => { setError(null); setMode("signin"); }}
                type="button"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              {/* OAuth */}
              <div className="grid gap-2.5">
                <button
                  className="relative flex items-center justify-center gap-3 rounded-xl border border-line bg-white px-4 py-3 text-sm font-medium text-foreground transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isLoading}
                  onClick={() => handleOAuth("google")}
                  type="button"
                >
                  {oauthLoading === "google"
                    ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-foreground/30 border-t-foreground" />
                    : <GoogleIcon />}
                  Continue with Google
                </button>
                <button
                  className="relative flex items-center justify-center gap-3 rounded-xl bg-black px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isLoading}
                  onClick={() => handleOAuth("apple")}
                  type="button"
                >
                  {oauthLoading === "apple"
                    ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    : <AppleIcon />}
                  Continue with Apple
                </button>
              </div>

              {/* Divider */}
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-line" />
                <span className="text-xs text-muted">or</span>
                <div className="h-px flex-1 bg-line" />
              </div>

              {/* Email form */}
              <form className="grid gap-3" onSubmit={handleEmailSubmit}>
                {mode === "signup" && (
                  <div className="grid gap-1.5">
                    <label className="text-xs font-medium text-foreground" htmlFor="auth-name">Full name</label>
                    <input
                      autoComplete="name"
                      className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-zinc-400 focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10"
                      disabled={isLoading}
                      id="auth-name"
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      required
                      type="text"
                      value={name}
                    />
                  </div>
                )}
                <div className="grid gap-1.5">
                  <label className="text-xs font-medium text-foreground" htmlFor="auth-email">Email</label>
                  <input
                    autoComplete="email"
                    className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-zinc-400 focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10"
                    disabled={isLoading}
                    id="auth-email"
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    ref={emailRef}
                    required
                    type="email"
                    value={email}
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-medium text-foreground" htmlFor="auth-password">Password</label>
                  <input
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-zinc-400 focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10"
                    disabled={isLoading}
                    id="auth-password"
                    minLength={mode === "signup" ? 8 : undefined}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "signup" ? "Min. 8 characters" : "••••••••"}
                    required
                    type="password"
                    value={password}
                  />
                </div>

                {error && error !== "__confirm__" && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                    {error}
                  </p>
                )}

                <button
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isLoading}
                  type="submit"
                >
                  {isPending && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  )}
                  {isPending
                    ? "Please wait…"
                    : mode === "signin" ? "Sign in" : "Create account"}
                </button>
              </form>

              {/* Mode toggle */}
              <p className="mt-4 text-center text-xs text-muted">
                {mode === "signin" ? (
                  <>No account?{" "}
                    <button className="font-medium text-foreground underline underline-offset-2" onClick={() => switchMode("signup")} type="button">
                      Create one
                    </button>
                  </>
                ) : (
                  <>Already have an account?{" "}
                    <button className="font-medium text-foreground underline underline-offset-2" onClick={() => switchMode("signin")} type="button">
                      Sign in
                    </button>
                  </>
                )}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

