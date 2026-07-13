"use client";

import { useEffect, useState } from "react";
import type { ActiveEvent } from "@/lib/venue-dashboard";

export default function PreEventAlert({
  event,
  onStart,
}: {
  event: ActiveEvent;
  onStart: (eventId: string) => Promise<void>;
}) {
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!event.startsAt) return;

    function update() {
      const diff = new Date(event.startsAt!).getTime() - Date.now();
      setMinutesLeft(Math.round(diff / 60000));
    }

    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [event.startsAt]);

  // Prompt from 10 minutes out. Unlike the old version this keeps showing once
  // the start time passes — an event that should have opened but hasn't is
  // exactly when the manager most needs the nudge.
  if (dismissed || minutesLeft === null || minutesLeft > 10) return null;

  const label =
    minutesLeft > 1
      ? `starts in ${minutesLeft} minutes`
      : minutesLeft === 1
        ? "starts in 1 minute"
        : minutesLeft === 0
          ? "starts now"
          : "was due to start";

  async function handleStart() {
    setStarting(true);
    try {
      await onStart(event.id);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-white">
        !
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-amber-900">
          {event.name} {label}
        </p>
        <p className="mt-0.5 text-xs text-amber-700">
          Start the event to open check-ins. Guests can&rsquo;t use its QR until you do.
        </p>
      </div>

      <button
        className="shrink-0 rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        disabled={starting}
        onClick={handleStart}
        type="button"
      >
        {starting ? "Starting…" : "Start event"}
      </button>

      <button
        className="shrink-0 rounded-md p-1 text-amber-600 transition hover:bg-amber-100 hover:text-amber-800"
        onClick={() => setDismissed(true)}
        type="button"
        aria-label="Dismiss"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
