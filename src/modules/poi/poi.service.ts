import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

const USER_AGENT =
  'VietJourney-POI/1.0 (+https://touristmap.local)';
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const FETCH_TIMEOUT_MS = 8000;
/** The public Overpass instance is best-effort; cap the bbox span to ~1°. */
const MAX_BBOX_DEG = 1;

export type PoiKind = 'hotel' | 'restaurant';

export interface PoiRecord {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: PoiKind;
  tags: Record<string, string>;
}

const CACHE_TTL_MS = 30 * 60 * 1000;

type CacheEntry = { at: number; data: { hotels: PoiRecord[]; restaurants: PoiRecord[] } };

const cache = new Map<string, CacheEntry>();

function bboxKey(south: number, west: number, north: number, east: number, types: string[]) {
  // Round to ~0.01° (~1.1 km) so that micro-pans don't refetch.
  const r = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
  return `${r(south)},${r(west)},${r(north)},${r(east)}|${[...types].sort().join(',')}`;
}

function isExpired(entry: CacheEntry): boolean {
  return Date.now() - entry.at > CACHE_TTL_MS;
}

@Injectable()
export class PoiService {
  private readonly logger = new Logger(PoiService.name);

  async fetchHotelsAndFood(
    south: number,
    west: number,
    north: number,
    east: number,
    types: PoiKind[],
  ): Promise<{ hotels: PoiRecord[]; restaurants: PoiRecord[] }> {
    if (north <= south || east <= west) {
      throw new BadRequestException('Invalid bounding box');
    }
    const latSpan = north - south;
    const lngSpan = east - west;
    if (latSpan > MAX_BBOX_DEG || lngSpan > MAX_BBOX_DEG) {
      throw new BadRequestException(
        `Bbox span too large (max ${MAX_BBOX_DEG}° per side)`,
      );
    }

    const key = bboxKey(south, west, north, east, types);
    const cached = cache.get(key);
    if (cached && !isExpired(cached)) {
      return cached.data;
    }

    const query = this.buildOverpassQuery(south, west, north, east, types);
    let raw: OverpassResponse;
    try {
      raw = await this.fetchOverpass(query);
    } catch (error) {
      if (cached) {
        this.logger.warn(
          `Overpass fetch failed, returning stale cache: ${(error as Error).message}`,
        );
        return cached.data;
      }
      this.logger.error(`Overpass fetch failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        'POI service is temporarily unavailable',
      );
    }

    const grouped = this.toRecords(raw, types);
    cache.set(key, { at: Date.now(), data: grouped });
    return grouped;
  }

  private buildOverpassQuery(
    south: number,
    west: number,
    north: number,
    east: number,
    types: PoiKind[],
  ): string {
    const wantHotel = types.includes('hotel');
    const wantRestaurant = types.includes('restaurant');
    const filters: string[] = [];
    if (wantHotel) {
      filters.push('node["tourism"="hotel"]');
      filters.push('way["tourism"="hotel"]');
      filters.push('node["tourism"="guest_house"]');
      filters.push('node["tourism"="hostel"]');
    }
    if (wantRestaurant) {
      filters.push('node["amenity"="restaurant"]');
      filters.push('way["amenity"="restaurant"]');
      filters.push('node["amenity"="cafe"]');
      filters.push('node["amenity"="fast_food"]');
    }
    return (
      `[bbox:${south},${west},${north},${east}];` +
      `(${filters.join(';')};);out center tags;`
    );
  }

  private async fetchOverpass(query: string): Promise<OverpassResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: {
          'content-type': 'text/plain',
          'user-agent': USER_AGENT,
        },
        body: query,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Overpass responded ${response.status}`);
      }
      return (await response.json()) as OverpassResponse;
    } finally {
      clearTimeout(timer);
    }
  }

  private toRecords(
    payload: OverpassResponse,
    types: PoiKind[],
  ): { hotels: PoiRecord[]; restaurants: PoiRecord[] } {
    const hotels: PoiRecord[] = [];
    const restaurants: PoiRecord[] = [];
    const wantHotel = types.includes('hotel');
    const wantRestaurant = types.includes('restaurant');

    for (const element of payload.elements ?? []) {
      const coords = pickCoords(element);
      const { lat, lon } = coords;
      if (typeof lat !== 'number' || typeof lon !== 'number') continue;
      const tags = element.tags ?? {};
      const name = tags.name?.trim();
      if (!name) continue;
      const tourism = tags.tourism;
      const amenity = tags.amenity;

      let kind: PoiKind | null = null;
      if (wantHotel && (tourism === 'hotel' || tourism === 'guest_house' || tourism === 'hostel')) {
        kind = 'hotel';
      } else if (
        wantRestaurant &&
        (amenity === 'restaurant' || amenity === 'cafe' || amenity === 'fast_food')
      ) {
        kind = 'restaurant';
      }
      if (!kind) continue;

      const record: PoiRecord = {
        id: `${element.type}/${element.id}`,
        name,
        lat,
        lng: lon,
        kind,
        tags,
      };
      if (kind === 'hotel') hotels.push(record);
      else restaurants.push(record);
    }
    return { hotels, restaurants };
  }
}

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

function pickCoords(element: OverpassElement): { lat?: number; lon?: number } {
  if (typeof element.lat === 'number' && typeof element.lon === 'number') {
    return { lat: element.lat, lon: element.lon };
  }
  if (element.center) return element.center;
  return {};
}
