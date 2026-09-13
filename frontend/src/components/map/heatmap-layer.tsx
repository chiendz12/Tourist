"use client";

import * as React from "react";
import type { Destination } from "@/lib/api/types";
import { useMap } from "@/components/map/map-view";

const SOURCE_ID = "vj-heat";
const LAYER_ID = "vj-heat-layer";

interface HeatmapLayerProps {
  destinations: Destination[];
  opacity?: number;
}

/** Review-density heatmap over the destination points. */
export function HeatmapLayer({ destinations, opacity = 0.5 }: HeatmapLayerProps) {
  const map = useMap();

  React.useEffect(() => {
    if (!map) return;
    let cancelled = false;

    const build = () => {
      if (cancelled) return;
      try {
        const fc: GeoJSON.FeatureCollection = {
          type: "FeatureCollection",
          features: destinations
            .filter((d) => Number.isFinite(d.lng) && Number.isFinite(d.lat))
            .map((d) => ({
              type: "Feature",
              geometry: { type: "Point", coordinates: [d.lng, d.lat] },
              properties: {},
            })),
        };
        if (!map.getSource(SOURCE_ID)) {
          map.addSource(SOURCE_ID, { type: "geojson", data: fc });
        } else {
          (map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined)?.setData(fc);
        }
        if (!map.getLayer(LAYER_ID)) {
          map.addLayer({
            id: LAYER_ID,
            type: "heatmap",
            source: SOURCE_ID,
            paint: {
              "heatmap-radius": 42,
              "heatmap-intensity": 0.9,
              "heatmap-opacity": opacity,
              "heatmap-color": [
                "interpolate",
                ["linear"],
                ["heatmap-density"],
                0,
                "rgba(34,197,94,0)",
                0.25,
                "rgba(34,197,94,0.7)",
                0.55,
                "rgba(250,204,21,0.8)",
                0.8,
                "rgba(249,115,22,0.9)",
              ],
            },
          });
        } else {
          map.setPaintProperty(LAYER_ID, "heatmap-opacity", opacity);
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
      const fc: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: destinations
          .filter((d) => Number.isFinite(d.lng) && Number.isFinite(d.lat))
          .map((d) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [d.lng, d.lat] },
            properties: {},
          })),
      };
      (map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined)?.setData(fc);
      if (map.getLayer(LAYER_ID)) map.setPaintProperty(LAYER_ID, "heatmap-opacity", opacity);
    } catch {
      /* gone */
    }
  }, [map, destinations, opacity]);

  return null;
}
