"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import FieldPreview from "@/components/shared/FieldPreview";
import PageShell from "@/components/shared/PageShell";
import Panel from "@/components/shared/Panel";
import StatusPill, { type StatusTone } from "@/components/shared/StatusPill";
import { PrimaryLink, SecondaryLink } from "@/components/shared/ButtonLink";
import type { VenueTicketDetail } from "@/lib/venue-dashboard";
import {
  collectItemsFromDetail,
  contactGuestAboutForgottenTicket,
  resendPassViaWhatsApp,
  type ContactChannel,
  type TicketContactLogEntry,
} from "@/app/venueticketdetail/actions";

function formatStatus(status: VenueTicketDetail["status"]) {
  if (status === "pending_activation") return "Pending activation";
  if (status === "partially_collected") return "Partially collected";
  if (status === "forgotten") return "Forgotten";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusTone(status: VenueTicketDetail["status"]): StatusTone {
  if (status === "active" || status === "partially_collected") return "green";
  if (status === "pending_activation") return "warning";
  if (status === "collected") return "neutral";
  if (status === "forgotten") return "danger";
  return "danger";
}

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function VenueTicketDetailPage({
  contactLog,
  ticket,
}: {
  contactLog: TicketContactLogEntry[];
  ticket: VenueTicketDetail | null;
}) {
  const router = useRouter();

  if (!ticket) {
    return (
      <PageShell
        activePath="/venueticketdetail"
        eyebrow="Ticket detail"
        title="Ticket not found"
        venueRole="manager"
        description="The ticket may not exist, or it may belong to another venue."
        actions={<SecondaryLink href="/venuedashboard">Back to dashboard</SecondaryLink>}
      >
        <Panel>
          <p className="text-sm text-muted">
            Select a ticket from the venue dashboard to view its operational details.
          </p>
        </Panel>
      </PageShell>
    );
  }

  return (
    <PageShell
      activePath="/venueticketdetail"
      eyebrow="Ticket detail"
      title={ticket.publicCode}
      venueRole="manager"
      description="Inspect guest details, storage information, and scan history."
      actions={
        <>
          <PrimaryLink href="/venuescanner">Open scanner</PrimaryLink>
          <SecondaryLink href="/venuedashboard">Back</SecondaryLink>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-2">
        <Panel title="Guest">
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldPreview label="Name" value={ticket.guestName} />
            <FieldPreview label="Mobile" value={ticket.guestPhone} />
            <FieldPreview label="Email" value={ticket.guestEmail || "Not provided"} />
            <FieldPreview label="Venue" value={ticket.venueName} />
            <FieldPreview label="Event" value={ticket.eventName ?? "No event"} />
            <div>
              <span className="text-sm font-medium text-foreground">Status</span>
              <div className="mt-2">
                <StatusPill tone={statusTone(ticket.status)}>{formatStatus(ticket.status)}</StatusPill>
              </div>
            </div>
          </div>
        </Panel>

        {ticket.status === "forgotten" ? (
          <ContactCustomerPanel contactLog={contactLog} ticket={ticket} />
        ) : null}

        {/* A guest who's lost their link can be sent it again — only meaningful
            while the pass is still usable. */}
        {ticket.status === "pending_activation" ||
        ticket.status === "active" ||
        ticket.status === "partially_collected" ? (
          <ResendPassPanel ticket={ticket} />
        ) : null}

        <ItemsPanel ticket={ticket} onFullCheckout={() => router.push("/venuedashboard")} />

        <Panel title="Timeline">
          <div className="space-y-4">
            <TicketTimeline ticket={ticket} />
          </div>
        </Panel>
      </div>
    </PageShell>
  );
}

function formatContactDate(iso: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

function ContactCustomerPanel({
  contactLog,
  ticket,
}: {
  contactLog: TicketContactLogEntry[];
  ticket: VenueTicketDetail;
}) {
  const [sending, setSending] = useState<ContactChannel | null>(null);
  const [log, setLog] = useState(contactLog);
  const [error, setError] = useState("");

  async function handleContact(channel: ContactChannel) {
    setError("");
    setSending(channel);
    try {
      const result = await contactGuestAboutForgottenTicket(ticket.id, channel);
      if (result.ok) {
        setLog((prev) => [{ channel, createdAt: new Date().toISOString(), id: crypto.randomUUID() }, ...prev]);
      } else {
        setError(
          channel === "email"
            ? "Could not send email — the guest may not have provided an email address."
            : "Could not send WhatsApp message. Please try again.",
        );
      }
    } finally {
      setSending(null);
    }
  }

  const lastEmail = log.find((c) => c.channel === "email");
  const lastWhatsapp = log.find((c) => c.channel === "whatsapp");

  return (
    <Panel title="Contact customer">
      <p className="mb-4 text-sm text-muted">
        This event ended before the guest collected their items. Let them know their items are
        still waiting.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-zinc-50 disabled:opacity-50"
          disabled={sending !== null || !ticket.guestEmail}
          onClick={() => handleContact("email")}
          type="button"
        >
          {sending === "email" ? "Sending…" : lastEmail ? "Resend email" : "Send email"}
        </button>
        <button
          className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-zinc-50 disabled:opacity-50"
          disabled={sending !== null}
          onClick={() => handleContact("whatsapp")}
          type="button"
        >
          {sending === "whatsapp" ? "Sending…" : lastWhatsapp ? "Resend WhatsApp" : "Send WhatsApp"}
        </button>
      </div>

      {error ? <p className="mt-3 text-xs font-medium text-red-600">{error}</p> : null}

      {log.length > 0 ? (
        <div className="mt-4 space-y-1.5 border-t border-line pt-3">
          {log.map((c) => (
            <p className="text-xs text-muted" key={c.id}>
              {c.channel === "email" ? "Emailed" : "WhatsApp sent"} — {formatContactDate(c.createdAt)}
            </p>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}

/**
 * Resend the guest their pass over WhatsApp — the counter's answer to "I've lost
 * the link". Separate from ContactCustomerPanel, which chases forgotten items.
 */
function ResendPassPanel({ ticket }: { ticket: VenueTicketDetail }) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleResend() {
    setResult(null);
    setSending(true);
    try {
      setResult(await resendPassViaWhatsApp(ticket.id));
    } finally {
      setSending(false);
    }
  }

  return (
    <Panel title="Share pass with guest">
      <p className="mb-4 text-sm text-muted">
        Send this guest their pass again on WhatsApp — useful if they&rsquo;ve lost the link or
        switched phone.
      </p>
      <button
        className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-50"
        disabled={sending || !ticket.guestPhone}
        onClick={handleResend}
        type="button"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 0 1 6.99 2.896 9.82 9.82 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.887 9.884m8.413-18.297A11.82 11.82 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.88 11.88 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 0 0-3.48-8.413" />
        </svg>
        {sending ? "Sending…" : "Send pass on WhatsApp"}
      </button>

      {!ticket.guestPhone ? (
        <p className="mt-3 text-xs text-muted">No phone number on file for this guest.</p>
      ) : null}

      {result ? (
        <p
          className={`mt-3 text-xs font-medium ${result.ok ? "text-emerald-600" : "text-red-600"}`}
        >
          {result.message}
        </p>
      ) : null}
    </Panel>
  );
}

function ItemsPanel({
  ticket,
  onFullCheckout,
}: {
  ticket: VenueTicketDetail;
  onFullCheckout: () => void;
}) {
  const openItems = ticket.items.filter((i) => !i.collectedAt);
  const collectedItems = ticket.items.filter((i) => i.collectedAt);
  const canCollect =
    ticket.status === "active" ||
    ticket.status === "partially_collected" ||
    ticket.status === "forgotten";

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(openItems.map((i) => i.id)),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCollect() {
    if (selected.size === 0) { setError("Select at least one item."); return; }
    setError("");
    setLoading(true);
    try {
      const result = await collectItemsFromDetail(ticket.id, [...selected]);
      if (result.ok && result.allCollected) {
        onFullCheckout();
      } else if (result.ok) {
        // Partial — reload page to refresh item states
        window.location.reload();
      } else {
        setError("Could not collect items. Try scanning in the scanner.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel title="Items in storage">
      {ticket.items.length === 0 ? (
        <p className="text-sm text-muted">No items recorded yet — added at activation.</p>
      ) : (
        <>
          {openItems.length > 0 && (
            <div className="mb-3 space-y-2">
              {openItems.map((item) => (
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                    canCollect
                      ? selected.has(item.id)
                        ? "border-foreground/30 bg-zinc-50"
                        : "border-line"
                      : "cursor-default border-line"
                  }`}
                  key={item.id}
                >
                  {canCollect && (
                    <input
                      checked={selected.has(item.id)}
                      className="h-4 w-4 shrink-0 accent-foreground"
                      onChange={() => toggle(item.id)}
                      type="checkbox"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {item.quantity > 1 ? `${item.quantity}× ` : ""}{item.label}
                    </p>
                    {item.notes ? <p className="mt-0.5 text-xs text-muted">{item.notes}</p> : null}
                  </div>
                  {item.storageLocation ? (
                    <span className="shrink-0 rounded bg-foreground px-1.5 py-0.5 font-mono text-xs font-bold text-white">
                      {item.storageLocation}
                    </span>
                  ) : (
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700`}
                    >
                      Stored
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}

          {collectedItems.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {collectedItems.map((item) => (
                <div className="flex items-center gap-2 text-sm text-muted line-through" key={item.id}>
                  <span className="text-emerald-500">✓</span>
                  {item.quantity > 1 ? `${item.quantity}× ` : ""}{item.label}
                  {item.storageLocation ? (
                    <span className="font-mono text-xs">{item.storageLocation}</span>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {error ? <p className="mb-2 text-xs font-medium text-red-600">{error}</p> : null}

          {canCollect && openItems.length > 0 && (
            <button
              className="w-full rounded-xl bg-foreground py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              disabled={loading || selected.size === 0}
              onClick={handleCollect}
              type="button"
            >
              {loading
                ? "Collecting…"
                : selected.size === openItems.length
                  ? "Return all & close ticket"
                  : `Return ${selected.size} item${selected.size === 1 ? "" : "s"}`}
            </button>
          )}
        </>
      )}

      {ticket.itemDescription ? (
        <p className="mt-4 border-t border-line pt-4 text-xs leading-5 text-muted">
          {ticket.itemDescription}
        </p>
      ) : null}
    </Panel>
  );
}

function TicketTimeline({ ticket }: { ticket: VenueTicketDetail }) {
  const isForgotten =
    ticket.status === "pending_activation" && new Date(ticket.expiresAt) < new Date();
  const isMultiItem = ticket.items.length > 1;

  // Build a flat list of timeline events sorted by timestamp.
  // `by` is the staff member responsible — the field that actually settles a
  // "who handled my coat?" dispute.
  type TimelineEvent = { at: string; label: string; tone: StatusTone; by?: string | null };
  const events: TimelineEvent[] = [];

  events.push({ at: ticket.createdAt, label: "Ticket created", tone: "blue" });

  if (ticket.activatedAt) {
    // The guest creates the ticket; a staff member activates it. Prefer the
    // activation scan's actor, falling back to whoever logged the first item.
    const activationScan = ticket.scans.find(
      (s) => s.scanType === "activation" && s.result === "accepted",
    );
    events.push({
      at: ticket.activatedAt,
      by: activationScan?.staffName ?? ticket.items[0]?.addedBy ?? null,
      label: "Activated and stored",
      tone: "green",
    });
  }

  for (const item of ticket.items) {
    if (item.collectedAt) {
      events.push({
        at: item.collectedAt,
        by: item.collectedBy,
        label: `${item.label} returned`,
        tone: "green",
      });
    } else if (isForgotten) {
      // Use expires_at as the forgotten timestamp since there's no per-item forgotten_at
      events.push({ at: ticket.expiresAt, label: `${item.label} forgotten`, tone: "danger" });
    }
  }

  // "All items collected" — only for multi-item tickets, deduplicated from individual events
  if (isMultiItem && ticket.collectedAt) {
    events.push({ at: ticket.collectedAt, label: "All items collected", tone: "green" });
  }

  // Rejected scans matter for disputes too — someone tried this pass and was
  // turned away. Without them the timeline only tells the happy-path story.
  for (const scan of ticket.scans) {
    if (scan.result === "rejected") {
      events.push({
        at: scan.createdAt,
        by: scan.staffName,
        label: scan.reason ? `Scan rejected — ${scan.reason}` : "Scan rejected",
        tone: "danger",
      });
    }
  }

  // Sort chronologically
  events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <>
      {events.map((e, i) => (
        <TimelineItem
          by={e.by}
          key={`${e.at}-${i}`}
          label={e.label}
          tone={e.tone}
          value={formatDate(e.at)}
        />
      ))}
    </>
  );
}

function TimelineItem({
  by,
  label,
  tone,
  value,
}: {
  by?: string | null;
  label: string;
  tone: StatusTone;
  value: string | ReactNode;
}) {
  const dotClass =
    tone === "green"
      ? "bg-emerald-500"
      : tone === "danger"
        ? "bg-red-500"
        : tone === "blue"
          ? "bg-foreground"
          : "border border-line bg-white";

  return (
    <div className="flex gap-3">
      <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${dotClass}`} />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="mt-1 text-sm text-muted">
          {value}
          {by ? (
            <>
              {" · "}
              <span className="font-medium text-foreground">{by}</span>
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}
