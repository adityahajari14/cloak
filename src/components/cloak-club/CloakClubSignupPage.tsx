import Link from "next/link";
import CloakClubFormPreview from "./CloakClubFormPreview";

const venueImage = "/images/venue-checkin.png";

export default function CloakClubSignupPage({ error }: { error?: string }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Slim header */}
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link className="flex items-center gap-2.5" href="/">
            <img alt="Cloak" className="h-8 w-8 rounded-lg object-cover" src="/images/cloak-logo.png" />
            <span className="text-sm font-semibold text-foreground">Cloak</span>
          </Link>
          <Link
            className="flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-foreground"
            href="/customer-signup"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            One-time pass instead
          </Link>
        </div>
      </header>

      <div className="lg:grid lg:min-h-[calc(100vh-57px)] lg:grid-cols-[1fr_1fr]">
        {/* Left — branding panel (desktop only) */}
        <div
          className="relative hidden lg:block"
          style={{
            backgroundImage: `url(${venueImage})`,
            backgroundPosition: "center",
            backgroundSize: "cover",
          }}
        >
          <div className="absolute inset-0 bg-linear-to-br from-black/85 via-black/60 to-black/30" />
          <div className="relative flex h-full flex-col justify-between p-12">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-xs font-semibold tracking-wide text-white/80">Cloak Club · Lifetime pass</span>
              </span>
              <h1 className="mt-8 text-4xl font-bold leading-tight tracking-tight text-white">
                One pass.<br />
                <span className="text-white/55">Every venue. Forever.</span>
              </h1>
              <p className="mt-4 max-w-sm text-sm leading-7 text-white/60">
                Join Cloak Club once and keep a permanent pass in your mobile wallet. It works
                at any Cloak venue and refreshes after every visit — no signing up again.
              </p>
            </div>

            <div className="grid gap-3">
              {[
                { icon: "✓", label: "Works at any Cloak venue" },
                { icon: "✓", label: "Lives in your wallet permanently" },
                { icon: "✓", label: "Refreshes after each use" },
              ].map((t) => (
                <div className="flex items-center gap-3" key={t.label}>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400">
                    {t.icon}
                  </span>
                  <span className="text-sm text-white/70">{t.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — form panel */}
        <div className="flex flex-col items-center justify-center px-4 py-10 sm:px-8 lg:px-12">
          <div className="mb-8 text-center lg:hidden">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Join Cloak Club</h1>
            <p className="mt-1.5 text-sm text-muted">Your lifetime wallet pass · Free</p>
          </div>

          <div className="w-full max-w-md">
            <div className="mb-8 hidden lg:block">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">Lifetime membership</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">Join Cloak Club</h2>
              <p className="mt-1.5 text-sm text-muted">A permanent wallet pass for every Cloak venue. Free, forever.</p>
            </div>

            <CloakClubFormPreview error={error} />
          </div>
        </div>
      </div>
    </div>
  );
}
