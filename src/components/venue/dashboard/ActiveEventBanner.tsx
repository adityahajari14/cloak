"use client";

import { useState } from "react";
import type { ActiveEvent } from "@/lib/venue-dashboard";

function formatTime(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function ActiveEventBanner({
  event,
  onEnd,
  readOnly = false,
}: {
  event: ActiveEvent;
  onEnd: (eventId: string) => Promise<void>;
  /** Staff see the occupancy readout; ending an event is a manager action. */
  readOnly?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleEnd() {
    setLoading(true);
    try {
      await onEnd(event.id);
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  const start = formatTime(event.startsAt);
  const end = formatTime(event.endsAt);
  const timeLabel = start && end
    ? `${start}–${end}`
    : start
      ? `from ${start}`
      : null;

  // Occupancy is what the counter actually cares about: how many guests are
  // holding items right now, against the limit. It falls as guests collect.
  const cap = event.guestCapacity;
  const atCapacity = cap !== null && event.guestsOccupying >= cap;
  const nearCapacity = cap !== null && !atCapacity && event.guestsOccupying >= cap * 0.9;

  const tone = atCapacity
    ? "border-red-200 bg-red-50"
    : nearCapacity
      ? "border-amber-200 bg-amber-50"
      : "border-emerald-200 bg-emerald-50";
  const textTone = atCapacity
    ? "text-red-900"
    : nearCapacity
      ? "text-amber-900"
      : "text-emerald-900";
  const subTone = atCapacity
    ? "text-red-700"
    : nearCapacity
      ? "text-amber-700"
      : "text-emerald-700";
  const dotTone = atCapacity ? "bg-red-500" : nearCapacity ? "bg-amber-500" : "bg-emerald-500";
  const pingTone = atCapacity ? "bg-red-400" : nearCapacity ? "bg-amber-400" : "bg-emerald-400";

  const occupancyLabel =
    cap === null
      ? `${event.guestsOccupying} ${event.guestsOccupying === 1 ? "guest" : "guests"} holding items`
      : `${event.guestsOccupying}/${cap} guests${atCapacity ? " · at capacity" : ""}`;

  return (
    <div className={`flex items-center gap-4 rounded-xl border px-4 py-3.5 ${tone}`}>
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${pingTone}`} />
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dotTone}`} />
      </span>

      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${textTone}`}>
          {event.name}
          <span className={`ml-2 text-xs font-normal ${subTone}`}>Live now</span>
        </p>
        <p className={`mt-0.5 text-xs ${subTone}`}>
          {timeLabel ? `${timeLabel} · ` : ""}
          {occupancyLabel}
        </p>
      </div>

      {atCapacity && (
        <p className="shrink-0 text-xs font-medium text-red-700">
          Check-ins blocked until a guest collects
        </p>
      )}

      {readOnly ? null : confirming ? (
        <div className="flex shrink-0 items-center gap-2">
          <span className={`text-xs ${subTone}`}>
            End it?{" "}
            {event.guestsOccupying > 0
              ? `${event.guestsOccupying} still holding items — they'll be flagged forgotten.`
              : ""}
          </span>
          <button
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
            disabled={loading}
            onClick={handleEnd}
            type="button"
          >
            {loading ? "Ending…" : "Confirm end"}
          </button>
          <button
            className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-muted transition hover:text-foreground"
            onClick={() => setConfirming(false)}
            type="button"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          className="shrink-0 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
          onClick={() => setConfirming(true)}
          type="button"
        >
          End event
        </button>
      )}
    </div>
  );
}
