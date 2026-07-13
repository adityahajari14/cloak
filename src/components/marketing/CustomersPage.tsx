import Link from "next/link";
import Image from "next/image";
import PublicHeader from "@/components/shared/PublicHeader";
import PublicFooter from "@/components/shared/PublicFooter";

const heroImg = "/images/customers-hero.webp";
const qrImage = "/images/qr-pass-hand.png";

const howItWorksSteps = [
  {
    num: "01",
    title: "Visit your venue's Cloak link",
    description: "Your venue shares a Cloak check-in link. Open it on your phone — no app download, no account needed.",
  },
  {
    num: "02",
    title: "Enter your details and get your QR pass",
    description: "Fill in your name and contact info. You'll receive a venue-bound QR ticket instantly, right on your phone.",
  },
  {
    num: "03",
    title: "Add it to Apple or Google Wallet",
    description: "Save your permanent Cloak QR ticket to your mobile wallet. It lives there forever — ready to use at any Cloak venue.",
  },
  {
    num: "04",
    title: "Scan at the counter to drop off and collect",
    description: "Show your QR code at the cloakroom. Staff scan to log your items at drop-off and again at collection. Done.",
  },
];

const customerBenefits = [
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    heading: "Never lose your ticket again",
    body: "Your QR pass lives in your phone's wallet — not on a scrap of paper that gets lost in your pocket at 2am.",
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    heading: "Always available in your mobile wallet",
    body: "Access your Cloak pass from Apple Wallet or Google Wallet without opening a browser or app — even offline.",
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    heading: "Works at any Cloak venue",
    body: "One permanent QR pass. Use it at every Cloak-enabled venue — no re-registration, no new tickets each time.",
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    heading: "Exclusive discount offers",
    body: "Cloak members get access to exclusive deals and offers from partner venues — perks for going paperless.",
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    heading: "Faster counter experience",
    body: "No waiting for staff to write out a ticket. Your QR code is scanned in seconds — spend less time at the counter, more time at the event.",
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    heading: "Full dispute protection",
    body: "Every drop-off is logged with items, count, and timestamp. If anything is ever questioned, you have a digital record.",
  },
];

export default function CustomersPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />

      <main>

        {/* ── Hero ─────────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-zinc-950">
          <Image
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
            fill
            priority
            quality={90}
            src={heroImg}
          />
          <div className="absolute inset-0 bg-linear-to-r from-zinc-950/85 via-zinc-950/50 to-zinc-950/10" />
          <div className="absolute inset-0 bg-linear-to-t from-zinc-950/60 via-transparent to-transparent" />
          <div className="relative mx-auto flex min-h-[80svh] w-full max-w-7xl flex-col justify-end pb-20 px-4 sm:px-6 lg:justify-center lg:pb-0 lg:py-24 lg:px-8">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-xs font-semibold tracking-wide text-white/75">For event-goers &amp; guests</span>
              </span>
              <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl lg:text-7xl">
                Your cloakroom ticket,<br />
                <span className="text-white/55">in your wallet. Forever.</span>
              </h1>
              <p className="mt-5 max-w-md text-sm leading-7 text-white/70 sm:text-base">
                Add your permanent Cloak QR ticket to Apple or Google Wallet and use it at any Cloak venue, any time — for free. No paper. No stress.
              </p>
              {/* The hero sells the permanent wallet pass, so the primary action
                  is Cloak Club. Checking in for a single visit stays available
                  for a guest who's standing at a counter right now. */}
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-zinc-900 shadow-lg transition hover:bg-zinc-100 active:scale-95"
                  href="/cloak-club"
                >
                  Get my free lifetime pass
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
                <Link
                  className="inline-flex items-center justify-center rounded-xl border border-white/25 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10 active:scale-95"
                  href="/customer-signup"
                >
                  Check in for tonight
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2">
                {["No app needed", "Works at any Cloak venue", "Apple &amp; Google Wallet"].map((t) => (
                  <div className="flex items-center gap-1.5 text-xs text-white/55" key={t}>
                    <svg className="h-3.5 w-3.5 shrink-0 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                      <path clipRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" fillRule="evenodd" />
                    </svg>
                    <span dangerouslySetInnerHTML={{ __html: t }} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom scroll cue */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden lg:flex flex-col items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Scroll</span>
            <div className="h-8 w-px bg-linear-to-b from-white/30 to-transparent" />
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:py-20 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-lg">
              <span className="inline-block rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold uppercase tracking-widest text-muted">
                How it works
              </span>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
                Four steps.<br />
                <span className="text-muted">That&apos;s all it takes.</span>
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-7 text-muted lg:text-right">
              Get your permanent Cloak pass in under a minute. Use it at any Cloak-enabled venue from then on.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:mt-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            {/* Step list */}
            <div className="grid gap-0 divide-y divide-line">
              {howItWorksSteps.map((step) => (
                <div className="flex gap-5 py-5 first:pt-0 last:pb-0 sm:gap-6 sm:py-6" key={step.num}>
                  <span className="mt-0.5 shrink-0 font-mono text-sm font-bold text-zinc-300">{step.num}</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground sm:text-base">{step.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Phone visual */}
            <div className="relative hidden overflow-hidden rounded-2xl lg:block lg:sticky lg:top-24">
              <img
                alt="Guest QR code ticket shown on a phone at a cloakroom counter"
                className="h-80 w-full object-cover lg:h-105"
                src={qrImage}
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5 right-5">
                <div className="rounded-xl border border-white/15 bg-black/60 px-4 py-3 backdrop-blur-md">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-xs font-bold text-white">✓</span>
                    <div>
                      <p className="text-xs font-semibold text-white">Added to Apple Wallet</p>
                      <p className="text-[11px] text-white/60">Your Cloak pass is ready to use</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-foreground px-6 py-3.5 text-sm font-semibold text-white transition hover:opacity-85 active:scale-95"
              href="/cloak-club"
            >
              Join Cloak Club — it&apos;s free
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </section>

        {/* ── Customer Benefits ─────────────────────────────────────────────────── */}
        <section className="border-t border-line bg-zinc-50">
          <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:py-20 sm:px-6 lg:px-8">
            <div className="max-w-xl">
              <span className="inline-block rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold uppercase tracking-widest text-muted">
                Why guests love Cloak
              </span>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
                Everything better.<br />
                <span className="text-muted">Nothing to carry.</span>
              </h2>
            </div>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 sm:mt-14 lg:grid-cols-3">
              {customerBenefits.map((b) => (
                <div
                  className="group rounded-xl border border-line bg-white p-6 shadow-sm transition hover:border-zinc-300 hover:shadow-md"
                  key={b.heading}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-foreground transition group-hover:bg-foreground group-hover:text-white">
                    {b.icon}
                  </span>
                  <h3 className="mt-5 text-base font-semibold text-foreground">{b.heading}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{b.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ─────────────────────────────────────────────────────────── */}
        <section className="border-t border-line bg-foreground">
          <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-7 px-4 py-20 text-center sm:px-6 lg:px-8">
            <h2 className="max-w-lg text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Ready to ditch the paper ticket?
            </h2>
            <p className="max-w-md text-base text-white/55">
              Join Cloak Club for free. Add your QR pass to your wallet and you&apos;re set — for every event, at every Cloak venue.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-zinc-900 shadow-lg transition hover:bg-zinc-100 active:scale-95"
                href="/cloak-club"
              >
                Join Cloak Club — it&apos;s free
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link
                className="inline-flex items-center justify-center rounded-xl border border-white/25 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10 active:scale-95"
                href="/customer-signup"
              >
                Just checking in tonight
              </Link>
            </div>
          </div>
        </section>

      </main>

      <PublicFooter />
    </div>
  );
}
