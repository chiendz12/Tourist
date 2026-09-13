"use client";

import * as React from "react";
import type { TourRoute } from "@/lib/api/types";
import { useMap } from "@/components/map/map-view";

const SOURCE_ID = "vj-routes";
const LAYER_ID = "vj-route-lines";

interface RouteLinesProps {
  routes: TourRoute[];
  opacity?: number;
}

/** Orange tour-route polylines from stored path geometry or waypoints. */
export function RouteLines({ routes, opacity = 0.8 }: RouteLinesProps) {
  const map = useMap();

  React.useEffect(() => {
    if (!map) return;
    let cancelled = false;

    const build = () => {
      if (cancelled) return;
      try {
        const fc = toGeoJson(routes);
        if (!map.getSource(SOURCE_ID)) {
          map.addSource(SOURCE_ID, { type: "geojson", data: fc });
        } else {
          (map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined)?.setData(fc);
        }
        if (!map.getLayer(LAYER_ID)) {
          map.addLayer({
            id: LAYER_ID,
            type: "line",
            source: SOURCE_ID,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": "#f97316",
              "line-width": 3,
              "line-opacity": opacity,
            },
          });
        } else {
          map.setPaintProperty(LAYER_ID, "line-opacity", opacity);
        }
      } catch {
        /* style gone */
      }
    };

    if (!map.isStyleLoaded()) map.once("load", build);
    else build();

    return () => {
      cancelled = true;
      try {
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch {
        /* gone */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  React.useEffect(() => {
    if (!map) return;
    try {
      (map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined)?.setData(
        toGeoJson(routes),
      );
      if (map.getLayer(LAYER_ID)) map.setPaintProperty(LAYER_ID, "line-opacity", opacity);
    } catch {
      /* gone */
    }
  }, [map, routes, opacity]);

  return null;
}

function toGeoJson(routes: TourRoute[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const r of routes) {
    let coords: [number, number][] = [];
    if (r.path?.coordinates?.length) {
      coords = r.path.coordinates.filter(
        ([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat),
      );
    } else if (r.waypoints?.length) {
      coords = (r.waypoints ?? [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((w) => w.destination)
        .filter((d) => d && Number.isFinite(d.lng) && Number.isFinite(d.lat))
        .map((d) => [d!.lng, d!.lat]);
    }
    if (coords.length < 2) continue;
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: coords },
      properties: { id: r.id, name: r.name },
    });
  }
  return { type: "FeatureCollection", features };
}
