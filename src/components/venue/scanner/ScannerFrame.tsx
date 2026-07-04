"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { handleScannerAction, searchPendingTickets, type PendingTicketSuggestion } from "@/app/venuescanner/actions";
import { initialScannerState } from "@/app/venuescanner/types";
import CameraScanner from "./CameraScanner";
import { ActivationForm, CheckoutForm, GuestCard } from "./TicketActionForms";

const AUTO_RESET_MS = 5000;
const FLASH_DURATION_MS = 1500;

// ─── Main component ───────────────────────────────────────────────────────────

export default function ScannerFrame({ venueId }: { venueId?: string }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, formAction, pending] = useActionState(handleScannerAction, initialScannerState);
  const [flashTone, setFlashTone] = useState<"success" | "error" | null>(null);
  const [suggestions, setSuggestions] = useState<PendingTicketSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (state.status === "success") {
      setFlashTone("success");
      setTimeout(() => setFlashTone(null), FLASH_DURATION_MS);
      resetTimerRef.current = setTimeout(() => {
        const fd = new FormData();
        fd.set("_action", "reset");
        startTransition(() => formAction(fd));
        if (inputRef.current) inputRef.current.value = "";
      }, AUTO_RESET_MS);
    } else if (state.status === "error") {
      setFlashTone("error");
      setTimeout(() => setFlashTone(null), FLASH_DURATION_MS);
    }
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, [state.status, state.message, formAction]);

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

      {ticketReady ? (
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
          <div className="space-y-4">
            <CameraScanner disabled={pending} onDetected={handleCameraDetection} />

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

