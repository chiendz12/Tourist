import { NEXT_PUBLIC_MAPBOX_TOKEN } from "@/lib/env";

export interface ReverseContext {
  id: string;
  text: string;
}

export interface ReverseFeature {
  id: string;
  text: string;
  place_name?: string;
  place_type?: string[];
  properties?: { address?: string };
  context?: ReverseContext[];
}

export interface ParsedPlace {
  /** Best display name (POI or street address). */
  name: string;
  /** Full Mapbox place_name as a fallback line. */
  full: string;
  street?: string;
  ward?: string;
  city?: string;
  region?: string;
}

const cache = new Map<string, ParsedPlace | null>();

export interface PlaceResult {
  id: string;
  /** Short name (POI / street / place). */
  name: string;
  /** Full Vietnamese address line. */
  address: string;
  lng: number;
  lat: number;
  source: "VietJourney" | "OpenStreetMap" | "Mapbox";
}

async function searchMapbox(query: string): Promise<PlaceResult[]> {
  if (!NEXT_PUBLIC_MAPBOX_TOKEN) return [];
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query.trim())}.json` +
        `?access_token=${encodeURIComponent(NEXT_PUBLIC_MAPBOX_TOKEN)}&language=vi&limit=6&country=vn&bbox=102,8,110,24`,
    );
    if (!res.ok) return [];
    const body = (await res.json()) as {
      features?: Array<{ id: string; text: string; place_name?: string; center?: [number, number] }>;
    };
    return (body.features ?? [])
      .filter((f) => Array.isArray(f.center))
      .map((f) => ({
        id: `mbx-${f.id}`,
        name: f.text,
        address: f.place_name ?? f.text,
        lng: f.center![0],
        lat: f.center![1],
        source: "Mapbox" as const,
      }));
  } catch {
    return [];
  }
}

async function searchOsm(query: string): Promise<PlaceResult[]> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query.trim())}` +
        `&countrycodes=vn&format=jsonv2&addressdetails=1&limit=5&accept-language=vi`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return [];
    const body = (await res.json()) as Array<{
      place_id: number;
      name?: string;
      display_name?: string;
      lat?: string;
      lon?: string;
    }>;
    return (Array.isArray(body) ? body : [])
      .filter((f) => f.lat != null && f.lon != null)
      .map((f) => ({
        id: `osm-${f.place_id}`,
        name: f.name || (f.display_name ?? "").split(",")[0] || query.trim(),
        address: f.display_name ?? "",
        lng: Number(f.lon),
        lat: Number(f.lat),
        source: "OpenStreetMap" as const,
      }))
      .filter((f) => Number.isFinite(f.lng) && Number.isFinite(f.lat));
  } catch {
    return [];
  }
}

async function searchLocal(query: string): Promise<PlaceResult[]> {
  try {
    const { destinationsApi } = await import("@/lib/api/services");
    const res = await destinationsApi.list({ q: query.trim(), limit: 5 });
    return (res.data ?? []).map((d) => ({
      id: `vj-${d.id}`,
      name: d.name,
      address: d.address || "Điểm đến VietJourney",
      lng: d.lng,
      lat: d.lat,
      source: "VietJourney" as const,
    }));
  } catch {
    return [];
  }
}

/**
 * Combined place search for data entry: our own database first (exact
 * curated places), then OpenStreetMap (real POIs Mapbox lacks, e.g. Chùa
 * Bái Đính), then Mapbox (streets/addresses). Results carry provenance.
 */
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  if (query.trim().length < 2) return [];
  const [local, osm, mapbox] = await Promise.all([
    searchLocal(query),
    searchOsm(query),
    searchMapbox(query),
  ]);
  const seen = new Set<string>();
  const out: PlaceResult[] = [];
  for (const r of [...local, ...osm, ...mapbox]) {
    const key = `${r.name.toLowerCase()}|${r.lng.toFixed(3)},${r.lat.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
    if (out.length >= 8) break;
  }
  return out;
}

function contextText(ctx: ReverseContext[] | undefined, ...prefixes: string[]): string | undefined {
  for (const p of prefixes) {
    const hit = ctx?.find((c) => c.id.startsWith(p));
    if (hit?.text) return hit.text;
  }
  return undefined;
}

/**
 * Direct browser call to Mapbox reverse geocoding (the public pk.* token
 * is designed for client use). Returns structured Vietnamese address
 * parts: building, street, ward/commune, city/province.
 *
 * Two queries run in parallel: the default reverse set (address) plus an
 * explicit `types=poi` lookup, because plain reverse results never
 * contain building/POI names. `hintName` (e.g. the label clicked on the
 * map) wins over any geocoded POI.
 */
export async function reverseGeocode(
  lng: number,
  lat: number,
  hintName?: string,
): Promise<ParsedPlace | null> {
  if (!NEXT_PUBLIC_MAPBOX_TOKEN) return null;
  const key = `${lng.toFixed(4)},${lat.toFixed(4)}`;
  if (!hintName && cache.has(key)) return cache.get(key) ?? null;
  try {
    // NOTE: reverse geocoding rejects `limit` unless a single `types` value
    // is given, so the base call has no limit param.
    const baseUrl =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
      `?access_token=${encodeURIComponent(NEXT_PUBLIC_MAPBOX_TOKEN)}&language=vi`;
    const [baseRes, poiRes] = await Promise.all([
      fetch(baseUrl),
      fetch(`${baseUrl}&types=poi&limit=3`),
    ]);
    if (!baseRes.ok) {
      cache.set(key, null);
      return null;
    }
    const body = (await baseRes.json()) as { features?: ReverseFeature[] };
    const features = body.features ?? [];
    if (!features.length) {
      cache.set(key, null);
      return null;
    }
    let poiName = hintName;
    if (!poiName && poiRes.ok) {
      try {
        const poiBody = (await poiRes.json()) as { features?: ReverseFeature[] };
        poiName = poiBody.features?.find((f) => f.text)?.text;
      } catch {
        /* poi lookup optional */
      }
    }
    // Only true POIs become the title — never a ward/locality/postcode,
    // which previously promoted "Hạng Bò" over the building name.
    const poi = features.find(
      (f) => (f.place_type ?? []).includes("poi") && f.text,
    );
    const addr = features.find((f) => f.id.startsWith("address."));
    const first = features[0];
    const ctx = (addr ?? first).context ?? [];
    const houseNo = addr?.properties?.address;
    const streetName = addr?.text;
    const ward = contextText(ctx, "neighborhood.", "locality.");
    const city = contextText(ctx, "place.");
    const region = contextText(ctx, "region.");
    const cityLine = [city, region && region !== city ? region : undefined]
      .filter((x): x is string => !!x)
      .join(", ");
    const parsed: ParsedPlace = {
      name:
        poiName ||
        poi?.text ||
        (houseNo && streetName
          ? `${houseNo} ${streetName}`
          : streetName || "Vị trí đã chọn"),
      full:
        poi && addr && poi.place_name !== addr.place_name
          ? (poi.place_name ?? addr.place_name ?? "")
          : (addr?.place_name ?? first.place_name ?? ""),
      street: houseNo && streetName ? `${houseNo} ${streetName}` : streetName || undefined,
      ward,
      city: cityLine || undefined,
      region: undefined,
    };
    cache.set(key, parsed);
    return parsed;
  } catch {
    cache.set(key, null);
    return null;
  }
}
