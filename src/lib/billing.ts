/**
 * Venue subscription cancellation policy.
 *
 * Every venue commits to a 1-year minimum term from their signup date
 * (created_at), regardless of billing cadence:
 *
 * - Within the first year: service continues until the 1-year anniversary
 *   of signup, no matter when cancellation is requested. Monthly payers
 *   keep being billed each month until then (or can pay the remainder up
 *   front to stop early). Annual payers already paid for the year, so
 *   there's nothing more to bill — they just wait it out.
 *
 * - After the first year: annual payers finish out the already-paid annual
 *   period they're currently in. Monthly payers stop at their monthly
 *   billing anchor date (the day-of-month they signed up on) — advanced by
 *   one cycle if that anchor date in the current cycle has already passed
 *   (i.e. they've already been charged for the upcoming period).
 */

export type BillingCadence = "monthly" | "annual";

export type CancellationPlan = {
  /** The date service actually stops, as a Date at 00:00 local. */
  effectiveEndDate: Date;
  /** Whether the venue is still within its first committed year. */
  withinFirstYear: boolean;
  /** Only meaningful when withinFirstYear && cadence === "monthly". */
  canPayRemainder: boolean;
  /** Number of remaining monthly charges if billing continues to the anniversary. */
  remainingMonthlyCharges: number;
};

function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * The billing anchor date that falls within the same calendar month as
 * `monthStart` (any date in the target month), clamped to that month's last
 * day if the anchor day-of-month doesn't exist there (e.g. anchor 31 in a
 * 30-day month), matching how card billing processors typically roll over.
 */
function anchorInMonth(signupDate: Date, monthStart: Date): Date {
  const anchorDay = signupDate.getDate();
  const candidate = new Date(monthStart.getFullYear(), monthStart.getMonth(), anchorDay);
  if (candidate.getMonth() !== monthStart.getMonth()) {
    candidate.setDate(0); // rolled over — pull back to the last real day of the intended month
  }
  return candidate;
}

/** The next occurrence of the signup day-of-month, at or after `from`. */
function nextMonthlyAnchor(signupDate: Date, from: Date): Date {
  let candidate = anchorInMonth(signupDate, from);
  while (candidate < from) {
    candidate = anchorInMonth(signupDate, addMonths(candidate, 1));
  }
  return candidate;
}

function countMonthsBetween(from: Date, to: Date): number {
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return Math.max(months, 0);
}

export function planCancellation({
  cadence,
  signupDate,
  today = new Date(),
}: {
  cadence: BillingCadence;
  signupDate: Date;
  today?: Date;
}): CancellationPlan {
  const signup = startOfDay(signupDate);
  const now = startOfDay(today);
  const oneYearAnniversary = addYears(signup, 1);
  const withinFirstYear = now < oneYearAnniversary;

  if (withinFirstYear) {
    // Both cadences: service runs until the 1-year anniversary regardless of
    // when cancellation is requested. Monthly payers may optionally pay the
    // remainder now instead of being billed each month until then.
    const remainingMonthlyCharges =
      cadence === "monthly" ? countMonthsBetween(now, oneYearAnniversary) : 0;
    return {
      canPayRemainder: cadence === "monthly",
      effectiveEndDate: oneYearAnniversary,
      remainingMonthlyCharges,
      withinFirstYear: true,
    };
  }

  if (cadence === "annual") {
    // Already past the first year — now on a rolling annual renewal. Finish
    // out the annual period currently paid for: the next anniversary after
    // (or equal to) today, computed from the original signup date.
    let periodEnd = oneYearAnniversary;
    while (periodEnd <= now) {
      periodEnd = addYears(periodEnd, 1);
    }
    return {
      canPayRemainder: false,
      effectiveEndDate: periodEnd,
      remainingMonthlyCharges: 0,
      withinFirstYear: false,
    };
  }

  // Monthly, past the first year: stop at the next monthly anchor date.
  // If the anchor date in the current cycle is today or already passed,
  // that charge has already gone out, so service runs one more cycle.
  const anchorThisCycle = nextMonthlyAnchor(signup, now);
  const effectiveEndDate =
    anchorThisCycle.getTime() === now.getTime() ? addMonths(anchorThisCycle, 1) : anchorThisCycle;

  return {
    canPayRemainder: false,
    effectiveEndDate,
    remainingMonthlyCharges: 0,
    withinFirstYear: false,
  };
}

export function formatCancellationMessage(plan: CancellationPlan, cadence: BillingCadence): string {
  const dateStr = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(
    plan.effectiveEndDate,
  );

  if (plan.withinFirstYear) {
    if (cadence === "annual") {
      return `You've already paid for your first year. Your subscription will end on ${dateStr}, the 1-year anniversary of your signup.`;
    }
    return `Your plan commits to a 1-year minimum term. Your subscription will end on ${dateStr} — we'll continue billing you monthly until then, unless you choose to pay the remaining balance now.`;
  }

  if (cadence === "annual") {
    return `You've already paid for your current annual period. Your subscription will end on ${dateStr}.`;
  }

  return `Your subscription will end on ${dateStr}, the end of your current billing month.`;
}
