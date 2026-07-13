"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import PageShell from "@/components/shared/PageShell";
import Panel from "@/components/shared/Panel";
import SubmitButton from "@/components/shared/SubmitButton";
import {
  createEvent,
  deleteEvent,
  endEvent,
  resetEvent,
  startEvent,
  updateEvent,
} from "@/app/venueevents/actions";
import type { EventStatus, VenueEvent } from "@/lib/events";

const input =
  "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-zinc-400 focus:border-foreground/40 focus:ring-2 focus:ring-foreground/8";

type Venue = { id: string; name: string };

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    weekday: "short",
    year: "numeric",
  });
}

function formatTime(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** "18:30" from an ISO timestamp — for prefilling the edit form's time inputs. */
function toTimeInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function StatusBadge({ status }: { status: EventStatus }) {
  const map: Record<EventStatus, string> = {
    live: "bg-emerald-50 text-emerald-700 border-emerald-200",
    scheduled: "bg-blue-50 text-blue-700 border-blue-200",
    ended: "bg-zinc-100 text-zinc-500 border-zinc-200",
  };
  const label: Record<EventStatus, string> = {
    live: "Live",
    scheduled: "Scheduled",
    ended: "Ended",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${map[status]}`}>
      {status === "live" && (
        <span className="relative mr-1.5 flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
      )}
      {label[status]}
    </span>
  );
}

/** Live occupancy against the guest limit — the number a door supervisor wants. */
function OccupancyLabel({ event }: { event: VenueEvent }) {
  if (event.guestCapacity === null) {
    return (
      <>
        {event.ticketCount} {event.ticketCount === 1 ? "ticket" : "tickets"}
      </>
    );
  }

  const full = event.guestsOccupying >= event.guestCapacity;
  return (
    <>
      <span className={full ? "font-semibold text-red-600" : ""}>
        {event.guestsOccupying}/{event.guestCapacity} guests
      </span>
      {full ? " · full" : ""} · {event.ticketCount}{" "}
      {event.ticketCount === 1 ? "ticket" : "tickets"}
    </>
  );
}

function SectionAlert({ type, message }: { type: "success" | "error"; message: string }) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm font-medium ${
        type === "success"
          ? "border-emerald-100 bg-emerald-50 text-emerald-700"
          : "border-red-100 bg-red-50 text-red-700"
      }`}
    >
      {message}
    </div>
  );
}

// ─── QR Modal ──────────────────────────────────────────────────────────────────

function EventShareModal({
  event,
  shareUrl,
  onClose,
}: {
  event: VenueEvent;
  shareUrl: string;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, shareUrl, {
      color: { dark: "#09090b", light: "#ffffff" },
      margin: 2,
      width: 220,
    }).then(() => setReady(true));
  }, [shareUrl]);

  function handleCopy() {
    void navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pad = 24;
    const labelH = 52;
    const size = canvas.width;
    const out = document.createElement("canvas");
    out.width = size + pad * 2;
    out.height = size + pad * 2 + labelH;
    const ctx = out.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, pad, pad);
    ctx.fillStyle = "#09090b";
    ctx.font = "bold 14px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(event.name, out.width / 2, size + pad * 2 + 18);
    ctx.fillStyle = "#71717a";
    ctx.font = "12px system-ui, -apple-system, sans-serif";
    ctx.fillText("Scan to check in your items", out.width / 2, size + pad * 2 + 38);
    const link = document.createElement("a");
    link.download = `${event.name.replace(/\s+/g, "-").toLowerCase()}-checkin-qr.png`;
    link.href = out.toDataURL("image/png");
    link.click();
  }

  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
      onClick={handleBackdrop}
    >
      <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-foreground">{event.name}</p>
            <p className="mt-0.5 text-xs text-muted">{formatDate(event.eventDate)} · Guest check-in link</p>
          </div>
          <button
            className="mt-0.5 shrink-0 rounded-lg p-1.5 text-muted hover:bg-zinc-100 hover:text-foreground"
            onClick={onClose}
            type="button"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="relative mx-auto mb-4 flex h-55 w-55 items-center justify-center overflow-hidden rounded-xl border border-line bg-white p-2 shadow-sm">
          <canvas ref={canvasRef} className={ready ? "block" : "invisible"} height={220} width={220} />
          {!ready && (
            <div className="absolute inset-2 flex items-center justify-center rounded-lg bg-zinc-50">
              <span className="text-xs text-muted">Generating…</span>
            </div>
          )}
        </div>

        <div className="mb-4 flex items-center gap-2 overflow-hidden rounded-lg border border-line bg-zinc-50">
          <p className="min-w-0 flex-1 truncate px-3 py-2 font-mono text-xs text-foreground">
            {shareUrl}
          </p>
          <div className="shrink-0 pr-2">
            <button
              className="rounded-md border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-muted transition hover:border-foreground/30 hover:text-foreground"
              onClick={handleCopy}
              type="button"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        <button
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          disabled={!ready}
          onClick={handleDownload}
          type="button"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Download QR PNG
        </button>
      </div>
    </div>
  );
}

// ─── Create form ───────────────────────────────────────────────────────────────

function CreateEventForm({ venues }: { venues: Venue[] }) {
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  if (!open) {
    return (
      <button
        className="flex items-center gap-2 rounded-xl border border-dashed border-line bg-zinc-50 px-4 py-3.5 text-sm font-medium text-muted w-full transition hover:border-foreground/30 hover:text-foreground"
        onClick={() => setOpen(true)}
        type="button"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Create event
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">New event</p>
        <button
          className="rounded-lg p-1.5 text-muted hover:bg-zinc-100 hover:text-foreground"
          onClick={() => setOpen(false)}
          type="button"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <form action={createEvent} className="grid gap-4">
        {venues.length > 1 && (
          <label>
            <span className="mb-1.5 block text-sm font-medium text-foreground">Venue</span>
            <select className={input} name="venueId" required>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </label>
        )}
        {venues.length === 1 && (
          <input name="venueId" type="hidden" value={venues[0].id} />
        )}
        <label>
          <span className="mb-1.5 block text-sm font-medium text-foreground">Event name</span>
          <input className={input} name="name" placeholder="e.g. Friday Night Live" required />
        </label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <label className="sm:col-span-1">
            <span className="mb-1.5 block text-sm font-medium text-foreground">Date</span>
            <input className={input} defaultValue={today} name="eventDate" required type="date" />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium text-foreground">Starts</span>
            <input className={input} name="startsAt" type="time" />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium text-foreground">Ends</span>
            <input className={input} name="endsAt" type="time" />
          </label>
        </div>
        <label>
          <span className="mb-1.5 block text-sm font-medium text-foreground">Guest limit</span>
          <input className={input} min="1" name="guestCapacity" placeholder="Unlimited" type="number" />
          <span className="mt-1.5 block text-xs text-muted">
            Max guests holding items at once. A slot frees up as soon as a guest collects
            everything. Leave blank for unlimited — this is separate from your hanger/bag capacity.
          </span>
        </label>
        <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs text-blue-800">
          The event is created as <strong>Scheduled</strong>. You can share its check-in QR right
          away, but it won&rsquo;t accept guests until you press <strong>Start</strong>.
        </p>
        <div className="flex justify-end gap-2">
          <button
            className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-muted transition hover:text-foreground"
            onClick={() => setOpen(false)}
            type="button"
          >
            Cancel
          </button>
          <SubmitButton>Create event</SubmitButton>
        </div>
      </form>
    </div>
  );
}

// ─── Edit form ─────────────────────────────────────────────────────────────────

function EditEventForm({ event, onClose }: { event: VenueEvent; onClose: () => void }) {
  return (
    <div className="rounded-xl border border-line bg-zinc-50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Edit event</p>
        <button
          className="rounded-lg p-1.5 text-muted hover:bg-zinc-100 hover:text-foreground"
          onClick={onClose}
          type="button"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <form action={updateEvent} className="grid gap-4">
        <input name="eventId" type="hidden" value={event.id} />
        <label>
          <span className="mb-1.5 block text-sm font-medium text-foreground">Event name</span>
          <input className={input} defaultValue={event.name} name="name" required />
        </label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <label>
            <span className="mb-1.5 block text-sm font-medium text-foreground">Date</span>
            <input
              className={input}
              defaultValue={event.eventDate}
              disabled={event.status === "ended"}
              name="eventDate"
              required
              type="date"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium text-foreground">Starts</span>
            <input className={input} defaultValue={toTimeInput(event.startsAt)} name="startsAt" type="time" />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium text-foreground">Ends</span>
            <input className={input} defaultValue={toTimeInput(event.endsAt)} name="endsAt" type="time" />
          </label>
        </div>
        <label>
          <span className="mb-1.5 block text-sm font-medium text-foreground">Guest limit</span>
          <input
            className={input}
            defaultValue={event.guestCapacity ?? ""}
            min="1"
            name="guestCapacity"
            placeholder="Unlimited"
            type="number"
          />
          <span className="mt-1.5 block text-xs text-muted">
            {event.guestCapacity !== null && event.guestsOccupying > 0
              ? `${event.guestsOccupying} guests are currently holding items. Lowering the limit below that stops new check-ins but never affects items already stored.`
              : "Leave blank for unlimited."}
          </span>
        </label>
        {event.status === "ended" && (
          <p className="text-xs text-muted">
            This event has ended, so its date is locked — tickets are already filed against it.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-muted transition hover:text-foreground"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <SubmitButton>Save changes</SubmitButton>
        </div>
      </form>
    </div>
  );
}

// ─── Event row ─────────────────────────────────────────────────────────────────

function EventRow({
  event,
  showVenue,
  onShare,
}: {
  event: VenueEvent;
  showVenue: boolean;
  onShare?: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [editing, setEditing] = useState(false);

  const start = formatTime(event.startsAt);
  const end = formatTime(event.endsAt);
  const timeLabel = start && end ? `${start}–${end}` : start ? `from ${start}` : null;

  if (editing) {
    return (
      <div className="py-4 first:pt-0 last:pb-0">
        <EditEventForm event={event} onClose={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground">{event.name}</p>
          <StatusBadge status={event.status} />
        </div>
        <p className="mt-1 text-xs text-muted">
          {formatDate(event.eventDate)}
          {timeLabel ? ` · ${timeLabel}` : ""}
          {showVenue ? ` · ${event.venueName}` : ""}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          <OccupancyLabel event={event} />
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {/* Share — available while scheduled too, so the QR can go on the door
            days in advance. It simply won't take check-ins until Start. */}
        {onShare && event.status !== "ended" && (
          <button
            className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:border-foreground/30 hover:text-foreground"
            onClick={onShare}
            title="Share check-in link"
            type="button"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Share
          </button>
        )}

        <button
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:border-foreground/30 hover:text-foreground"
          onClick={() => setEditing(true)}
          type="button"
        >
          Edit
        </button>

        {/* Scheduled → Start */}
        {event.status === "scheduled" && (
          <form action={startEvent}>
            <input name="eventId" type="hidden" value={event.id} />
            <button
              className="rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
              type="submit"
            >
              Start event
            </button>
          </form>
        )}

        {/* Live → End (with confirmation: it flags uncollected items forgotten) */}
        {event.status === "live" && (
          confirmEnd ? (
            <form action={endEvent} className="flex items-center gap-1.5">
              <input name="eventId" type="hidden" value={event.id} />
              <span className="text-xs text-muted">
                End it? {event.guestsOccupying > 0
                  ? `${event.guestsOccupying} guest${event.guestsOccupying === 1 ? "" : "s"} still holding items.`
                  : ""}
              </span>
              <button
                className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                type="submit"
              >
                Confirm
              </button>
              <button
                className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-muted transition hover:text-foreground"
                onClick={() => setConfirmEnd(false)}
                type="button"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
              onClick={() => setConfirmEnd(true)}
              type="button"
            >
              End event
            </button>
          )
        )}

        {/* Ended → Reset (undo). Restores every ticket End flagged as forgotten. */}
        {event.status === "ended" && (
          confirmReset ? (
            <form action={resetEvent} className="flex items-center gap-1.5">
              <input name="eventId" type="hidden" value={event.id} />
              <span className="text-xs text-muted">
                Reopen{event.guestsOccupying > 0 ? ` and restore ${event.guestsOccupying} ticket${event.guestsOccupying === 1 ? "" : "s"}` : ""}?
              </span>
              <button
                className="rounded-lg border border-foreground bg-foreground px-2.5 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                type="submit"
              >
                Confirm
              </button>
              <button
                className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-muted transition hover:text-foreground"
                onClick={() => setConfirmReset(false)}
                type="button"
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              className="rounded-lg border border-foreground bg-foreground px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
              onClick={() => setConfirmReset(true)}
              title="Reopen this event and restore its tickets"
              type="button"
            >
              Reset
            </button>
          )
        )}

        {/* Delete — only for events with no tickets */}
        {event.ticketCount === 0 && (
          confirmDelete ? (
            <form action={deleteEvent} className="flex items-center gap-1.5">
              <input name="eventId" type="hidden" value={event.id} />
              <span className="text-xs text-muted">Delete?</span>
              <button
                className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                type="submit"
              >
                Yes
              </button>
              <button
                className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-muted transition hover:text-foreground"
                onClick={() => setConfirmDelete(false)}
                type="button"
              >
                No
              </button>
            </form>
          ) : (
            <button
              className="rounded-lg p-1.5 text-muted transition hover:bg-zinc-100 hover:text-red-600"
              onClick={() => setConfirmDelete(true)}
              title="Delete event"
              type="button"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function VenueEventsPage({
  error,
  events,
  message,
  origin,
  venues,
}: {
  error?: string;
  events: VenueEvent[];
  message?: string;
  origin: string;
  venues: Venue[];
}) {
  const [shareEvent, setShareEvent] = useState<VenueEvent | null>(null);

  const liveEvents = events.filter((e) => e.status === "live");
  const scheduledEvents = events.filter((e) => e.status === "scheduled");
  const endedEvents = events.filter((e) => e.status === "ended");
  const showVenue = venues.length > 1;

  const primaryVenueId = venues[0]?.id ?? null;
  const shareUrl = shareEvent && primaryVenueId
    ? `${origin}/customer-signup?venue=${shareEvent.venueId}&event=${shareEvent.id}`
    : null;

  return (
    <PageShell
      activePath="/venueevents"
      eyebrow="Events"
      title="Events"
      description="Create the nights your venue runs. Share the check-in QR ahead of time, then start the event when the cloakroom opens."
      venueRole="manager"
    >
      {message ? <SectionAlert message={message} type="success" /> : null}
      {error ? <SectionAlert message={error} type="error" /> : null}

      <CreateEventForm venues={venues} />

      {liveEvents.length > 0 && (
        <Panel title="Live now" description="Accepting guest check-ins.">
          <div className="divide-y divide-line">
            {liveEvents.map((event) => (
              <EventRow
                event={event}
                key={event.id}
                onShare={() => setShareEvent(event)}
                showVenue={showVenue}
              />
            ))}
          </div>
        </Panel>
      )}

      {scheduledEvents.length > 0 && (
        <Panel
          title="Scheduled"
          description="Share the QR now — check-ins open when you press Start."
        >
          <div className="divide-y divide-line">
            {scheduledEvents.map((event) => (
              <EventRow
                event={event}
                key={event.id}
                onShare={() => setShareEvent(event)}
                showVenue={showVenue}
              />
            ))}
          </div>
        </Panel>
      )}

      {events.length === 0 && (
        <div className="rounded-xl border border-dashed border-line bg-zinc-50 px-4 py-8 text-center text-sm text-muted">
          No events yet. Create one above to let guests tag their visit.
        </div>
      )}

      {endedEvents.length > 0 && (
        <Panel title="Ended" description="Reset an event to reopen it and restore its tickets.">
          <div className="divide-y divide-line">
            {endedEvents.map((event) => (
              <EventRow
                event={event}
                key={event.id}
                showVenue={showVenue}
              />
            ))}
          </div>
        </Panel>
      )}

      {shareEvent && shareUrl && (
        <EventShareModal
          event={shareEvent}
          shareUrl={shareUrl}
          onClose={() => setShareEvent(null)}
        />
      )}
    </PageShell>
  );
}
