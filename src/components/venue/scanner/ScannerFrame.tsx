"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { handleScannerAction, searchPendingTickets, type PendingTicketSuggestion } from "@/app/venuescanner/actions";
import { initialScannerState, type ScannerTicket } from "@/app/venuescanner/types";
import CameraScanner from "./CameraScanner";
import { ActivationForm, CheckoutForm, GuestCard, StorageLocationCard } from "./TicketActionForms";

const AUTO_RESET_MS = 5000;
const FLASH_DURATION_MS = 1500;

/**
 * True when the guest has items sitting in the cloakroom with a slot assigned.
 *
 * The scanner auto-returns to the camera after a success, which is right for a
 * checkout (nothing left to read) but wrong the moment items go INTO storage:
 * staff have to read the hanger/bag number off the screen before they can put
 * the coat anywhere. Those results stay up until they're explicitly dismissed.
 */
function hasStorageToShow(ticket: ScannerTicket | undefined): boolean {
  if (!ticket) return false;
  if (ticket.items.some((i) => !i.collected && i.storageLocation)) return true;
  // Legacy tickets predate per-item slot rows.
  return ticket.items.length === 0 && Boolean(ticket.storageLocation);
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ScannerFrame({ venueId }: { venueId?: string }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, formAction, pending] = useActionState(handleScannerAction, initialScannerState);
  const [flashTone, setFlashTone] = useState<"success" | "error" | null>(null);
  const [suggestions, setSuggestions] = useState<PendingTicketSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  // On mobile/tablet the camera takes over the full screen; the manual-entry
  // form stays mounted underneath (so its state and the suggestions dropdown
  // keep working) but is only revealed there once staff tap "Enter code
  // manually" in the overlay. Desktop always shows it alongside the camera.
  const [manualEntryOpen, setManualEntryOpen] = useState(false);

  const successTicket = state.status === "success" && "ticket" in state ? state.ticket : undefined;
  const showsStorage = hasStorageToShow(successTicket);

  useEffect(() => {
    if (state.status === "success") {
      setFlashTone("success");
      setTimeout(() => setFlashTone(null), FLASH_DURATION_MS);

      // Items just went into storage — hold the slot numbers on screen until
      // staff dismiss them. Auto-clearing here loses the only record of where
      // the coat is supposed to go.
      if (!showsStorage) {
        resetTimerRef.current = setTimeout(() => {
          const fd = new FormData();
          fd.set("_action", "reset");
          startTransition(() => formAction(fd));
          if (inputRef.current) inputRef.current.value = "";
        }, AUTO_RESET_MS);
      }
    } else if (state.status === "error") {
      setFlashTone("error");
      setTimeout(() => setFlashTone(null), FLASH_DURATION_MS);
    }
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, [state.status, state.message, formAction, showsStorage]);

  function handleCameraDetection(value: string) {
    if (inputRef.current) inputRef.current.value = value;
    setSuggestions([]);
    setShowSuggestions(false);
    const fd = new FormData();
    fd.set("_action", "lookup");
    fd.set("lookupValue", value);
    if (venueId) fd.set("venueId", venueId);
    startTransition(() => formAction(fd));
  }

  function handleInputChange(value: string) {
    if (inputRef.current) inputRef.current.value = value.toUpperCase();
    const query = value.trim();
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      const results = await searchPendingTickets(query, venueId);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    }, 200);
  }

  function pickSuggestion(suggestion: PendingTicketSuggestion) {
    if (inputRef.current) inputRef.current.value = suggestion.publicCode;
    setSuggestions([]);
    setShowSuggestions(false);
    const fd = new FormData();
    fd.set("_action", "lookup");
    fd.set("lookupValue", suggestion.publicCode);
    if (venueId) fd.set("venueId", venueId);
    startTransition(() => formAction(fd));
  }

  const ticket = "ticket" in state ? state.ticket : undefined;
  const isActivation = state.status === "ready" && state.intent === "activation";
  const isCheckout = state.status === "ready" && state.intent === "checkout";
  const isSuccess = state.status === "success";
  const isError = state.status === "error";

  // A resolved ticket is a distinct full-screen step: the camera is fully torn
  // down (not just hidden) and replaced by a dedicated ticket screen, on both
  // mobile and desktop — scanning and acting on a ticket never share a view.
  const ticketReady = (isActivation || isCheckout) && ticket;

  // Items were just stored: this gets its own full step too, because the slot
  // numbers on it are what the staff member has to act on next.
  const storageReady = isSuccess && showsStorage && ticket;

  function scanAgain() {
    const fd = new FormData();
    fd.set("_action", "reset");
    startTransition(() => formAction(fd));
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="relative">
      {/* Full-bleed flash overlay */}
      {flashTone && (
        <div
          className={`pointer-events-none fixed inset-0 z-50 transition-opacity duration-300 ${
            flashTone === "success" ? "bg-emerald-400/30" : "bg-red-400/30"
          }`}
        />
      )}

      {storageReady ? (
        // ── Storage result — stays up until dismissed ─────────────────────────
        <div className="mx-auto max-w-lg space-y-4">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {state.message}
          </div>

          <StorageLocationCard ticket={ticket} />

          <div className="flex gap-3">
            <Link
              className="flex flex-1 items-center justify-center rounded-xl border border-line bg-white px-6 py-3.5 text-sm font-semibold text-foreground transition active:scale-[0.98] hover:bg-zinc-50"
              href="/venuedashboard"
              prefetch
            >
              ← Dashboard
            </Link>
            <button
              className="flex-1 rounded-xl bg-foreground px-6 py-3.5 text-sm font-semibold text-white transition hover:opacity-90"
              onClick={scanAgain}
              type="button"
            >
              Done — scan next guest
            </button>
          </div>
        </div>
      ) : ticketReady ? (
        // ── Dedicated ticket screen — fully replaces the camera view ──────────
        <div className="mx-auto max-w-lg space-y-4">
          <button
            className="flex items-center gap-1 text-xs font-medium text-muted hover:text-foreground"
            onClick={scanAgain}
            type="button"
          >
            ← Back to scanner
          </button>

          <GuestCard ticket={ticket} />

          <div className="rounded-xl border border-line bg-zinc-50 p-4 sm:p-5">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted">
              {isActivation ? "Record items" : "Return or add items"}
            </p>
            {isActivation ? (
              <ActivationForm formAction={formAction} pending={pending} ticket={ticket} venueId={venueId} />
            ) : (
              <CheckoutForm formAction={formAction} pending={pending} ticket={ticket} venueId={venueId} />
            )}
          </div>
        </div>
      ) : (
        // ── Scanner screen — camera + code input ──────────────────────────────
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="lg:space-y-4">
            <CameraScanner
              disabled={pending}
              onDetected={handleCameraDetection}
              onManualEntry={() => {
                setManualEntryOpen(true);
                setTimeout(() => inputRef.current?.focus(), 0);
              }}
            />

            {/* Mobile/tablet: manual entry floats above the full-screen camera as a
                bottom sheet, only once staff ask for it. Desktop: always shown
                inline next to the camera box, no overlay behavior. */}
            {manualEntryOpen && (
              <div
                className="fixed inset-0 z-50 bg-black/50 lg:hidden"
                onClick={() => setManualEntryOpen(false)}
              />
            )}
            <div
              className={
                manualEntryOpen
                  ? "fixed inset-x-0 bottom-0 z-50 space-y-4 rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl lg:static lg:z-auto lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none"
                  : "hidden space-y-4 lg:block"
              }
            >
              {manualEntryOpen && (
                <div className="flex items-center justify-between lg:hidden">
                  <p className="text-sm font-semibold text-foreground">Enter code manually</p>
                  <button
                    className="rounded-lg p-1.5 text-muted hover:bg-zinc-100 hover:text-foreground"
                    onClick={() => setManualEntryOpen(false)}
                    type="button"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              )}
              <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
                <input name="_action" type="hidden" value="lookup" />
                {venueId && <input name="venueId" type="hidden" value={venueId} />}
                <div className="relative min-w-0 flex-1">
                  <input
                    autoCapitalize="characters"
                    autoComplete="off"
                    className="w-full rounded-xl border border-line bg-white px-4 py-3.5 text-base font-mono uppercase text-foreground outline-none placeholder:text-muted placeholder:normal-case placeholder:font-sans placeholder:text-sm focus:border-foreground/30 transition"
                    name="lookupValue"
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onFocus={(e) => { if (e.target.value.trim().length >= 2 && suggestions.length > 0) setShowSuggestions(true); }}
                    placeholder="Paste QR link or enter CLK-… code"
                    ref={inputRef}
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-line bg-white shadow-lg">
                      {suggestions.map((s) => (
                        <button
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-zinc-50"
                          key={s.id}
                          onMouseDown={() => pickSuggestion(s)}
                          type="button"
                        >
                          <span className="font-mono text-sm font-semibold text-foreground">{s.publicCode}</span>
                          <span className="text-sm text-muted">{s.guestName}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  className="rounded-xl bg-foreground px-6 py-3.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                  disabled={pending}
                  type="submit"
                >
                  Verify
                </button>
              </form>

              {isError && state.message ? (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {state.message}
                </div>
              ) : null}

              {/* Checkouts only — a storage result takes over the whole view above
                  and waits to be dismissed. */}
              {isSuccess && state.message ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {state.message}
                  </div>
                  {ticket ? <GuestCard ticket={ticket} /> : null}
                  <p className="text-center text-xs text-muted">Scanner resets automatically…</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="hidden rounded-xl border border-line bg-zinc-50 p-6 lg:block">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Waiting for scan
            </p>
            <div className="mt-5 space-y-4">
              {[
                { desc: "Record items and confirm activation.", label: "Pending pass" },
                { desc: "Confirm guest has received their item.", label: "Active pass" },
                { desc: "Wrong venue, expired, or already collected.", label: "Blocked" },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

