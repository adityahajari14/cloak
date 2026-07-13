"use client";

import { useState } from "react";

/**
 * Lets a guest send their own pass to someone else — a friend collecting on
 * their behalf, or just themselves on a second device.
 *
 * The shared link is the ticket's token URL: whoever holds it can present the
 * QR at the counter. That is the point of sharing, but it means the copy has to
 * be honest that this hands over the pass rather than pretending it's a
 * read-only view.
 */
export default function ShareTicketButton({
  ticketUrl,
  venueName,
  publicCode,
}: {
  ticketUrl: string;
  venueName: string;
  publicCode: string;
}) {
  const [copied, setCopied] = useState(false);

  const message = `My Cloak pass for ${venueName} (code ${publicCode}). Show this at the cloakroom counter: ${ticketUrl}`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(message)}`;

  // The native share sheet is the better path on a phone — the guest picks
  // WhatsApp (or anything else) from the OS. Fall back to a wa.me link on
  // desktop, where navigator.share generally isn't available.
  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          text: message,
          title: `Cloak pass — ${venueName}`,
        });
        return;
      } catch {
        // User dismissed the sheet, or share failed — fall through to WhatsApp.
      }
    }
    window.open(waHref, "_blank", "noopener,noreferrer");
  }

  function handleCopy() {
    void navigator.clipboard.writeText(ticketUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-xl border border-line bg-panel p-4">
      <p className="text-sm font-semibold text-foreground">Share this pass</p>
      <p className="mt-1 text-xs text-muted">
        Anyone with this link can collect your items, so only send it to someone you trust.
      </p>

      <div className="mt-3 flex gap-2">
        <button
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95"
          onClick={handleShare}
          type="button"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 0 1 6.99 2.896 9.82 9.82 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.887 9.884m8.413-18.297A11.82 11.82 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.88 11.88 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 0 0-3.48-8.413" />
          </svg>
          Share on WhatsApp
        </button>

        <button
          className="shrink-0 rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-semibold text-muted transition hover:border-foreground/30 hover:text-foreground"
          onClick={handleCopy}
          type="button"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
