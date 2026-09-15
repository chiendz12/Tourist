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

export interface SearchBias {
  /** Nominatim viewbox "minLng,maxLat,maxLng,minLat" — biases toward the map view. */
  viewbox?: string;
  /** Mapbox proximity point — biases nearby results up. */
  proximity?: { lng: number; lat: number };
}

async function searchMapbox(
  query: string,
  limit = 6,
  bias?: SearchBias,
): Promise<PlaceResult[]> {
  if (!NEXT_PUBLIC_MAPBOX_TOKEN) return [];
  try {
    const proximity =
      bias?.proximity && Number.isFinite(bias.proximity.lng) && Number.isFinite(bias.proximity.lat)
        ? `&proximity=${bias.proximity.lng},${bias.proximity.lat}`
        : "";
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query.trim())}.json` +
        `?access_token=${encodeURIComponent(NEXT_PUBLIC_MAPBOX_TOKEN)}&language=vi&limit=${limit}&country=vn&bbox=102,8,110,24${proximity}`,
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

async function searchOsm(query: string, bias?: SearchBias): Promise<PlaceResult[]> {
  // Browser-direct first: the user's own IP is rarely throttled (unlike our
  // shared server egress, which Nominatim rate-limits). Backend proxy —
  // proper UA, serialized, cached — is the fallback for blocked browsers.
  const raw = query.trim();
  const direct = await searchOsmDirect(raw, bias?.viewbox);
  // OSM names institutions with a "Trường" prefix users omit ("Trường Đại
  // học Ngoại thương"): one expanded follow-up when the raw query is thin.
  const expanded = expandInstitutionQuery(raw);
  if (direct.length < 4 && expanded) {
    const extra = await searchOsmDirect(expanded, bias?.viewbox);
    const seen = new Set(direct.map((d) => d.id));
    for (const hit of extra) {
      if (!seen.has(hit.id)) {
        seen.add(hit.id);
        direct.push(hit);
      }
      if (direct.length >= 10) break;
    }
  }
  if (direct.length) return direct;
  try {
    const { geoApi } = await import("@/lib/api/services");
    const hits = await geoApi.search(raw, bias?.viewbox);
    return (Array.isArray(hits) ? hits : [])
      .filter((h) => Number.isFinite(h.lng) && Number.isFinite(h.lat))
      .map((h) => ({
        id: h.id.startsWith("osm-") ? h.id : `osm-${h.id}`,
        name: h.name || raw,
        address: h.address || "",
        lng: Number(h.lng),
        lat: Number(h.lat),
        source: "OpenStreetMap" as const,
      }));
  } catch {
    return [];
  }
}

/**
 * Mirror of the backend expansion: OSM institution names usually carry a
 * "Trường" prefix users omit.
 */
function expandInstitutionQuery(query: string): string | null {
  const normalized = query.trim().toLowerCase();
  if (normalized.startsWith("trường ") || normalized.startsWith("truong ")) return null;
  const heads = [
    "đại học",
    "dai hoc",
    "học viện",
    "hoc vien",
    "cao đẳng",
    "cao dang",
    "trung học",
    "trung hoc",
    "tiểu học",
    "tieu hoc",
    "mầm non",
    "mam non",
    "phổ thông",
    "pho thong",
  ];
  if (heads.some((head) => normalized === head || normalized.startsWith(`${head} `))) {
    return `trường ${query.trim()}`;
  }
  return null;
}

async function searchOsmDirect(query: string, viewbox?: string): Promise<PlaceResult[]> {
  try {
    const bias = viewbox ? `&viewbox=${encodeURIComponent(viewbox)}&bounded=0` : "";
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query.trim())}` +
        `&countrycodes=vn&format=jsonv2&addressdetails=1&limit=8&accept-language=vi${bias}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return [];
    const body = (await res.json()) as Array<{
      place_id: number;
      name?: string;
      display_name?: string;
      lat?: string;
      lon?: string;
      address?: {
        road?: string;
        suburb?: string;
        neighbourhood?: string;
        city?: string;
        town?: string;
        village?: string;
        county?: string;
        state?: string;
        country?: string;
      };
    }>;
    return (Array.isArray(body) ? body : [])
      .filter((f) => f.lat != null && f.lon != null)
      .map((f) => {
        // display_name is occasionally absent — compose from parts instead
        // of leaving the suggestion row address-less.
        const a = f.address;
        const composed = [
          a?.road,
          a?.suburb ?? a?.neighbourhood,
          a?.city ?? a?.town ?? a?.village ?? a?.county,
          a?.state,
          a?.country,
        ].filter((x): x is string => !!x?.trim());
        const address = f.display_name || composed.join(", ");
        return {
          id: `osm-${f.place_id}`,
          name: f.name || (f.display_name ?? "").split(",")[0] || composed[0] || query.trim(),
          address,
          lng: Number(f.lon),
          lat: Number(f.lat),
          source: "OpenStreetMap" as const,
        };
      })
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
 *
 * Nominatim allows ~1 req/s and answers 429 to parallel bursts, so it gets
 * exactly ONE call per search (raw query). Variant fan-out (unaccented +
 * generic-prefix stripped, e.g. "đường lạc long quân" → "lạc long quân")
 * runs on Mapbox only, which tolerates parallelism. Everything merges with
 * provenance-aware dedupe, cap 10.
 */
export async function searchPlaces(query: string, bias?: SearchBias): Promise<PlaceResult[]> {
  if (query.trim().length < 2) return [];
  const raw = query.trim();
  const stripped = stripGenericPrefix(raw);
  const jobs: Array<Promise<PlaceResult[]>> = [
    searchLocal(raw),
    searchOsm(raw, bias),
    searchMapbox(raw, 8, bias),
  ];
  if (stripped.length >= 2 && stripped !== raw) jobs.push(searchMapbox(stripped, 6, bias));
  const settled = await Promise.all(jobs);
  const seen = new Set<string>();
  const pooled: PlaceResult[] = [];
  for (const r of settled.flat()) {
    const key = `${r.name.toLowerCase()}|${r.lng.toFixed(3)},${r.lat.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pooled.push(r);
  }
  // Best textual matches first so real academies outrank fuzzy noise.
  return rankPlaces(pooled, raw).slice(0, 10);
}

/** Single-word Vietnamese generics ignored when judging a close match. */
const GENERIC_WORDS = new Set([
  "khu", "do", "đô", "thi", "thị", "phuong", "phường", "xa", "xã",
  "tinh", "tỉnh", "quan", "quận", "huyen", "huyện", "thanh", "thành",
  "pho", "phố", "duong", "đường", "dai", "đại", "lo", "lộ", "ho", "hồ",
  "song", "sông", "nui", "núi", "chua", "chùa", "den", "đền", "dinh", "đình",
  "cau", "cầu", "cho", "chợ", "cong", "công", "vien", "viên", "truong", "trường",
  "cua", "của", "va", "và",
]);

/** Leading place-type phrases ("khu đô thị", "phường", "đường", …). */
const GENERIC_PREFIX =
  /^(khu\s+đô\s+thị|khu\s+dân\s+cư|khu\s+công\s+nghiệp|thị\s+trấn|thành\s+phố|đại\s+lộ|công\s+viên|bảo\s+tàng|bãi\s+biển|khu|phường|phuong|xã|xa|tỉnh|tinh|quận|quan|huyện|huyen|đường|duong|phố|pho|hồ|ho|sông|song|núi|nui|chùa|chua|đền|den|đình|cầu|cau|chợ|cho|trường|sông)\s+/i;

export function stripAccents(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function stripGenericPrefix(value: string): string {
  return value.replace(GENERIC_PREFIX, "").trim();
}

function significantWords(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !GENERIC_WORDS.has(w) && !GENERIC_WORDS.has(stripAccents(w)));
}

function matchScore(r: PlaceResult, queryLower: string, words: string[]): number {
  const name = r.name.toLowerCase();
  if (name.includes(queryLower)) return 2;
  if (words.length === 0) return 1;
  const hay = `${r.name} ${r.address}`.toLowerCase();
  return words.every((w) => hay.includes(w) || hay.includes(stripAccents(w))) ? 1 : 0;
}

/**
 * Best textual matches first (stable — ties keep provider order, so local
 * curated hits still lead among equals). Full-phrase name containment wins,
 * then all-significant-words coverage, then the rest.
 */
export function rankPlaces(results: PlaceResult[], query: string): PlaceResult[] {
  const queryLower = query.trim().toLowerCase();
  const words = significantWords(query);
  return results
    .map((r, i) => ({ r, i }))
    .sort((a, b) => matchScore(b.r, queryLower, words) - matchScore(a.r, queryLower, words) || a.i - b.i)
    .map((x) => x.r);
}

/**
 * True when some result's name covers every significant query word —
 * used to decide whether to suggest adding district/province detail.
 */
export function hasCloseMatch(results: PlaceResult[], query: string): boolean {
  const words = significantWords(query);
  if (words.length === 0) return true;
  const queryLower = query.trim().toLowerCase();
  return results.some((r) => matchScore(r, queryLower, words) >= 1);
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
