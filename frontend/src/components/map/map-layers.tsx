"use client";

import * as React from "react";
import mapboxgl from "mapbox-gl";
import type { Destination, DestinationCategory } from "@/lib/api/types";
import { useMap } from "@/components/map/map-view";

const SOURCE_ID = "vj-poi";
const CLUSTER_LAYER = "vj-clusters";
const COUNT_LAYER = "vj-cluster-count";
const PIN_LAYER = "vj-pins";

export interface MarkerRating {
  avg: number;
  count: number;
}

interface MapLayersProps {
  destinations: Destination[];
  /** 0..1 marker opacity, driven by the layer slider. */
  opacity?: number;
  /** Cached ratings shown in the popup card. */
  ratingById?: Map<string, MarkerRating>;
  /** When provided, pin clicks select instead of popping up. */
  onSelectId?: (id: string) => void;
}

const PIN_STYLE: Record<DestinationCategory, { color: string; glyph: string }> = {
  NATURE: { color: "#0284c7", glyph: "⛱" },
  CULTURE: { color: "#ea580c", glyph: "🛕" },
  HISTORY: { color: "#dc2626", glyph: "🏛" },
  CUISINE: { color: "#d97706", glyph: "🍜" },
  ENTERTAINMENT: { color: "#db2777", glyph: "🎡" },
  RELIGION: { color: "#7c3aed", glyph: "🙏" },
  OTHER: { color: "#475569", glyph: "📍" },
};

/**
 * Destination markers: clustered count bubbles (blue/green/orange by size)
 * plus per-category teardrop pins with a preview popup card on click.
 */
export function MapLayers({
  destinations,
  opacity = 1,
  ratingById,
  onSelectId,
}: MapLayersProps) {
  const map = useMap();
  const onSelectRef = React.useRef(onSelectId);
  const ratingRef = React.useRef(ratingById);
  React.useEffect(() => {
    onSelectRef.current = onSelectId;
    ratingRef.current = ratingById;
  });

  React.useEffect(() => {
    if (!map) return;

    const styleAlive = () => {
      try {
        return !!map.getStyle();
      } catch {
        return false;
      }
    };
    if (!styleAlive()) return;

    ensurePinImages(map);

    const onPinClick = (e: mapboxgl.MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      const props = (f.properties ?? {}) as Record<string, string>;
      const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
      if (onSelectRef.current && props.id) onSelectRef.current(props.id);
      const rating = props.id ? ratingRef.current?.get(props.id) : undefined;
      const thumb = props.image
        ? `<img src="${escapeAttr(props.image)}" alt="" style="width:100%;height:84px;object-fit:cover;border-radius:8px;margin-top:6px" loading="lazy" />`
        : "";
      new mapboxgl.Popup({ offset: 18, closeButton: false, maxWidth: "220px" })
        .setLngLat(coords)
        .setHTML(
          `<div style="font-family:inherit;min-width:160px">` +
            `<strong style="font-size:13px;color:#0f172a">${escapeHtml(props.name ?? "")}</strong><br />` +
            `<span style="font-size:12px;color:#475569">★ ${escapeHtml(props.rating ?? "—")}${rating ? ` (${rating.count})` : ""}</span>` +
            thumb +
            `</div>`,
        )
        .addTo(map);
    };

    const onClusterClick = (e: mapboxgl.MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
      const clusterId = (f.properties as { cluster_id: number }).cluster_id;
      const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
      if (!src || typeof src.getClusterExpansionZoom !== "function") {
        map.easeTo({ center: coords, zoom: Math.min((map.getZoom() ?? 6) + 2, 14) });
        return;
      }
      src.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err || zoom == null) return;
        map.easeTo({ center: coords, zoom });
      });
    };

    const setup = () => {
      try {
        if (!map.getSource(SOURCE_ID)) {
          map.addSource(SOURCE_ID, {
            type: "geojson",
            data: toGeoJson(destinations),
            cluster: true,
            clusterRadius: 56,
            clusterMaxZoom: 12,
          });
        }
        if (!map.getLayer(CLUSTER_LAYER)) {
          map.addLayer({
            id: CLUSTER_LAYER,
            type: "circle",
            source: SOURCE_ID,
            filter: ["has", "point_count"],
            paint: {
              "circle-radius": [
                "step",
                ["get", "point_count"],
                18,
                25,
                22,
                60,
                26,
              ],
              "circle-color": [
                "step",
                ["get", "point_count"],
                "#3b82f6",
                25,
                "#22c55e",
                60,
                "#f97316",
              ],
              "circle-opacity": opacity,
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2.5,
            },
          });
        }
        if (!map.getLayer(COUNT_LAYER)) {
          map.addLayer({
            id: COUNT_LAYER,
            type: "symbol",
            source: SOURCE_ID,
            filter: ["has", "point_count"],
            layout: {
              "text-field": "{point_count_abbreviated}",
              "text-size": 12,
            },
            paint: {
              "text-color": "#ffffff",
              "text-opacity": opacity,
            },
          });
        }
        if (!map.getLayer(PIN_LAYER)) {
          map.addLayer({
            id: PIN_LAYER,
            type: "symbol",
            source: SOURCE_ID,
            filter: ["!", ["has", "point_count"]],
            layout: {
              "icon-image": ["concat", "vj-pin-", ["get", "category"]],
              "icon-size": 0.55,
              "icon-allow-overlap": true,
              "icon-anchor": "bottom",
            },
            paint: { "icon-opacity": opacity },
          });
        }
        map.on("click", PIN_LAYER, onPinClick);
        map.on("click", CLUSTER_LAYER, onClusterClick);
        refresh(map, destinations);
      } catch {
        /* style torn down mid-mount — safe to skip */
      }
    };

    if (!map.isStyleLoaded()) map.once("load", setup);
    else setup();

    return () => {
      try {
        map.off("click", PIN_LAYER, onPinClick);
        map.off("click", CLUSTER_LAYER, onClusterClick);
        if (map.getLayer(PIN_LAYER)) map.removeLayer(PIN_LAYER);
        if (map.getLayer(COUNT_LAYER)) map.removeLayer(COUNT_LAYER);
        if (map.getLayer(CLUSTER_LAYER)) map.removeLayer(CLUSTER_LAYER);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch {
        /* map removed or style gone */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Live data + opacity refresh without rebuilding layers.
  React.useEffect(() => {
    if (!map) return;
    try {
      const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
      if (src) src.setData(toGeoJson(destinations));
      if (map.getLayer(PIN_LAYER)) map.setPaintProperty(PIN_LAYER, "icon-opacity", opacity);
      if (map.getLayer(COUNT_LAYER)) map.setPaintProperty(COUNT_LAYER, "text-opacity", opacity);
      if (map.getLayer(CLUSTER_LAYER))
        map.setPaintProperty(CLUSTER_LAYER, "circle-opacity", opacity);
    } catch {
      /* style gone */
    }
  }, [map, destinations, opacity]);

  return null;
}

function refresh(map: mapboxgl.Map, destinations: Destination[]) {
  const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
  if (src) src.setData(toGeoJson(destinations));
}

function toGeoJson(destinations: Destination[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: destinations
      .filter(
        (d) =>
          Number.isFinite(d.lng) &&
          Number.isFinite(d.lat) &&
          d.status === "PUBLISHED",
      )
      .map((d) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [d.lng, d.lat] },
        properties: {
          id: d.id,
          name: d.name,
          address: d.address ?? "",
          category: d.category,
          image: d.images?.[0] ?? "",
          rating: "",
        },
      })),
  };
}

/** Runtime-drawn teardrop pins so no sprite assets are needed. */
function ensurePinImages(map: mapboxgl.Map) {
  for (const [key, { color, glyph }] of Object.entries(PIN_STYLE)) {
    const id = `vj-pin-${key}`;
    try {
      if (map.hasImage(id)) continue;
      const canvas = drawPin(color, glyph);
      const ctx = canvas.getContext("2d")!;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      map.addImage(id, { width: canvas.width, height: canvas.height, data: data.data }, { pixelRatio: 2 });
    } catch {
      /* style gone */
    }
  }
}

function drawPin(color: string, glyph: string): HTMLCanvasElement {
  const s = 2; // supersample
  const w = 72 * s;
  const h = 96 * s;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const cx = w / 2;
  const r = 26 * s;
  const cy = 30 * s;
  // Teardrop: circle + triangle tail.
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 0.15, Math.PI * 0.85, false);
  ctx.lineTo(cx, h - 4 * s);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 3 * s;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  // White inner disc + glyph.
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.font = `${20 * s}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(glyph, cx, cy + s);
  return c;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value: string) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
