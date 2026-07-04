"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { resendCloakClubPass } from "@/app/cloak-club/actions";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function CloakClubCard({ memberSince }: { memberSince: string | null }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  if (!memberSince) {
    return (
      <Link
        className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm transition hover:border-foreground/20 hover:shadow"
        href="/cloak-club"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-lg">
          ✨
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">Join Cloak Club</p>
          <p className="mt-0.5 text-xs text-muted">Get a permanent pass that works at every Cloak venue.</p>
        </div>
        <svg className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    );
  }

  function handleResend() {
    setError("");
    startTransition(async () => {
      const result = await resendCloakClubPass();
      if (result && !result.ok) setError(result.error ?? "Could not open your pass. Please try again.");
    });
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-lg">
          ✨
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">Cloak Club member</p>
          <p className="mt-0.5 text-xs text-muted">Member since {formatDate(memberSince)}</p>
        </div>
      </div>
      {error ? <p className="mt-2 text-xs font-medium text-red-600">{error}</p> : null}
      <button
        className="mt-3 w-full rounded-xl border border-line bg-zinc-50 py-2.5 text-sm font-semibold text-foreground transition hover:bg-zinc-100 disabled:opacity-50"
        disabled={isPending}
        onClick={handleResend}
        type="button"
      >
        {isPending ? "Opening…" : "View my pass"}
      </button>
    </div>
  );
}
