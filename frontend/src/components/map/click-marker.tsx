"use client";

import * as React from "react";
import mapboxgl from "mapbox-gl";
import { geoApi } from "@/lib/api/services";
import { reverseGeocode, type ParsedPlace } from "@/lib/mapbox-geocode";
import { useMap } from "@/components/map/map-view";
import type { DirPoint } from "@/components/map/directions-panel";

/**
 * Click-to-pin on any map: clicking empty map space drops a draggable red
 * marker whose popup shows coordinates, the reverse-geocoded address and
 * quick actions (directions, copy, remove). Clicks on POI pins/clusters
 * are ignored so layer interactions keep working. A new click moves the
 * same marker instead of stacking pins.
 */
export function ClickMarker({ onDirections }: { onDirections?: (point: DirPoint) => void }) {
  const map = useMap();
  const markerRef = React.useRef<mapboxgl.Marker | null>(null);
  const popupRef = React.useRef<mapboxgl.Popup | null>(null);
  const seqRef = React.useRef(0);
  // Latest pinned place (for the directions action); kept in a ref so the
  // map effect below doesn't need to re-subscribe when the callback changes.
  const lastPlaceRef = React.useRef<{ lng: number; lat: number; label: string } | null>(null);
  const onDirectionsRef = React.useRef(onDirections);
  React.useEffect(() => {
    onDirectionsRef.current = onDirections;
  }, [onDirections]);

  React.useEffect(() => {
    if (!map) return;

    const pinHtml =
      '<svg width="34" height="46" viewBox="0 0 36 48" fill="none"><path d="M18 1C9.7 1 3 7.7 3 16c0 10.5 12.3 26.4 13.6 28 .7.9 2.1.9 2.8 0C20.7 42.4 33 26.5 33 16 33 7.7 26.3 1 18 1Z" fill="#e11d48" stroke="#fff" stroke-width="2"/><circle cx="18" cy="16" r="6" fill="#fff"/></svg>';

    const closePopup = () => {
      try {
        popupRef.current?.remove();
      } catch {
        /* gone */
      }
      popupRef.current = null;
    };

    const removeMarker = () => {
      closePopup();
      try {
        markerRef.current?.remove();
      } catch {
        /* gone */
      }
      markerRef.current = null;
    };

    const renderPopup = (lng: number, lat: number, place?: ParsedPlace | null) => {
      closePopup();
      lastPlaceRef.current = {
        lng,
        lat,
        label: place?.name && place.name !== "Vị trí đã chọn" ? place.name : `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      };
      const rows: Array<[string, string]> = [];
      if (place?.street) rows.push(["Đường", place.street]);
      if (place?.ward) rows.push(["Phường/Xã", place.ward]);
      if (place?.city) rows.push(["Tỉnh/TP", place.city]);
      const popup = new mapboxgl.Popup({ offset: 26, closeButton: false, maxWidth: "260px" });
      popup
        .setLngLat([lng, lat])
        .setHTML(
          `<div style="font-family:inherit;min-width:180px;max-width:230px">` +
            `<strong style="font-size:13px;color:#0f172a">${place ? escapeHtml(place.name) : "Vị trí đã chọn"}</strong>` +
            rows
              .map(
                ([k, v]) =>
                  `<div style="font-size:12px;color:#475569;margin-top:2px"><span style="color:#94a3b8">${escapeHtml(k)}:</span> ${escapeHtml(v)}</div>`,
              )
              .join("") +
            (place?.full && place.full !== place.name
              ? `<div style="font-size:11px;color:#94a3b8;margin-top:3px">${escapeHtml(place.full)}</div>`
              : "") +
            `<div style="font-size:12px;color:#475569;font-variant-numeric:tabular-nums;margin-top:4px">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>` +
            `<div style="display:flex;gap:6px;margin-top:8px">` +
            `<button data-act="directions" style="flex:1;font-size:12px;font-weight:700;color:#fff;background:#1d4ed8;border:0;border-radius:8px;padding:6px 4px;cursor:pointer">Chỉ đường</button>` +
            `<button data-act="copy" style="flex:1;font-size:12px;font-weight:700;color:#334155;background:#f1f5f9;border:0;border-radius:8px;padding:6px 4px;cursor:pointer">Sao chép</button>` +
            `<button data-act="clear" title="Xóa ghim" style="font-size:12px;font-weight:700;color:#64748b;background:#f1f5f9;border:0;border-radius:8px;padding:6px 8px;cursor:pointer">✕</button>` +
            `</div></div>`,
        )
        .addTo(map);
      popupRef.current = popup;
      const el = popup.getElement();
      if (!el) return;
      el.querySelector('[data-act="directions"]')?.addEventListener("click", (e) => {
        e.stopPropagation();
        const p = lastPlaceRef.current;
        if (p) onDirectionsRef.current?.({ lng: p.lng, lat: p.lat, label: p.label });
      });
      el.querySelector('[data-act="copy"]')?.addEventListener("click", async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
          (e.target as HTMLElement).textContent = "Đã chép!";
        } catch {
          /* clipboard unavailable */
        }
      });
      el.querySelector('[data-act="clear"]')?.addEventListener("click", (e) => {
        e.stopPropagation();
        removeMarker();
      });
    };

    const place = (lng: number, lat: number, hintName?: string) => {
      const seq = ++seqRef.current;
      if (hintName) renderPopup(lng, lat, { name: hintName, full: "" });
      let marker = markerRef.current;
      if (!marker) {
        const el = document.createElement("div");
        el.innerHTML = pinHtml;
        el.style.cursor = "grab";
        marker = new mapboxgl.Marker({ element: el, draggable: true, anchor: "bottom" });
        markerRef.current = marker;
        marker.on("dragend", () => {
          const p = marker!.getLngLat();
          renderPopup(p.lng, p.lat);
          void resolveAddress(p.lng, p.lat, seq);
        });
      }
      try {
        marker.setLngLat([lng, lat]).addTo(map);
      } catch {
        return;
      }
      renderPopup(lng, lat, hintName ? { name: hintName, full: "" } : undefined);
      void resolveAddress(lng, lat, seq, hintName);
    };

    const resolveAddress = async (lng: number, lat: number, seq: number, hintName?: string) => {
      // Direct Mapbox first (structured vi address); backend proxy as fallback.
      try {
        const place = await reverseGeocode(lng, lat, hintName);
        if (place && seqRef.current === seq) {
          renderPopup(lng, lat, place);
          return;
        }
      } catch {
        /* fall through to backend */
      }
      try {
        const res = await geoApi.reverse(lng, lat);
        const f = res.features?.[0];
        if (f?.place_name && seqRef.current === seq) {
          renderPopup(lng, lat, { name: f.text || "Vị trí đã chọn", full: f.place_name });
        }
      } catch {
        /* coords-only popup stays */
      }
    };

    const onClick = (e: mapboxgl.MapMouseEvent) => {
      // Ignore double-clicks (zoom) and clicks on POI pins/clusters.
      if ((e.originalEvent as MouseEvent).detail > 1) return;
      let hintName: string | undefined;
      try {
        const hits = map.queryRenderedFeatures(e.point);
        if (hits.some((f) => f.source === "vj-poi")) return;
        // Read the building label straight off the basemap (e.g. the hotel
        // or café name printed under the cursor). Only POI layers — road,
        // place and water labels must never become the title.
        const label = hits.find(
          (f) =>
            /poi/i.test(f.layer?.id ?? "") &&
            typeof (f.properties as Record<string, unknown> | null)?.name === "string",
        );
        const props = label?.properties as
          | { name_vi?: string; name?: string }
          | undefined;
        hintName = props?.name_vi || props?.name || undefined;
      } catch {
        /* query failed — still place */
      }
      place(Number(e.lngLat.lng.toFixed(5)), Number(e.lngLat.lat.toFixed(5)), hintName);
    };

    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
      removeMarker();
    };
  }, [map]);

  return null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
