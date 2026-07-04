"use client";

import { useState, useTransition } from "react";
import PageShell from "@/components/shared/PageShell";
import Panel from "@/components/shared/Panel";
import { SecondaryLink } from "@/components/shared/ButtonLink";
import {
  activateVenue,
  contactVenue,
  suspendVenue,
  type VenueContactLogEntry,
} from "@/app/masterdashboard/actions";
import type { AdminVenueDetail } from "@/lib/admin-dashboard";
import {
  VENUE_CONTACT_TEMPLATES,
  getVenueContactTemplate,
  type VenueContactTemplateId,
} from "@/lib/venue-contact-templates";

function formatPlan(plan: string | null) {
  if (!plan) return "—";
  if (plan === "per_event") return "Per event";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(value),
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

const TEMPLATE_LABEL: Record<VenueContactLogEntry["template"], string> = {
  billing_followup: "Billing follow-up",
  cancellation_followup: "Cancellation follow-up",
  custom: "Custom message",
};

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-0.5 text-sm text-foreground">{value || "—"}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: AdminVenueDetail["status"] }) {
  const dot = status === "approved" ? "bg-zinc-800" : "bg-zinc-300";
  const label = status === "approved" ? "Approved" : "Suspended";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      <span className="text-sm text-foreground">{label}</span>
    </span>
  );
}

// ─── Suspend / reactivate actions ──────────────────────────────────────────────

function VenueActionsPanel({ venue }: { venue: AdminVenueDetail }) {
  const [suspendReason, setSuspendReason] = useState("");
  const [view, setView] = useState<"actions" | "suspend">("actions");
  const [isPending, startAction] = useTransition();

  function runAction(action: (fd: FormData) => Promise<void>, extraFields?: Record<string, string>) {
    startAction(async () => {
      const fd = new FormData();
      fd.set("venueId", venue.id);
      if (extraFields) Object.entries(extraFields).forEach(([k, v]) => fd.set(k, v));
      await action(fd);
    });
  }

  return (
    <Panel title="Actions">
      <div className="space-y-2">
        {venue.status === "approved" && view !== "suspend" && (
          <button
            className="flex w-full items-center justify-center rounded-xl border border-line py-3 text-sm font-medium text-muted transition hover:bg-zinc-50 hover:text-foreground"
            disabled={isPending}
            onClick={() => setView("suspend")}
            type="button"
          >
            Suspend venue
          </button>
        )}

        {view === "suspend" && (
          <div className="space-y-3">
            <p className="text-xs text-muted">This deactivates the venue immediately. Optionally provide a reason.</p>
            <input
              autoFocus
              className="w-full rounded-xl border border-line bg-zinc-50 px-4 py-2.5 text-sm text-foreground outline-none focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Reason (optional)"
              value={suspendReason}
            />
            <button
              className="flex w-full items-center justify-center rounded-xl bg-foreground py-3 text-sm font-semibold text-white transition hover:opacity-80 disabled:opacity-50"
              disabled={isPending}
              onClick={() => runAction(suspendVenue, { reason: suspendReason })}
              type="button"
            >
              {isPending ? "Confirming…" : "Confirm suspension"}
            </button>
            <button
              className="w-full text-center text-xs text-muted hover:text-foreground"
              onClick={() => setView("actions")}
              type="button"
            >
              Cancel
            </button>
          </div>
        )}

        {venue.status === "suspended" && view !== "suspend" && (
          <button
            className="flex w-full items-center justify-center rounded-xl border border-amber-300 bg-amber-100 py-3 text-sm font-semibold text-amber-900 transition hover:bg-amber-200 disabled:opacity-50"
            disabled={isPending}
            onClick={() => runAction(activateVenue)}
            type="button"
          >
            {isPending ? "Reactivating…" : "Reactivate venue"}
          </button>
        )}
      </div>

      <div className="mt-6 border-t border-line pt-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted">Current status</p>
        <StatusBadge status={venue.status} />
      </div>
    </Panel>
  );
}

// ─── Contact venue (email, template picker) ────────────────────────────────────

function ContactVenuePanel({ contactLog, venue }: { contactLog: VenueContactLogEntry[]; venue: AdminVenueDetail }) {
  const [templateId, setTemplateId] = useState<VenueContactTemplateId>("custom");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isPending, startAction] = useTransition();
  const [showLog, setShowLog] = useState(false);

  function pickTemplate(id: VenueContactTemplateId) {
    setTemplateId(id);
    const template = getVenueContactTemplate(id);
    setSubject(template.subject);
    setBody(template.body(venue.name));
  }

  function handleSend() {
    if (!subject.trim() || !body.trim()) return;
    startAction(async () => {
      const fd = new FormData();
      fd.set("venueId", venue.id);
      fd.set("template", templateId);
      fd.set("subject", subject);
      fd.set("message", body);
      await contactVenue(fd);
    });
  }

  return (
    <Panel description="Send an email directly to this venue's contact address." title="Contact venue">
      <div className="grid gap-4">
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">Template</p>
          <div className="flex flex-wrap gap-2">
            {VENUE_CONTACT_TEMPLATES.map((t) => (
              <button
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  templateId === t.id
                    ? "bg-foreground text-white"
                    : "border border-line text-muted hover:bg-zinc-50 hover:text-foreground"
                }`}
                key={t.id}
                onClick={() => pickTemplate(t.id)}
                type="button"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <label className="grid gap-1.5 text-sm font-medium text-foreground">
          Subject
          <input
            className="rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-foreground outline-none focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject"
            value={subject}
          />
        </label>

        <label className="grid gap-1.5 text-sm font-medium text-foreground">
          Message
          <textarea
            className="min-h-40 resize-none rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-foreground outline-none focus:border-foreground/30 focus:ring-2 focus:ring-foreground/10"
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message…"
            value={body}
          />
        </label>

        <p className="text-xs text-muted">Sending to: {venue.contactEmail || "no email on file"}</p>

        <button
          className="w-full rounded-xl bg-foreground py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          disabled={isPending || !subject.trim() || !body.trim() || !venue.contactEmail}
          onClick={handleSend}
          type="button"
        >
          {isPending ? "Sending…" : "Send email"}
        </button>
      </div>

      {contactLog.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <button
            className="text-xs font-medium text-muted hover:text-foreground"
            onClick={() => setShowLog((v) => !v)}
            type="button"
          >
            {showLog ? "Hide" : "Show"} contact history ({contactLog.length})
          </button>
          {showLog && (
            <div className="mt-3 space-y-3">
              {contactLog.map((c) => (
                <div className="rounded-lg border border-line bg-zinc-50 p-3" key={c.id}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-foreground">{c.subject}</p>
                    <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted">
                      {TEMPLATE_LABEL[c.template]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{formatDateTime(c.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

// ─── Billing summary (Stripe placeholder) ──────────────────────────────────────

function BillingSummaryPanel({ venue }: { venue: AdminVenueDetail }) {
  const hasStripe = !!venue.stripeCustomerId && !venue.stripeCustomerId.startsWith("sample_");

  return (
    <Panel description="Monthly / annual payment history for this venue." title="Billing summary">
      {hasStripe ? (
        <p className="text-sm text-muted">Billing history will appear here once loaded from Stripe.</p>
      ) : (
        <div className="rounded-lg border border-dashed border-line bg-zinc-50 px-4 py-6 text-center">
          <p className="text-sm font-medium text-foreground">Not connected to Stripe yet</p>
          <p className="mt-1 text-xs text-muted">
            This venue's payment history will show here once real Stripe billing is wired up.
          </p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-3">
        <DetailField label="Plan" value={formatPlan(venue.billingPlan)} />
        <DetailField label="Cadence" value={venue.billingCadence === "annual" ? "Annual" : "Monthly"} />
        <DetailField label="Billing status" value={venue.billingStatus} />
        {venue.cancellationRequestedAt && (
          <DetailField label="Cancellation requested" value={formatDate(venue.cancellationRequestedAt)} />
        )}
        {venue.subscriptionEndsAt && (
          <DetailField label="Subscription ends" value={formatDate(venue.subscriptionEndsAt)} />
        )}
      </div>
    </Panel>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────────

export default function VenueDetailPage({
  contactLog,
  message,
  venue,
}: {
  contactLog: VenueContactLogEntry[];
  message?: string;
  venue: AdminVenueDetail | null;
}) {
  if (!venue) {
    return (
      <PageShell
        activePath="/masterdashboard"
        eyebrow="Platform admin"
        title="Venue not found"
        actions={<SecondaryLink href="/masterdashboard">Back to venues</SecondaryLink>}
      >
        <Panel>
          <p className="text-sm text-muted">This venue may have been removed.</p>
        </Panel>
      </PageShell>
    );
  }

  return (
    <PageShell
      activePath="/masterdashboard"
      eyebrow="Platform admin"
      title={venue.name}
      description={venue.contactEmail}
      actions={<SecondaryLink href="/masterdashboard">Back to venues</SecondaryLink>}
    >
      {message ? (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3.5 text-sm font-medium text-foreground shadow-sm">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground text-xs text-white">✓</span>
          {message}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Panel title="Venue details">
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
              <DetailField label="Address" value={[venue.address, venue.city, venue.postalCode].filter(Boolean).join(", ")} />
              <DetailField
                label="Capacity"
                value={
                  venue.hangerCapacity || venue.bagCapacity
                    ? `${venue.hangerCapacity} hangers · ${venue.bagCapacity} bags`
                    : venue.capacity
                      ? `${venue.capacity} slots`
                      : "—"
                }
              />
              <DetailField label="Devices" value={`${1 + venue.extraDevices} total (${venue.extraDevices} extra)`} />
              <DetailField label="Country" value={venue.country ?? "—"} />
              <DetailField label="Signed up" value={formatDate(venue.createdAt)} />
              {venue.contactPhone && <DetailField label="Phone" value={venue.contactPhone} />}
            </div>
          </Panel>

          <BillingSummaryPanel venue={venue} />

          <ContactVenuePanel contactLog={contactLog} venue={venue} />
        </div>

        <div className="space-y-5">
          <VenueActionsPanel venue={venue} />
        </div>
      </div>
    </PageShell>
  );
}
