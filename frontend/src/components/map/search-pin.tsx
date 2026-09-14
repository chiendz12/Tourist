"use client";

import * as React from "react";
import mapboxgl from "mapbox-gl";
import type { PlaceResult } from "@/lib/mapbox-geocode";
import { useMap } from "@/components/map/map-view";
import type { DirPoint } from "@/components/map/directions-panel";

interface SearchPinProps {
  place: PlaceResult | null;
  onDirections: (point: DirPoint) => void;
  onClose: () => void;
}

/**
 * Pin dropped on a place picked from search (outside our marker set):
 * flies its popup open with name/address plus an in-app directions action.
 */
export function SearchPin({ place, onDirections, onClose }: SearchPinProps) {
  const map = useMap();
  const markerRef = React.useRef<mapboxgl.Marker | null>(null);
  const popupRef = React.useRef<mapboxgl.Popup | null>(null);
  const cbRef = React.useRef({ onDirections, onClose });
  React.useEffect(() => {
    cbRef.current = { onDirections, onClose };
  }, [onDirections, onClose]);

  React.useEffect(() => {
    if (!map || !place) return;

    const el = document.createElement("div");
    el.innerHTML =
      '<svg width="34" height="46" viewBox="0 0 36 48" fill="none"><path d="M18 1C9.7 1 3 7.7 3 16c0 10.5 12.3 26.4 13.6 28 .7.9 2.1.9 2.8 0C20.7 42.4 33 26.5 33 16 33 7.7 26.3 1 18 1Z" fill="#7c3aed" stroke="#fff" stroke-width="2"/><circle cx="18" cy="16" r="6" fill="#fff"/></svg>';
    const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" });
    markerRef.current = marker;
    try {
      marker.setLngLat([place.lng, place.lat]).addTo(map);
    } catch {
      return;
    }

    const popup = new mapboxgl.Popup({ offset: 26, closeButton: false, maxWidth: "260px" });
    popup
      .setLngLat([place.lng, place.lat])
      .setHTML(
        `<div style="font-family:inherit;min-width:180px;max-width:230px">` +
          `<strong style="font-size:13px;color:#0f172a">${escapeHtml(place.name)}</strong>` +
          (place.address && place.address !== place.name
            ? `<div style="font-size:12px;color:#64748b;margin-top:2px">${escapeHtml(place.address)}</div>`
            : "") +
          `<div style="font-size:11px;color:#94a3b8;margin-top:3px">Nguồn: ${escapeHtml(sourceVi(place.source))} · ${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}</div>` +
          `<div style="display:flex;gap:6px;margin-top:8px">` +
          `<button data-act="directions" style="flex:1;font-size:12px;font-weight:700;color:#fff;background:#1d4ed8;border:0;border-radius:8px;padding:6px 4px;cursor:pointer">Chỉ đường</button>` +
          `<button data-act="clear" title="Xóa ghim" style="font-size:12px;font-weight:700;color:#64748b;background:#f1f5f9;border:0;border-radius:8px;padding:6px 8px;cursor:pointer">✕</button>` +
          `</div></div>`,
      )
      .addTo(map);
    popupRef.current = popup;
    const node = popup.getElement();
    node?.querySelector('[data-act="directions"]')?.addEventListener("click", (e) => {
      e.stopPropagation();
      cbRef.current.onDirections({ lng: place.lng, lat: place.lat, label: place.name });
    });
    node?.querySelector('[data-act="clear"]')?.addEventListener("click", (e) => {
      e.stopPropagation();
      cbRef.current.onClose();
    });
    try {
      map.flyTo({ center: [place.lng, place.lat], zoom: Math.max(map.getZoom(), 13), duration: 1200 });
    } catch {
      /* map gone */
    }

    return () => {
      try {
        popupRef.current?.remove();
      } catch {
        /* gone */
      }
      popupRef.current = null;
      try {
        markerRef.current?.remove();
      } catch {
        /* gone */
      }
      markerRef.current = null;
    };
  }, [map, place]);

  return null;
}

function sourceVi(source: PlaceResult["source"]): string {
  switch (source) {
    case "VietJourney":
      return "VietJourney";
    case "OpenStreetMap":
      return "OpenStreetMap";
    case "Mapbox":
      return "Mapbox";
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
