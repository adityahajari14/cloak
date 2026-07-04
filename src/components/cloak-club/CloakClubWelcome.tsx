import Image from "next/image";
import Link from "next/link";
import type { WalletConfig } from "@/lib/wallet";

export default function CloakClubWelcome({
  guestName,
  memberToken,
  qrDataUrl,
  wallet,
}: {
  guestName: string;
  memberToken: string;
  qrDataUrl: string;
  wallet: WalletConfig;
}) {
  const walletParam = `member=${encodeURIComponent(memberToken)}`;
  const firstName = guestName.split(" ")[0] || guestName;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex w-full max-w-sm flex-col gap-6 px-4 py-10 sm:max-w-md">
        {/* Celebration */}
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
            🎉
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Welcome to Cloak Club
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              You&apos;re in, {firstName}. Add your permanent pass to your wallet — it works at
              any Cloak venue and refreshes after every visit.
            </p>
          </div>
        </div>

        {/* QR — lets the member use their pass straight from the website too */}
        <div className="overflow-hidden rounded-2xl border border-line bg-panel">
          <div className="flex justify-center bg-white p-6">
            <Image alt="Cloak Club membership QR code" height={220} priority src={qrDataUrl} unoptimized width={220} />
          </div>
          <p className="border-t border-line px-4 py-3 text-center text-xs text-muted">
            Show this QR code at the counter at any Cloak venue.
          </p>
        </div>

        {/* Wallet buttons */}
        <div className="grid gap-2 rounded-2xl border border-line bg-panel p-5">
          <p className="mb-1 text-center text-xs font-semibold uppercase tracking-widest text-muted">
            Add your pass to Wallet
          </p>

          {wallet.appleEnabled ? (
            <a
              className="flex items-center justify-between rounded-xl border border-line bg-black px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800"
              download="cloak-club.pkpass"
              href={`/api/wallet/apple?${walletParam}`}
            >
              <span className="flex items-center gap-2.5">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 814 1000">
                  <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.3-150.3-96.8C67.3 716.9 24 599 24 481.3c0-170.7 111.4-261.1 221-261.1 75.8 0 138.3 43.4 186.9 43.4 46.3 0 118.5-48.8 208.3-48.8 31.5 0 134.4 2.6 204.4 99.4zm-340.2-168c31.5-37.1 54.2-88.8 54.2-140.5 0-7.1-.6-14.3-1.9-20.1-51.5 1.9-112.3 34.2-149.1 75.8-28.5 32.4-55.1 83.5-55.1 135.8 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 46.3 0 102.9-31.1 136.4-70.4z" />
                </svg>
                Add to Apple Wallet
              </span>
              <svg className="h-4 w-4 opacity-60" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          ) : null}

          {wallet.googleEnabled ? (
            <a
              className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3 text-sm font-medium text-foreground transition hover:bg-zinc-50"
              href={`/api/wallet/google?${walletParam}`}
              rel="noopener noreferrer"
              target="_blank"
            >
              <span className="flex items-center gap-2.5">
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Add to Google Wallet
              </span>
              <svg className="h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          ) : null}

          {!wallet.appleEnabled && !wallet.googleEnabled ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-700">
              Wallet passes aren&apos;t available on this server yet. We&apos;ve emailed your
              membership details instead.
            </p>
          ) : null}
        </div>

        <p className="text-center text-xs leading-5 text-muted">
          Show your pass at the counter at any participating venue. We&apos;ve also emailed you a
          copy.
        </p>

        <Link
          className="text-center text-xs font-semibold text-muted underline hover:text-foreground"
          href="/"
        >
          Back to home
        </Link>
      </main>
    </div>
  );
}
