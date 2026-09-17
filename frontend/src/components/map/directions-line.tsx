"use client";

import * as React from "react";
import mapboxgl from "mapbox-gl";
import { useMap } from "@/components/map/map-view";

const SOURCE_ID = "vj-directions";
const CASING_ID = "vj-directions-casing";
const LINE_ID = "vj-directions-line";
const ENDPOINTS_ID = "vj-directions-endpoints";
const ALT_SOURCE_ID = "vj-directions-alt";
const ALT_LINE_ID = "vj-directions-alt-line";

export interface DirectionsGeometry {
  coordinates: [number, number][];
}

interface DirectionsLineProps {
  /** Selected road polyline from the directions fetch (null = draw nothing). */
  route: DirectionsGeometry | null;
  /** Non-selected alternative routes, drawn grey underneath. */
  alternatives?: DirectionsGeometry[];
  from: { lng: number; lat: number } | null;
  to: { lng: number; lat: number } | null;
}

/** In-app route: white casing + blue line, grey alternatives, green/red endpoint dots. */
export function DirectionsLine({ route, alternatives = [], from, to }: DirectionsLineProps) {
  const map = useMap();
  // Key of the last route the camera fitted to. Guards fitBounds so it runs
  // once per actual route change — never once per render — otherwise every
  // re-render yanks the camera back and the map feels frozen.
  const fittedKeyRef = React.useRef<string | null>(null);

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

        const alt: GeoJSON.FeatureCollection = {
          type: "FeatureCollection",
          features: alternatives
            .filter((a) => a.coordinates?.length)
            .map((a) => ({
              type: "Feature",
              geometry: { type: "LineString", coordinates: a.coordinates },
              properties: {},
            })),
        };
        if (!map.getSource(ALT_SOURCE_ID)) {
          map.addSource(ALT_SOURCE_ID, { type: "geojson", data: alt });
        } else {
          (map.getSource(ALT_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined)?.setData(alt);
        }
        if (!map.getLayer(ALT_LINE_ID)) {
          map.addLayer(
            {
              id: ALT_LINE_ID,
              type: "line",
              source: ALT_SOURCE_ID,
              layout: { "line-join": "round", "line-cap": "round" },
              paint: { "line-color": "#94a3b8", "line-width": 3.5, "line-opacity": 0.7 },
            },
            // Underneath the selected route so the highlight stays on top.
            map.getLayer(LINE_ID) ? LINE_ID : undefined,
          );
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
          const first = route.coordinates[0];
          const last = route.coordinates[route.coordinates.length - 1];
          fittedKeyRef.current = `${route.coordinates.length}|${first[0]},${first[1]}|${last[0]},${last[1]}`;
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
        for (const id of [ENDPOINTS_ID, LINE_ID, CASING_ID, ALT_LINE_ID]) {
          if (map.getLayer(id)) map.removeLayer(id);
        }
        for (const id of [SOURCE_ID, `${SOURCE_ID}-pts`, ALT_SOURCE_ID]) {
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
      (map.getSource(ALT_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined)?.setData({
        type: "FeatureCollection",
        features: alternatives
          .filter((a) => a.coordinates?.length)
          .map((a) => ({
            type: "Feature",
            geometry: { type: "LineString", coordinates: a.coordinates },
            properties: {},
          })),
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
        const first = route.coordinates[0];
        const last = route.coordinates[route.coordinates.length - 1];
        const key = `${route.coordinates.length}|${first[0]},${first[1]}|${last[0]},${last[1]}`;
        if (key !== fittedKeyRef.current) {
          fittedKeyRef.current = key;
          const bounds = new mapboxgl.LngLatBounds();
          for (const [lng, lat] of route.coordinates) bounds.extend([lng, lat]);
          map.fitBounds(bounds, { padding: 70, duration: 800 });
        }
      } else {
        fittedKeyRef.current = null;
      }
    } catch {
      /* gone */
    }
  }, [map, route, alternatives, from, to]);

  return null;
}
