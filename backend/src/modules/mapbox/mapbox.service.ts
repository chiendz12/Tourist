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

/** Mapbox Directions accepts at most 25 coordinates per request. */
const MAX_WAYPOINTS = 25;
/** The traffic-aware profile is limited to 3 waypoints; longer routes use `driving`. */
const TRAFFIC_PROFILE_MAX_WAYPOINTS = 3;

@Injectable()
export class MapboxService {
  private readonly logger = new Logger(MapboxService.name);

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

  directions(coordinates: [number, number][]) {
    const client = mbxDirections({ accessToken: this.getToken() });
    return client
      .getDirections({
        profile: this.profileFor(coordinates.length),
        waypoints: coordinates.map((coords) => ({ coordinates: coords })),
        geometries: 'geojson',
        overview: 'full',
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
