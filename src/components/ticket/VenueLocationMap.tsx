"use client";

import { useEffect, useRef, useState } from "react";

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? "";
const STYLE_URL = `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`;

async function geocodeAddress(address: string): Promise<[number, number] | null> {
  try {
    const res = await fetch(
      `https://api.maptiler.com/geocoding/${encodeURIComponent(address)}.json?key=${MAPTILER_KEY}&country=gb&limit=1`,
    );
    const data = await res.json();
    const center = data?.features?.[0]?.center;
    if (Array.isArray(center) && center.length === 2) return [center[0], center[1]];
  } catch {
    // silent
  }
  return null;
}

/**
 * Coordinates are captured when the venue signs up and stored on the row, so
 * they are the authoritative location. Use them.
 *
 * This map used to geocode the address string on every render instead, which
 * put guests in the wrong place: the string is free text with no postcode, so
 * "Sea Rock, North Finchley" resolved 500+ km away and "London Eye, London"
 * pinned the actual London Eye. Geocoding is now only a fallback for a venue
 * that somehow has no stored coordinates.
 */
export default function VenueLocationMap({
  address,
  venueName,
  latitude,
  longitude,
}: {
  address: string;
  venueName: string;
  latitude: number | null;
  longitude: number | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  // "loading" | "ready" | "failed"
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let destroyed = false;

    // MapLibre takes [lng, lat] — the reverse of how they're usually written.
    const stored: [number, number] | null =
      typeof latitude === "number" && typeof longitude === "number"
        ? [longitude, latitude]
        : null;

    const locate = stored ? Promise.resolve(stored) : geocodeAddress(address);

    locate.then((coords) => {
      if (destroyed) return;
      if (!coords || !containerRef.current) {
        setState("failed");
        return;
      }

      import("maplibre-gl").then((ml) => {
        if (destroyed || !containerRef.current) return;

        const map = new ml.Map({
          center: [coords[0], coords[1]],
          container: containerRef.current,
          style: STYLE_URL,
          zoom: 15,
          attributionControl: false,
        });
        map.addControl(new ml.AttributionControl({ compact: true }));
        mapRef.current = map;

        map.on("load", () => {
          if (destroyed) return;
          setState("ready");

          const el = document.createElement("div");
          el.style.cssText =
            "width:32px;height:40px;filter:drop-shadow(0 3px 6px rgba(0,0,0,0.4))";
          el.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 40" width="32" height="40">
              <path d="M16 0C8.268 0 2 6.268 2 14c0 9.941 14 26 14 26S30 23.941 30 14C30 6.268 23.732 0 16 0z" fill="#18181b" stroke="white" stroke-width="2"/>
              <circle cx="16" cy="14" r="5" fill="white"/>
            </svg>`;

          const popup = new ml.Popup({ offset: [0, -40], closeButton: false, maxWidth: "220px" })
            .setHTML(`
              <div style="font-family:system-ui;padding:2px 0">
                <p style="font-weight:600;font-size:13px;margin:0;color:#09090b">${venueName}</p>
                <p style="font-size:11px;color:#71717a;margin:4px 0 0">${address}</p>
              </div>
            `);

          new ml.Marker({ element: el, anchor: "bottom" })
            .setLngLat([coords[0], coords[1]])
            .setPopup(popup)
            .addTo(map);
        });
      });
    });

    return () => {
      destroyed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [address, venueName, latitude, longitude]);

  return (
    <div className={state === "failed" ? "hidden" : "rounded-xl border border-line"}>
      <style>{`
        .maplibregl-ctrl-logo { display: none !important; }
        .maplibregl-ctrl-attrib { font-size: 10px !important; }
        .maplibregl-popup-content { padding: 8px 10px !important; border-radius: 8px !important; }
      `}</style>

      {/* Container is always in DOM so MapLibre can measure it */}
      <div className="relative h-44 overflow-hidden rounded-t-xl">
        {state === "loading" && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-zinc-50 text-xs text-muted">
            <span className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted border-t-transparent" />
              Loading map…
            </span>
          </div>
        )}
        <div className="h-full w-full" ref={containerRef} />
      </div>

      <div className="border-t border-line bg-panel px-4 py-3">
        <p className="text-xs font-semibold text-foreground">{venueName}</p>
        <p className="mt-0.5 text-xs text-muted">{address}</p>
      </div>
    </div>
  );
}

