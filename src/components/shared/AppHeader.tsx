"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

type HeaderMode = "public" | "venue-staff" | "venue-manager" | "admin";

const navItems: Record<HeaderMode, Array<{ href: string; label: string }>> = {
  admin: [
    { href: "/masterdashboard", label: "Overview" },
    { href: "/analytics", label: "Analytics" },
  ],
  "venue-manager": [
    { href: "/venuedashboard", label: "Dashboard" },
    { href: "/venuescanner", label: "Scanner" },
    { href: "/smsbackup", label: "SMS backup" },
    { href: "/venueevents", label: "Events" },
    { href: "/venueanalytics", label: "Analytics" },
    { href: "/venuesettings", label: "Settings" },
  ],
  "venue-staff": [
    { href: "/venuedashboard", label: "Dashboard" },
    { href: "/venuescanner", label: "Scanner" },
    { href: "/smsbackup", label: "SMS backup" },
  ],
  public: [],
};

function resolveMode(activePath?: string, venueRole?: "staff" | "manager"): HeaderMode {
  if (activePath === "/masterdashboard" || activePath === "/analytics") return "admin";
  if (
    activePath === "/venuedashboard" ||
    activePath === "/venuescanner" ||
    activePath === "/venueevents" ||
    activePath === "/venueanalytics" ||
    activePath === "/venuesettings" ||
    activePath === "/smsbackup" ||
    activePath === "/venueticketdetail"
  ) {
    return venueRole === "manager" ? "venue-manager" : "venue-staff";
  }
  return "public";
}

export default function AppHeader({
  activePath,
  locked,
  venueRole,
}: {
  activePath?: string;
  locked?: boolean;
  venueRole?: "staff" | "manager";
}) {
  const mode = resolveMode(activePath, venueRole);
  const allItems = navItems[mode];
  const items = locked
    ? allItems.filter((i) => i.href === "/venuedashboard")
    : allItems;
  const isWorkspace = mode !== "public";
  const [open, setOpen] = useState(false);
  const { user, loading: authLoading, openAuthModal, signOut } = useAuth();

  const initials = user?.user_metadata?.full_name
    ? (user.user_metadata.full_name as string).split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? "?";

  const logoHref =
    mode === "admin"
      ? "/masterdashboard"
      : mode === "venue-manager" || mode === "venue-staff"
        ? "/venuedashboard"
        : "/";

  const dashboardHref = mode === "admin" ? "/masterdashboard" : "/venuedashboard";
  const showBackToDashboard = isWorkspace && activePath !== dashboardHref;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-panel/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <div className="flex min-w-0 shrink items-center gap-3">
          <Link className="flex shrink-0 items-center gap-2.5" href={logoHref}>
            <img
              alt="Cloak"
              className="h-8 w-8 rounded-lg object-cover"
              src="/images/cloak-logo.png"
            />
            <span className="hidden text-sm font-semibold text-foreground sm:block">Cloak</span>
          </Link>
          {showBackToDashboard && (
            <Link
              className="flex shrink-0 items-center gap-1 rounded-md border border-line bg-white px-2.5 py-1.5 text-xs font-medium text-muted transition hover:border-foreground/20 hover:text-foreground sm:text-sm"
              href={dashboardHref}
            >
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Dashboard</span>
            </Link>
          )}
        </div>

        {/* Desktop nav */}
        {allItems.length > 0 && (
          <nav className="hidden items-center gap-0.5 md:flex">
            {allItems.map((item) => {
              const isLocked = locked && item.href !== "/venuedashboard";
              if (isLocked) {
                return (
                  <span
                    className="cursor-not-allowed rounded-md px-3 py-2 text-sm font-medium text-muted/40 select-none"
                    key={item.href}
                    title="Available after approval"
                  >
                    {item.label}
                  </span>
                );
              }
              return (
                <Link
                  className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                    activePath === item.href
                      ? "bg-zinc-100 text-foreground"
                      : "text-muted hover:bg-zinc-50 hover:text-foreground"
                  }`}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}

        {/* Right side */}
        <div className="flex items-center gap-2">
          {isWorkspace ? (
            <button
              className="hidden rounded-md border border-line bg-white px-3 py-1.5 text-sm font-medium text-muted transition hover:border-foreground/20 hover:text-foreground md:block"
              onClick={signOut}
              type="button"
            >
              Sign out
            </button>
          ) : !authLoading ? (
            user ? (
              <Link
                className="flex items-center gap-2 rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm font-medium text-foreground transition hover:bg-zinc-50"
                href="/account"
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-foreground text-[10px] font-bold text-white">
                  {initials}
                </span>
                <span className="hidden sm:block">My account</span>
              </Link>
            ) : (
              <button
                className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-zinc-50"
                onClick={() => openAuthModal("signin")}
                type="button"
              >
                Sign in
              </button>
            )
          ) : null}

          {(items.length > 0 || isWorkspace || (!isWorkspace && user)) && (
            <button
              aria-label="Toggle menu"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white text-muted transition hover:text-foreground md:hidden"
              onClick={() => setOpen((v) => !v)}
              type="button"
            >
              {open ? (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="border-t border-line bg-panel md:hidden">
          <nav className="flex flex-col px-4 py-3 gap-1">
            {allItems.map((item) => {
              const isLocked = locked && item.href !== "/venuedashboard";
              if (isLocked) {
                return (
                  <span
                    className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted/40 select-none"
                    key={item.href}
                  >
                    {item.label}
                    <span className="ml-2 text-xs">(pending approval)</span>
                  </span>
                );
              }
              return (
                <Link
                  className={`rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    activePath === item.href
                      ? "bg-zinc-100 text-foreground"
                      : "text-muted hover:bg-zinc-50 hover:text-foreground"
                  }`}
                  href={item.href}
                  key={item.href}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
            {isWorkspace && (
              <button
                className="mt-1 w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-muted transition hover:bg-zinc-50 hover:text-foreground"
                onClick={signOut}
                type="button"
              >
                Sign out
              </button>
            )}
            {!isWorkspace && user && (
              <>
                <Link
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition hover:bg-zinc-50 hover:text-foreground"
                  href="/account"
                  onClick={() => setOpen(false)}
                >
                  My account
                </Link>
                <button
                  className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-muted transition hover:bg-zinc-50 hover:text-foreground"
                  onClick={signOut}
                  type="button"
                >
                  Sign out
                </button>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
