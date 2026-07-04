"use client";

import { useState } from "react";
import Link from "next/link";
import { createGuestTicket } from "@/app/customer-signup/actions";
import SubmitButton from "@/components/shared/SubmitButton";
import PhoneInput from "@/components/shared/PhoneInput";
import EmailInput from "@/components/shared/EmailInput";
import type { PublicVenueOption } from "@/lib/tickets";
import type { PublicEventOption } from "@/lib/events";

const inputClass =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-zinc-400 focus:border-foreground/40 focus:ring-2 focus:ring-foreground/8";

const selectClass =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-foreground/40 focus:ring-2 focus:ring-foreground/8 appearance-none cursor-pointer";

export default function GuestFormPreview({
  defaultEventId,
  defaultVenueId,
  error,
  eventsByVenue,
  venues,
}: {
  defaultEventId?: string;
  defaultVenueId?: string;
  error?: string;
  eventsByVenue: Record<string, PublicEventOption[]>;
  venues: PublicVenueOption[];
}) {
  const hasVenues = venues.length > 0;
  const venueIsLocked = !!(defaultVenueId && venues.some((v) => v.id === defaultVenueId));
  const initialId = venueIsLocked
    ? defaultVenueId!
    : (venues[0]?.id ?? "");
  const [selectedId, setSelectedId] = useState<string>(initialId);
  const selectedVenue = venues.find((v) => v.id === selectedId);
  const venueEvents = eventsByVenue[selectedId] ?? [];

  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
      <form action={createGuestTicket} className="grid gap-5">

        {/* Venue select */}
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-foreground" htmlFor="venue-select">
            Venue
          </label>
          <div className="relative">
            <select
              className={selectClass}
              disabled={!hasVenues || venueIsLocked}
              id="venue-select"
              name="venue"
              onChange={(e) => setSelectedId(e.target.value)}
              required
              value={selectedId}
            >
              {hasVenues ? (
                venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.label}
                  </option>
                ))
              ) : (
                <option value="">No approved venues available</option>
              )}
            </select>
            {!venueIsLocked && (
              <svg
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          {selectedVenue?.address && (
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {selectedVenue.address}
            </p>
          )}
        </div>

        {/* Event select — only when the chosen venue is running events */}
        {venueEvents.length > 0 && (
          <div className="grid gap-2">
            <label className="text-sm font-semibold text-foreground" htmlFor="event-select">
              Event <span className="font-normal text-muted">(optional)</span>
            </label>
            <div className="relative">
              <select className={selectClass} defaultValue={defaultEventId ?? ""} id="event-select" name="event">
                <option value="">No specific event</option>
                {venueEvents.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
              <svg
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        )}

        {!hasVenues ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-medium text-amber-700">
              Guest check-in will be available once an approved venue is active.
            </p>
          </div>
        ) : null}

        {/* Name */}
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-foreground" htmlFor="full-name">
            Full name
          </label>
          <input
            className={inputClass}
            id="full-name"
            name="fullName"
            placeholder="Enter your full name"
            required
            type="text"
          />
        </div>

        {/* Email */}
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-foreground" htmlFor="email">
            Email
          </label>
          <EmailInput className={inputClass} id="email" name="email" required />
        </div>

        {/* Mobile */}
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-foreground" htmlFor="mobile">
            Mobile
          </label>
          <PhoneInput id="mobile" name="mobile" placeholder="7700 900000" required />
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-medium text-red-700">{error}</p>
          </div>
        ) : null}

        <SubmitButton disabled={!hasVenues}>
          Get my pass — it&apos;s free
        </SubmitButton>

        <p className="text-center text-xs leading-5 text-muted">
          Your details are used only to create a cloakroom pass for this visit.
        </p>
      </form>

      {/* Cloak Club upsell — permanent pass for any venue */}
      <Link
        className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-zinc-50 px-4 py-3 transition hover:border-foreground/30 hover:bg-white"
        href="/cloak-club"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-base">
          ✨
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">
            Want a pass for every visit?
          </span>
          <span className="block text-xs text-muted">
            Join Cloak Club free — one permanent wallet pass for any venue.
          </span>
        </span>
        <svg className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </div>
  );
}
