import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalStatus, EntityType, Prisma, Role } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';
import {
  Actor,
  assertCanDelete,
  assertCanUpdate,
  canRead,
} from '../../common/utils/ownership.util';
import { PrismaService } from '../../prisma/prisma.service';
import { Coordinates, PaginatedResult } from '../../types';
import { LineStringGeometry, MapboxService, RouteGeometry } from '../mapbox/mapbox.service';
import { ProvinceAccessService } from '../province/province-access.service';
import { CreateRouteDto, RouteWaypointDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';

const ROUTE_INCLUDE = {
  waypoints: { orderBy: { order: 'asc' }, include: { destination: true } },
} satisfies Prisma.RouteInclude;

type WithPath<T> = T & { path: LineStringGeometry | null };

@Injectable()
export class RouteService {
  private readonly logger = new Logger(RouteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mapbox: MapboxService,
    private readonly provinceAccess: ProvinceAccessService,
  ) {}

  async findPublic(query: PaginationDto, actor?: Actor) {
    return this.paginate({ status: ApprovalStatus.PUBLISHED, ...(await this.provinceWhere(actor)) }, query);
  }

  async findMine(query: PaginationDto, actor: Actor) {
    return this.paginate({ createdById: actor.id, ...(await this.provinceWhere(actor)) }, query);
  }

  async findOne(id: string, actor?: Actor) {
    const found = await this.prisma.route.findUnique({
      where: { id },
      include: { ...ROUTE_INCLUDE, tours: true },
    });
    // Unpublished routes must not be distinguishable from missing ones.
    if (!found || !canRead(found, actor)) throw new NotFoundException('Route not found');
    if (actor) {
      await this.provinceAccess.assertCanAccessProvinces(
        actor,
        found.waypoints.map((waypoint) => waypoint.destination.provinceId),
      );
    }
    const [withPath] = await this.attachPaths([found]);
    return withPath;
  }

  async create(dto: CreateRouteDto, actor: Actor) {
    const destinations = await this.assertWaypointsValid(dto.waypoints);
    await this.provinceAccess.assertCanAccessProvinces(
      actor,
      destinations.map((destination) => destination.provinceId),
    );
    const created = await this.prisma.route.create({
      data: {
        name: dto.name,
        description: dto.description,
        createdById: actor.id,
        waypoints: { create: dto.waypoints.map(toWaypointData) },
      },
      select: { id: true },
    });
    await this.recomputeGeometry(created.id);
    // The actor must be passed through: a fresh route is DRAFT, and an anonymous
    // read of a DRAFT is a 404 by design.
    return this.findOne(created.id, actor);
  }

  async update(id: string, dto: UpdateRouteDto, actor: Actor) {
    const existing = await this.prisma.route.findUnique({
      where: { id },
      select: {
        id: true,
        createdById: true,
        status: true,
        waypoints: { select: { destination: { select: { provinceId: true } } } },
      },
    });
    if (!existing) throw new NotFoundException('Route not found');
    assertCanUpdate(existing, actor, 'route');

    if (dto.waypoints) {
      const destinations = await this.assertWaypointsValid(dto.waypoints);
      await this.provinceAccess.assertCanAccessProvinces(
        actor,
        destinations.map((destination) => destination.provinceId),
      );
    } else {
      await this.provinceAccess.assertCanAccessProvinces(
        actor,
        existing.waypoints.map((waypoint) => waypoint.destination.provinceId),
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.route.update({
        where: { id },
        data: { name: dto.name, description: dto.description },
      });
      if (dto.waypoints) {
        // The ordered list is replaced wholesale — simpler and safer than diffing
        // against the @@unique([routeId, order]) constraint.
        await tx.routeWaypoint.deleteMany({ where: { routeId: id } });
        await tx.routeWaypoint.createMany({
          data: dto.waypoints.map((waypoint) => ({ routeId: id, ...toWaypointData(waypoint) })),
        });
      }
    });
    // Stops changed ⇒ the stored line no longer matches them.
    if (dto.waypoints) await this.recomputeGeometry(id);
    return this.findOne(id, actor);
  }

  /** Re-run routing without touching the stops (token added later, traffic changed, …). */
  async recalculate(id: string, actor: Actor) {
    const existing = await this.prisma.route.findUnique({
      where: { id },
      select: {
        id: true,
        createdById: true,
        status: true,
        waypoints: { select: { destination: { select: { provinceId: true } } } },
      },
    });
    if (!existing) throw new NotFoundException('Route not found');
    await this.provinceAccess.assertCanAccessProvinces(
      actor,
      existing.waypoints.map((waypoint) => waypoint.destination.provinceId),
    );
    // Deliberately NOT assertCanUpdate: the path is derived from the stops, not authored
    // content, so recomputing it is allowed even once the route is published — otherwise
    // a published route could never acquire its geometry (e.g. the token arrived later).
    const isStaff = actor.role === Role.SUPER_ADMIN || actor.role === Role.LECTURER;
    if (!isStaff && existing.createdById !== actor.id) {
      throw new ForbiddenException('You may only recalculate your own route');
    }
    const geometry = await this.recomputeGeometry(id);
    return {
      id,
      source: geometry?.source ?? 'NONE',
      distanceM: geometry?.distanceM ?? null,
      durationS: geometry?.durationS ?? null,
    };
  }

  async remove(id: string, actor: Actor) {
    const existing = await this.prisma.route.findUnique({
      where: { id },
      select: {
        id: true,
        createdById: true,
        status: true,
        waypoints: { select: { destination: { select: { provinceId: true } } } },
        _count: { select: { tours: true } },
      },
    });
    if (!existing) throw new NotFoundException('Route not found');
    await this.provinceAccess.assertCanAccessProvinces(
      actor,
      existing.waypoints.map((waypoint) => waypoint.destination.provinceId),
    );
    assertCanDelete(existing, actor, 'route');
    if (existing._count.tours > 0) {
      throw new ConflictException('This route is used by one or more tours; detach them first');
    }
    // `Approval` has no foreign key to the entity, so clean it up explicitly.
    await this.prisma.$transaction([
      this.prisma.approval.deleteMany({ where: { entityType: EntityType.ROUTE, entityId: id } }),
      this.prisma.route.delete({ where: { id } }),
    ]);
    return { id, deleted: true };
  }

  /**
   * Ask Mapbox for the road geometry between the stops and persist it. Falls back to a
   * straight line through the stops when routing is unavailable, so the map always has
   * something to draw; never throws, because losing the geometry must not lose the route.
   */
  private async recomputeGeometry(routeId: string): Promise<RouteGeometry | null> {
    try {
      const stops = await this.waypointCoordinates(routeId);
      if (stops.length < 2) {
        await this.clearGeometry(routeId);
        return null;
      }
      const coordinates = stops.map((stop) => [stop.lng, stop.lat] as [number, number]);
      const geometry =
        (await this.mapbox.tryDirections(coordinates)) ?? this.mapbox.straightLineThrough(stops);
      if (!geometry) {
        await this.clearGeometry(routeId);
        return null;
      }
      if (geometry.source === 'STRAIGHT_LINE') {
        this.logger.warn(`Route ${routeId}: routing unavailable, stored a straight-line path`);
      }
      await this.prisma.$executeRaw`
        UPDATE "Route"
        SET "path" = ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(geometry.geometry)}::text), 4326),
            "distanceM" = ${geometry.distanceM}::float8,
            "durationS" = ${geometry.durationS},
            "updatedAt" = NOW()
        WHERE "id" = ${routeId}
      `;
      return geometry;
    } catch (error) {
      this.logger.error(`Could not compute geometry for route ${routeId}`, error as Error);
      return null;
    }
  }

  private clearGeometry(routeId: string) {
    return this.prisma.$executeRaw`
      UPDATE "Route"
      SET "path" = NULL, "distanceM" = NULL, "durationS" = NULL, "updatedAt" = NOW()
      WHERE "id" = ${routeId}
    `;
  }

  private waypointCoordinates(routeId: string) {
    return this.prisma.$queryRaw<Coordinates[]>`
      SELECT ST_X(d."location") AS "lng", ST_Y(d."location") AS "lat"
      FROM "RouteWaypoint" w
      JOIN "Destination" d ON d."id" = w."destinationId"
      WHERE w."routeId" = ${routeId}
      ORDER BY w."order" ASC
    `;
  }

  /**
   * `path` is `Unsupported("geometry(LineString,4326)")`, so Prisma cannot select it.
   * One extra raw query per page projects it as GeoJSON and merges it back in.
   */
  private async attachPaths<T extends { id: string }>(routes: T[]): Promise<WithPath<T>[]> {
    if (routes.length === 0) return [];
    const rows = await this.prisma.$queryRaw<{ id: string; path: LineStringGeometry | null }[]>`
      SELECT "id", ST_AsGeoJSON("path")::json AS "path"
      FROM "Route"
      WHERE "id" IN (${Prisma.join(routes.map((route) => route.id))})
    `;
    const paths = new Map(rows.map((row) => [row.id, row.path]));
    return routes.map((route) => ({ ...route, path: paths.get(route.id) ?? null }));
  }

  private async paginate(
    where: Prisma.RouteWhereInput,
    query: PaginationDto,
  ): Promise<PaginatedResult<unknown>> {
    const skip = (query.page - 1) * query.limit;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.route.findMany({
        where,
        include: ROUTE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
      this.prisma.route.count({ where }),
    ]);
    return {
      data: await this.attachPaths(rows),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  /**
   * Học phần 2 may only build on approved data ("truy cập dữ liệu điểm đến (đã duyệt)"),
   * so unknown, duplicated or still-unpublished stops are rejected up front rather than
   * surfacing later as opaque constraint errors.
   */
  private async assertWaypointsValid(waypoints: RouteWaypointDto[]) {
    if (!waypoints?.length) {
      throw new BadRequestException('Route requires at least one waypoint');
    }
    const orders = waypoints.map((waypoint) => waypoint.order);
    if (new Set(orders).size !== orders.length) {
      throw new BadRequestException('Waypoint "order" values must be unique within a route');
    }
    const ids = [...new Set(waypoints.map((waypoint) => waypoint.destinationId))];
    const found = await this.prisma.destination.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, status: true, provinceId: true },
    });
    if (found.length !== ids.length) {
      const known = new Set(found.map((destination) => destination.id));
      const missing = ids.filter((id) => !known.has(id));
      throw new BadRequestException(`Unknown destination(s): ${missing.join(', ')}`);
    }
    const unpublished = found.filter(
      (destination) => destination.status !== ApprovalStatus.PUBLISHED,
    );
    if (unpublished.length > 0) {
      const names = unpublished.map((d) => `${d.name} (${d.status})`).join(', ');
      throw new BadRequestException(
        `A route may only use published destinations; not yet approved: ${names}`,
      );
    }
    return found;
  }

  private async provinceWhere(actor?: Actor): Promise<Prisma.RouteWhereInput> {
    if (!actor) return {};
    const provinceIds = await this.provinceAccess.assignedProvinceIds(actor);
    if (provinceIds === null) return {};
    return {
      waypoints: {
        some: { destination: { provinceId: { in: provinceIds } } },
        every: { destination: { provinceId: { in: provinceIds } } },
      },
    };
  }
}

function toWaypointData(waypoint: RouteWaypointDto) {
  return {
    destinationId: waypoint.destinationId,
    order: waypoint.order,
    stayMinutes: waypoint.stayMinutes,
    notes: waypoint.notes,
  };
}
