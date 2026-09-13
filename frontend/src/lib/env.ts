/**
 * Public env values are inlined at build time (NEXT_PUBLIC_*).
 * Server-only values fall back to the public URL when unset.
 */
export const NEXT_PUBLIC_API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

export const API_URL_INTERNAL =
  process.env.API_URL_INTERNAL ?? NEXT_PUBLIC_API_URL;

export const NEXT_PUBLIC_MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

export const MAP_DEFAULTS = {
  center: [
    Number(process.env.NEXT_PUBLIC_MAP_CENTER_LNG ?? 106.0),
    Number(process.env.NEXT_PUBLIC_MAP_CENTER_LAT ?? 16.0),
  ] as [number, number],
  zoom: Number(process.env.NEXT_PUBLIC_MAP_ZOOM ?? 5),
};

/** Full-color basemap used by every map on the site. */
export const MAP_STYLE =
  process.env.NEXT_PUBLIC_MAP_STYLE ?? "mapbox://styles/mapbox/streets-v12";
