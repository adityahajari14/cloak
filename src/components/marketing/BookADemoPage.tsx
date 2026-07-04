import Link from "next/link";
import { submitDemoRequest } from "@/app/book-a-demo/actions";
import PublicHeader from "@/components/shared/PublicHeader";

const input =
  "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-zinc-400 focus:border-foreground/40 focus:ring-2 focus:ring-foreground/8";

const timeSlots = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00",
];

export default function BookADemoPage({
  error,
  success,
}: {
  error?: string;
  success?: boolean;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />

      <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-12 sm:px-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-muted">Book a Demo</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">See Cloak in action</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Book a 20-minute demo call and we&apos;ll walk you through how Cloak works for your venue. Pick a date and time that suits you.
          </p>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl">✓</span>
            <div>
              <p className="font-semibold text-emerald-800">Demo request received</p>
              <p className="mt-1 text-sm text-emerald-700">
                We&apos;ll confirm your booking within one business day. In the meantime, you can{" "}
                <Link className="font-medium underline" href="/venuesignup">
                  register your venue directly
                </Link>
                .
              </p>
            </div>
            <Link
              className="mt-2 rounded-lg bg-foreground px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              href="/"
            >
              Back to home
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-panel p-6">
            {error && (
              <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <form action={submitDemoRequest} className="grid gap-5">
              {/* Venue & contact */}
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium text-foreground">
                  Venue name <span className="text-red-500">*</span>
                  <input
                    className={input}
                    name="venueName"
                    placeholder="e.g. The Grand Ballroom"
                    required
                    type="text"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-foreground">
                  Your name <span className="text-red-500">*</span>
                  <input
                    className={input}
                    name="contactName"
                    placeholder="Full name"
                    required
                    type="text"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-foreground">
                  Email address <span className="text-red-500">*</span>
                  <input
                    className={input}
                    name="email"
                    placeholder="you@venue.com"
                    required
                    type="email"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-foreground">
                  Mobile number
                  <input
                    className={input}
                    name="phone"
                    placeholder="+44 7700 900000"
                    type="tel"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-foreground">
                  Typical capacity
                  <input
                    className={input}
                    name="capacity"
                    placeholder="e.g. 200 items per night"
                    type="text"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium text-foreground">
                  Country
                  <select className={input} defaultValue="United Kingdom" name="country">
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="United Arab Emirates">United Arab Emirates</option>
                  </select>
                </label>
              </div>

              {/* Date & time picker */}
              <div className="rounded-lg border border-line bg-zinc-50 p-4">
                <p className="mb-3 text-sm font-semibold text-foreground">Preferred demo date &amp; time</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm font-medium text-foreground">
                    Date
                    <input
                      className={input}
                      name="preferredDate"
                      type="date"
                      min={new Date(Date.now() + 86400000).toISOString().split("T")[0]}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium text-foreground">
                    Time (GMT)
                    <select className={input} name="preferredTime" defaultValue="">
                      <option value="" disabled>Select a time</option>
                      {timeSlots.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="mt-2 text-xs text-muted">We&apos;ll confirm availability and send a calendar invite.</p>
              </div>

              {/* Message */}
              <label className="grid gap-1.5 text-sm font-medium text-foreground">
                Anything you&apos;d like us to know?
                <textarea
                  className={`${input} min-h-24 resize-none`}
                  name="message"
                  placeholder="Tell us about your venue setup, events, or any questions…"
                />
              </label>

              <button
                className="w-full rounded-xl bg-foreground py-3 text-sm font-semibold text-white transition hover:opacity-90"
                type="submit"
              >
                Book my demo
              </button>
              <p className="text-center text-xs text-muted">
                Or skip this and{" "}
                <Link className="font-medium text-foreground hover:underline" href="/venuesignup">
                  register your venue directly
                </Link>
                .
              </p>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
