"use client";

import Link from "next/link";
import { useState } from "react";
import { selectVenuePlan } from "@/app/venuesignup/actions";
import { MONTHLY_PLAN_PRICES, venuePlans, type VenuePlanId } from "@/lib/venues";
import { useFormStatus } from "react-dom";

function PlanButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="mt-auto w-full rounded-xl bg-foreground py-2.5 text-sm font-semibold text-white transition hover:opacity-85 disabled:opacity-50"
      disabled={pending}
      type="submit"
    >
      {pending ? "Selecting…" : "Select plan"}
    </button>
  );
}

const checkIcon = (
  <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
    <path clipRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" fillRule="evenodd" />
  </svg>
);

function planPrice(planId: VenuePlanId, annual: boolean): { main: string; sub: string | null } {
  const monthly = MONTHLY_PLAN_PRICES[planId];

  // Per-event plan is not a subscription — no annual toggle
  if (monthly === undefined) {
    return { main: "£399 / event", sub: null };
  }

  if (!annual) {
    return { main: `£${monthly} / month`, sub: null };
  }

  // Pay 11 months, get 12 — 1 month free
  const annualTotal = monthly * 11;
  const monthlyEquiv = (annualTotal / 12).toFixed(2).replace(/\.00$/, "");
  return {
    main: `£${monthlyEquiv} / month`,
    sub: `billed annually as £${annualTotal}/yr`,
  };
}

export default function PlanPreview({ error }: { error?: string }) {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="grid gap-6">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>
      )}

      {/* Billing cadence toggle */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1 rounded-xl border border-line bg-zinc-100 p-1">
          <button
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
              !annual ? "bg-white text-foreground shadow-sm" : "text-muted hover:text-foreground"
            }`}
            onClick={() => setAnnual(false)}
            type="button"
          >
            Monthly
          </button>
          <button
            className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition ${
              annual ? "bg-white text-foreground shadow-sm" : "text-muted hover:text-foreground"
            }`}
            onClick={() => setAnnual(true)}
            type="button"
          >
            Annual
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              1 month free
            </span>
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Regular plans */}
        {venuePlans.map((plan) => {
          const { main, sub } = planPrice(plan.id, annual);
          return (
            <div
              className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-6 shadow-sm"
              key={plan.id}
            >
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-muted">{plan.name}</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{main}</p>
                {sub ? (
                  <p className="mt-1 text-xs text-muted">{sub}</p>
                ) : (
                  <div className="mt-1 h-4" />
                )}
                <p className="mt-2 text-sm leading-6 text-muted">{plan.description}</p>
              </div>
              <div className="flex gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-zinc-50 px-3 py-1 text-xs font-medium text-foreground">
                  <svg className="h-3 w-3 text-muted" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points="9 22 9 12 15 12 15 22" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {plan.venues}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-zinc-50 px-3 py-1 text-xs font-medium text-foreground">
                  <svg className="h-3 w-3 text-muted" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <rect height="14" rx="2" width="14" x="5" y="5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9 9h6M9 12h6M9 15h4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {plan.devices}
                </span>
              </div>
              <ul className="flex flex-col gap-2 text-sm text-foreground">
                {plan.features.map((f) => (
                  <li className="flex items-start gap-2" key={f}>
                    {checkIcon}
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {annual && plan.id !== "per_event" && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2">
                  <svg className="h-3.5 w-3.5 shrink-0 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                    <path clipRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" fillRule="evenodd" />
                  </svg>
                  <p className="text-xs font-medium text-emerald-700">Includes 1 month free</p>
                </div>
              )}
              <form action={selectVenuePlan} className="mt-auto">
                <input name="plan" type="hidden" value={plan.id} />
                <input
                  name="billingCadence"
                  type="hidden"
                  value={plan.id === "per_event" ? "monthly" : annual ? "annual" : "monthly"}
                />
                <PlanButton />
              </form>
            </div>
          );
        })}

        {/* Enterprise card */}
        <div className="flex flex-col gap-4 rounded-2xl border-2 border-foreground bg-foreground p-6 shadow-sm">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-white/60">Enterprise</p>
            <p className="mt-2 text-2xl font-bold text-white">Tell us more</p>
            <div className="mt-1 h-4" />
            <p className="mt-2 text-sm leading-6 text-white/65">
              For clients operating more than 3 venues. Custom pricing, dedicated support, and tailored onboarding.
            </p>
          </div>
          <div className="flex gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
              <svg className="h-3 w-3 text-white/50" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="9 22 9 12 15 12 15 22" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Unlimited venues
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
              <svg className="h-3 w-3 text-white/50" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <rect height="14" rx="2" width="14" x="5" y="5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 9h6M9 12h6M9 15h4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Custom devices
            </span>
          </div>
          <ul className="flex flex-col gap-2 text-sm text-white/80">
            {[
              "Unlimited venues",
              "Dedicated account manager",
              "Custom integrations",
              "Priority support",
            ].map((f) => (
              <li className="flex items-start gap-2" key={f}>
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path clipRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" fillRule="evenodd" />
                </svg>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Link
            className="mt-auto w-full rounded-xl border border-white/30 bg-white/10 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-white/20"
            href="/book-a-demo"
          >
            Book a call
          </Link>
        </div>
      </div>
    </div>
  );
}
