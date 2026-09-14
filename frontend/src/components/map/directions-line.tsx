"use client";

import * as React from "react";
import mapboxgl from "mapbox-gl";
import { useMap } from "@/components/map/map-view";

const SOURCE_ID = "vj-directions";
const CASING_ID = "vj-directions-casing";
const LINE_ID = "vj-directions-line";
const ENDPOINTS_ID = "vj-directions-endpoints";

export interface DirectionsGeometry {
  coordinates: [number, number][];
}

interface DirectionsLineProps {
  /** Road polyline from the directions fetch (null = draw nothing). */
  route: DirectionsGeometry | null;
  from: { lng: number; lat: number } | null;
  to: { lng: number; lat: number } | null;
}

/** In-app route: white casing + blue line plus green/red endpoint dots. */
export function DirectionsLine({ route, from, to }: DirectionsLineProps) {
  const map = useMap();

  React.useEffect(() => {
    if (!map) return;
    let cancelled = false;

    const ensure = () => {
      if (cancelled) return;
      try {
        const line: GeoJSON.FeatureCollection = {
          type: "FeatureCollection",
          features: route?.coordinates?.length
            ? [
                {
                  type: "Feature",
                  geometry: { type: "LineString", coordinates: route.coordinates },
                  properties: {},
                },
              ]
            : [],
        };
        if (!map.getSource(SOURCE_ID)) {
          map.addSource(SOURCE_ID, { type: "geojson", data: line });
        } else {
          (map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined)?.setData(line);
        }
        if (!map.getLayer(CASING_ID)) {
          map.addLayer({
            id: CASING_ID,
            type: "line",
            source: SOURCE_ID,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.9 },
          });
        }
        if (!map.getLayer(LINE_ID)) {
          map.addLayer({
            id: LINE_ID,
            type: "line",
            source: SOURCE_ID,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": "#1d4ed8", "line-width": 4.5, "line-opacity": 0.95 },
          });
        }

        const points: GeoJSON.FeatureCollection = {
          type: "FeatureCollection",
          features: [
            ...(from
              ? [
                  {
                    type: "Feature",
                    geometry: { type: "Point", coordinates: [from.lng, from.lat] },
                    properties: { color: "#16a34a" },
                  } as GeoJSON.Feature,
                ]
              : []),
            ...(to
              ? [
                  {
                    type: "Feature",
                    geometry: { type: "Point", coordinates: [to.lng, to.lat] },
                    properties: { color: "#e11d48" },
                  } as GeoJSON.Feature,
                ]
              : []),
          ],
        };
        if (!map.getSource(`${SOURCE_ID}-pts`)) {
          map.addSource(`${SOURCE_ID}-pts`, { type: "geojson", data: points });
        } else {
          (map.getSource(`${SOURCE_ID}-pts`) as mapboxgl.GeoJSONSource | undefined)?.setData(points);
        }
        if (!map.getLayer(ENDPOINTS_ID)) {
          map.addLayer({
            id: ENDPOINTS_ID,
            type: "circle",
            source: `${SOURCE_ID}-pts`,
            paint: {
              "circle-radius": 8,
              "circle-color": ["get", "color"],
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2.5,
            },
          });
        }

        if (route?.coordinates?.length) {
          const bounds = new mapboxgl.LngLatBounds();
          for (const [lng, lat] of route.coordinates) bounds.extend([lng, lat]);
          map.fitBounds(bounds, { padding: 70, duration: 800 });
        }
      } catch {
        /* style gone */
      }
    };

    if (!map.isStyleLoaded()) map.once("load", ensure);
    else ensure();

    return () => {
      cancelled = true;
      try {
        for (const id of [ENDPOINTS_ID, LINE_ID, CASING_ID]) {
          if (map.getLayer(id)) map.removeLayer(id);
        }
        for (const id of [SOURCE_ID, `${SOURCE_ID}-pts`]) {
          if (map.getSource(id)) map.removeSource(id);
        }
      } catch {
        /* gone */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Live updates when the route or endpoints change.
  React.useEffect(() => {
    if (!map) return;
    try {
      (map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features: route?.coordinates?.length
          ? [
              {
                type: "Feature",
                geometry: { type: "LineString", coordinates: route.coordinates },
                properties: {},
              },
            ]
          : [],
      });
      (map.getSource(`${SOURCE_ID}-pts`) as mapboxgl.GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features: [
          ...(from
            ? [
                {
                  type: "Feature",
                  geometry: { type: "Point", coordinates: [from.lng, from.lat] },
                  properties: { color: "#16a34a" },
                } as GeoJSON.Feature,
              ]
            : []),
          ...(to
            ? [
                {
                  type: "Feature",
                  geometry: { type: "Point", coordinates: [to.lng, to.lat] },
                  properties: { color: "#e11d48" },
                } as GeoJSON.Feature,
              ]
            : []),
        ],
      });
      if (route?.coordinates?.length) {
        const bounds = new mapboxgl.LngLatBounds();
        for (const [lng, lat] of route.coordinates) bounds.extend([lng, lat]);
        map.fitBounds(bounds, { padding: 70, duration: 800 });
      }
    } catch {
      /* gone */
    }
  }, [map, route, from, to]);

  return null;
}
