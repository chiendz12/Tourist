"use client";

import * as React from "react";
import mapboxgl from "mapbox-gl";
import { MAP_DEFAULTS, MAP_STYLE, NEXT_PUBLIC_MAPBOX_TOKEN } from "@/lib/env";

/**
 * Static Mapbox preview that fits the hero card. No clustering, no interactions
 * beyond hover; just a static map of Vietnam with a couple of pins to suggest
 * density. Renders nothing if the public Mapbox token is absent.
 */
export function HeroMapPreview() {
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const containerEl = containerRef.current;
    if (!containerEl || !NEXT_PUBLIC_MAPBOX_TOKEN) return;
    // StrictMode remount guard: one preview map per container.
    if (containerEl.dataset.ready === "1") return;

    const map = new mapboxgl.Map({
      container: containerEl,
      style: MAP_STYLE,
      center: MAP_DEFAULTS.center,
      zoom: MAP_DEFAULTS.zoom - 1,
      accessToken: NEXT_PUBLIC_MAPBOX_TOKEN,
      interactive: false,
      attributionControl: false,
    });

    const pins: Array<[number, number]> = [
      [106.7, 10.7769], // HCM
      [105.85, 21.0285], // Hanoi
      [108.2, 16.06], // Da Nang
      [109.2, 12.25], // Nha Trang
      [107.6, 16.47], // Hue
    ];

    pins.forEach(([lng, lat]) => {
      const el = document.createElement("div");
      el.className =
        "size-2.5 rounded-full bg-emerald-500 ring-2 ring-white shadow";
      new mapboxgl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
    });

    containerEl.dataset.ready = "1";

    return () => {
      containerEl.removeAttribute("data-ready");
      try {
        map.remove();
      } catch {
        /* already removed */
      }
    };
  }, []);

  if (!NEXT_PUBLIC_MAPBOX_TOKEN) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-sm text-slate-500">
        Bản đồ chưa được cấu hình.
      </div>
    );
  }

  return <div ref={containerRef} className="h-full w-full" />;
}
