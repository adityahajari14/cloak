"use client";

import { useEffect, useRef } from "react";
import type { AdminVenueReview } from "@/lib/admin-dashboard";

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? "";
const STYLE_URL = `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`;

const STATUS_COLOR: Record<AdminVenueReview["status"], string> = {
  approved: "#10b981",
  suspended: "#71717a",
};

export default function VenueMapPanel({ venues }: { venues: AdminVenueReview[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);

  const mapped = venues.filter((v) => v.latitude != null && v.longitude != null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let destroyed = false;

    import("maplibre-gl").then((ml) => {
      if (destroyed || !containerRef.current) return;

      const map = new ml.Map({
        center: [-2.5, 54.0],
        container: containerRef.current,
        style: STYLE_URL,
        zoom: 5,
        attributionControl: false,
      });
      map.addControl(new ml.AttributionControl({ compact: true }));
      mapRef.current = map;

      map.on("load", () => {
        if (destroyed) return;

        mapped.forEach((v) => {
          const lng = v.longitude!;
          const lat = v.latitude!;

          const color = STATUS_COLOR[v.status];
          const el = document.createElement("div");
          el.title = v.name;
          el.style.cssText = "width:26px;height:33px;cursor:pointer;transition:transform 0.15s;filter:drop-shadow(0 2px 5px rgba(0,0,0,0.4))";
          el.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 33" width="26" height="33">
              <path d="M13 0C6.373 0 1 5.373 1 12c0 8.284 12 21 12 21S25 20.284 25 12C25 5.373 19.627 0 13 0z" fill="${color}" stroke="white" stroke-width="1.8"/>
              <circle cx="13" cy="12" r="4" fill="white"/>
            </svg>`;
          el.onmouseenter = () => { el.style.transform = "scale(1.3)"; };
          el.onmouseleave = () => { el.style.transform = "scale(1)"; };

          const displayAddress =
            [v.address, v.city, v.postalCode].filter(Boolean).join(", ") || "UK";

          const popup = new ml.Popup({ offset: 16, closeButton: false, maxWidth: "240px" })
            .setHTML(`
              <div style="font-family:system-ui;padding:4px 2px">
                <p style="font-weight:700;font-size:13px;margin:0;color:#09090b">${v.name}</p>
                <p style="font-size:11px;color:#71717a;margin:5px 0 0;line-height:1.6">${displayAddress}</p>
                <span style="display:inline-block;margin-top:6px;font-size:10px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:${STATUS_COLOR[v.status]}">${v.status}</span>
              </div>
            `);

          new ml.Marker({ element: el, anchor: "bottom" })
            .setLngLat([lng, lat])
            .setPopup(popup)
            .addTo(map);
        });

        if (mapped.length > 1) {
          const lngs = mapped.map((v) => v.longitude!);
          const lats = mapped.map((v) => v.latitude!);
          map.fitBounds(
            [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
            { padding: 60, maxZoom: 12, duration: 800 },
          );
        } else if (mapped.length === 1) {
          map.flyTo({ center: [mapped[0].longitude!, mapped[0].latitude!], zoom: 13, duration: 800 });
        }
      });
    });

    return () => {
      destroyed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-xl border border-line bg-panel">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Venue locations</p>
          <p className="mt-0.5 text-xs text-muted">
            {mapped.length === 0
              ? "No venues with pinned locations yet"
              : `${mapped.length} of ${venues.length} venue${venues.length !== 1 ? "s" : ""} pinned`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {(["approved", "suspended"] as const).map((s) => (
            <span className="flex items-center gap-1.5 text-xs text-muted" key={s}>
              <span
                className="h-2.5 w-2.5 rounded-full border border-white/50"
                style={{ background: STATUS_COLOR[s] }}
              />
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
          ))}
        </div>
      </div>

      {/* Map — no overflow-hidden here so markers aren't clipped at the edges */}
      <div className="relative h-80 overflow-hidden rounded-b-xl">
        {mapped.length === 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-zinc-50/90 text-center text-sm text-muted">
            <svg className="h-8 w-8 opacity-30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p>Venues will appear here once they pin their location during signup</p>
          </div>
        )}
        <style>{`
          .maplibregl-ctrl-logo { display: none !important; }
          .maplibregl-ctrl-attrib { font-size: 10px !important; }
          .maplibregl-popup-content { padding: 10px 12px !important; border-radius: 10px !important; box-shadow: 0 4px 16px rgba(0,0,0,0.12) !important; }
        `}</style>
        <div className="h-full w-full" ref={containerRef} />
      </div>
    </div>
  );
}

