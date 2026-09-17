import {
  BadGatewayException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import mbxGeocoding from '@mapbox/mapbox-sdk/services/geocoding';
import mbxDirections from '@mapbox/mapbox-sdk/services/directions';
import { Coordinates } from '../../types';
import { haversineDistanceMeters } from '../../utils/geo.utils';

type MapboxResponse<T = any> = { body: T };

export type LineStringGeometry = { type: 'LineString'; coordinates: [number, number][] };

export type RouteGeometry = {
  geometry: LineStringGeometry;
  distanceM: number;
  /** null when the geometry is not road-routed — see {@link MapboxService.straightLineThrough}. */
  durationS: number | null;
  source: 'MAPBOX' | 'STRAIGHT_LINE';
};

/**
 * OSM institution names usually carry a "Trường" prefix users omit
 * ("Trường Đại học Ngoại thương" vs "đại học ngoại thương"). Returns the
 * expanded query, or null when no expansion applies.
 */
function expandInstitutionQuery(query: string): string | null {
  const normalized = query.trim().toLowerCase();
  if (normalized.startsWith('trường ') || normalized.startsWith('truong ')) return null;
  const heads = [
    'đại học',
    'dai hoc',
    'học viện',
    'hoc vien',
    'cao đẳng',
    'cao dang',
    'trung học',
    'trung hoc',
    'tiểu học',
    'tieu hoc',
    'mầm non',
    'mam non',
    'phổ thông',
    'pho thong',
  ];
  if (heads.some((head) => normalized === head || normalized.startsWith(`${head} `))) {
    return `trường ${query.trim()}`;
  }
  return null;
}

/** Compose "road, suburb, city, state, country" when display_name is absent. */
function composeOsmAddress(address?: Record<string, string | undefined>): string {  return [
    address?.road,
    address?.suburb ?? address?.neighbourhood,
    address?.city ?? address?.town ?? address?.village ?? address?.county,
    address?.state,
    address?.country,
  ].filter((part): part is string => !!part?.trim()).join(', ');
}

/** Mapbox Directions accepts at most 25 coordinates per request. */
const MAX_WAYPOINTS = 25;
/** The traffic-aware profile is limited to 3 waypoints; longer routes use `driving`. */
const TRAFFIC_PROFILE_MAX_WAYPOINTS = 3;

/** Nominatim (OpenStreetMap) usage policy: max 1 req/s, valid User-Agent. */
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_MIN_INTERVAL_MS = 1100;
const NOMINATIM_CACHE_TTL_MS = 60 * 60 * 1000;

export interface OsmPlaceHit {
  id: string;
  name: string;
  address: string;
  lng: number;
  lat: number;
}

interface NominatimRow {
  place_id: number;
  name?: string;
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: Record<string, string | undefined>;
}

@Injectable()
export class MapboxService {
  private readonly logger = new Logger(MapboxService.name);
  private nominatimLastCall = 0;
  private readonly nominatimCache = new Map<string, { at: number; hits: OsmPlaceHit[] }>();

  constructor(private readonly config: ConfigService) {}

  geocode(query: string) {
    // Client creation must stay inside the wrapper: the SDK validates the access
    // token when the client is built and throws synchronously, so constructing it
    // outside would escape the handler entirely.
    return this.proxy('geocode', () =>
      this.createGeocodingClient()
        .forwardGeocode({ query, limit: 5, language: ['vi'] })
        .send()
        .then((res: MapboxResponse) => res.body),
    );
  }

  reverseGeocode(lng: number, lat: number) {
    return this.proxy('reverse geocode', () =>
      this.createGeocodingClient()
        .reverseGeocode({ query: [lng, lat], language: ['vi'] })
        .send()
        .then((res: MapboxResponse) => res.body),
    );
  }

  /**
   * OpenStreetMap forward search, proxied so browsers don't have to call
   * Nominatim directly (referer blocks, 429s). Server-side we serialize
   * calls to respect the 1 req/s policy, identify with a User-Agent, and
   * cache per query for an hour. Never throws — callers fall back.
   *
   * OSM names institutions with a "Trường" prefix ("Trường Đại học Ngoại
   * thương") that users omit, so when the raw query yields few hits we fire
   * one expanded follow-up ("trường " + query) and merge.
   */
  async searchPlaces(query: string, viewbox?: string): Promise<OsmPlaceHit[]> {
    if (query.length < 2) return [];
    const key = `${query.toLowerCase()}|${viewbox ?? ''}`;
    const cached = this.nominatimCache.get(key);
    if (cached && Date.now() - cached.at < NOMINATIM_CACHE_TTL_MS) return cached.hits;
    try {
      const hits = await this.fetchNominatim(query, viewbox);
      const expanded = expandInstitutionQuery(query);
      if (hits.length < 4 && expanded) {
        const extra = await this.fetchNominatim(expanded);
        const seen = new Set(hits.map((hit) => hit.id));
        for (const hit of extra) {
          if (!seen.has(hit.id)) {
            seen.add(hit.id);
            hits.push(hit);
          }
          if (hits.length >= 10) break;
        }
      }
      this.nominatimCache.set(key, { at: Date.now(), hits });
      return hits;
    } catch (error) {
      this.logger.warn(`Nominatim search failed: ${(error as Error).message}`);
      return cached?.hits ?? [];
    }
  }

  /** Single throttled Nominatim call returning normalized hits (may be empty). */
  private async fetchNominatim(query: string, viewbox?: string): Promise<OsmPlaceHit[]> {
    const wait = NOMINATIM_MIN_INTERVAL_MS - (Date.now() - this.nominatimLastCall);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    const bias = viewbox ? `&viewbox=${encodeURIComponent(viewbox)}&bounded=0` : '';
    const url =
      `${NOMINATIM_URL}?q=${encodeURIComponent(query)}` +
      `&countrycodes=vn&format=jsonv2&addressdetails=1&limit=8&accept-language=vi${bias}`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'VietJourney/1.0 (https://tourist-roan.vercel.app; contact admin@touristmap.local)',
        Referer: 'https://tourist-roan.vercel.app/',
      },
    });
    this.nominatimLastCall = Date.now();
    if (!res.ok) return [];
    const rows = (await res.json()) as NominatimRow[];
    return (Array.isArray(rows) ? rows : [])
      .filter((row) => row.lat != null && row.lon != null)
      .map((row) => {
        const address = row.display_name || composeOsmAddress(row.address);
        return {
          id: `osm-${row.place_id}`,
          name:
            row.name || (row.display_name ?? '').split(',')[0] || address.split(',')[0] || query,
          address,
          lng: Number(row.lon),
          lat: Number(row.lat),
        };
      })
      .filter((hit) => Number.isFinite(hit.lng) && Number.isFinite(hit.lat));
  }

  directions(coordinates: [number, number][]) {
    const client = mbxDirections({ accessToken: this.getToken() });
    return client
      .getDirections({
        profile: this.profileFor(coordinates.length),
        waypoints: coordinates.map((coords) => ({ coordinates: coords })),
        geometries: 'geojson',
        overview: 'full',
        // Return alternative routes when they exist so the map can offer
        // a choice; callers that only need one keep using routes[0].
        alternatives: true,
      })
      .send()
      .then((res: MapboxResponse) => res.body);
  }

  /**
   * An upstream failure is not our internal error, and the provider's message can
   * name our credentials ("Invalid token"), so it must not be echoed to the client.
   */
  private async proxy<T>(operation: string, run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      // A missing token is our own misconfiguration (503), not an upstream fault.
      if (error instanceof HttpException) throw error;
      this.logger.error(`Mapbox ${operation} failed: ${(error as Error).message}`);
      throw new BadGatewayException(`Map service ${operation} is unavailable`);
    }
  }

  /**
   * Road geometry for a list of stops, or `null` when routing is unavailable.
   *
   * Never throws: a missing token, an API outage or too many stops must not stop a
   * student from saving their route. Callers fall back to {@link straightLineThrough}.
   */
  async tryDirections(coordinates: [number, number][]): Promise<RouteGeometry | null> {
    if (coordinates.length < 2) return null;
    if (coordinates.length > MAX_WAYPOINTS) {
      this.logger.warn(
        `Route has ${coordinates.length} stops; Mapbox Directions allows ${MAX_WAYPOINTS}`,
      );
      return null;
    }
    try {
      const body = await this.directions(coordinates);
      const route = body?.routes?.[0];
      if (!route?.geometry?.coordinates?.length) return null;
      return {
        geometry: route.geometry as LineStringGeometry,
        distanceM: Number(route.distance),
        durationS: Math.round(Number(route.duration)),
        source: 'MAPBOX',
      };
    } catch (error) {
      this.logger.warn(`Mapbox Directions failed: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Fallback geometry: the stops joined in order. `durationS` stays null on purpose —
   * a straight line cannot tell you travel time, and reporting one would quietly
   * corrupt the route-quality indicators.
   */
  straightLineThrough(points: Coordinates[]): RouteGeometry | null {
    if (points.length < 2) return null;
    return {
      geometry: {
        type: 'LineString',
        coordinates: points.map((point) => [point.lng, point.lat] as [number, number]),
      },
      distanceM: points
        .slice(1)
        .reduce((total, point, index) => total + haversineDistanceMeters(points[index], point), 0),
      durationS: null,
      source: 'STRAIGHT_LINE',
    };
  }

  staticMapUrl(lng: number, lat: number, zoom = 12, width = 600, height = 400) {
    const token = this.getToken();
    return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s+e11d48(${lng},${lat})/${lng},${lat},${zoom}/${width}x${height}?access_token=${token}`;
  }

  private profileFor(waypointCount: number) {
    return waypointCount > TRAFFIC_PROFILE_MAX_WAYPOINTS ? 'driving' : 'driving-traffic';
  }

  private createGeocodingClient() {
    return mbxGeocoding({ accessToken: this.getToken() });
  }

  private getToken() {
    const token =
      this.config.get<string>('mapbox.secretToken') || this.config.get<string>('mapbox.publicToken');
    if (!token) throw new ServiceUnavailableException('Mapbox token is not configured');
    return token;
  }
}
