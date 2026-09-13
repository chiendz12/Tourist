import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalStatus, EntityType, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  Actor,
  assertCanDelete,
  assertCanUpdate,
  canRead,
} from '../../common/utils/ownership.util';
import { PrismaService } from '../../prisma/prisma.service';
import { ProvinceAccessService } from '../province/province-access.service';
import { PaginatedResult } from '../../types';
import { assertCoordinates } from '../../utils/geo.utils';
import { resolveWikipediaImage } from '../../utils/wiki-image.util';
import { BboxQueryDto } from './dto/bbox-query.dto';
import { CreateDestinationDto } from './dto/create-destination.dto';
import { NearbyQueryDto } from './dto/nearby-query.dto';
import { QueryDestinationDto } from './dto/query-destination.dto';
import { UpdateDestinationDto } from './dto/update-destination.dto';

export type DestinationRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  address: string | null;
  provinceId: string | null;
  images: unknown;
  openingHours: unknown;
  ticketPrice: Prisma.Decimal | null;
  status: ApprovalStatus;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  lng: number;
  lat: number;
  /** GeoJSON Point — feed straight into Mapbox GL. */
  location: { type: 'Point'; coordinates: [number, number] };
  distanceM?: number;
};

/**
 * `location` is `Unsupported("geometry(Point,4326)")`, so Prisma's query builder
 * cannot select it. Every read goes through raw SQL that projects the geometry
 * as both a GeoJSON object and plain lng/lat.
 */
const DESTINATION_COLUMNS = Prisma.sql`
  d."id", d."name", d."slug", d."description", d."category", d."address",
  d."provinceId", d."images", d."openingHours", d."ticketPrice", d."status",
  d."createdById", d."createdAt", d."updatedAt",
  ST_X(d."location") AS "lng",
  ST_Y(d."location") AS "lat",
  ST_AsGeoJSON(d."location")::json AS "location"
`;

@Injectable()
export class DestinationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provinceAccess: ProvinceAccessService,
  ) {}

  /** Public catalogue — published records only. */
  async findPublic(query: QueryDestinationDto, actor?: Actor): Promise<PaginatedResult<DestinationRow>> {
    const provinceIds = actor ? await this.provinceAccess.assignedProvinceIds(actor) : null;
    const where = this.buildWhere(query, { status: ApprovalStatus.PUBLISHED }, provinceIds);
    return this.paginate(where, query.page, query.limit);
  }

  /** A student's own records in any status, so they can pick one up and edit it. */
  async findMine(query: QueryDestinationDto, actor: Actor): Promise<PaginatedResult<DestinationRow>> {
    const provinceIds = await this.provinceAccess.assignedProvinceIds(actor);
    const where = this.buildWhere(query, { createdById: actor.id, status: query.status }, provinceIds);
    return this.paginate(where, query.page, query.limit);
  }

  async findOne(id: string, actor?: Actor): Promise<DestinationRow> {
    const rows = await this.prisma.$queryRaw<DestinationRow[]>`
      SELECT ${DESTINATION_COLUMNS}
      FROM "Destination" d
      WHERE d."id" = ${id}
      LIMIT 1
    `;
    const found = rows[0];
    // Unpublished records must not be distinguishable from missing ones.
    if (!found || !canRead(found, actor)) throw new NotFoundException('Destination not found');
    if (actor) await this.provinceAccess.assertCanAccessProvinces(actor, [found.provinceId]);
    return found;
  }

  /** Published destinations within `radius` metres, nearest first. */
  async findNearby(query: NearbyQueryDto, actor?: Actor): Promise<DestinationRow[]> {
    assertCoordinates(query.lng, query.lat);
    const origin = Prisma.sql`ST_SetSRID(ST_MakePoint(${query.lng}::float8, ${query.lat}::float8), 4326)::geography`;
    const provinceIds = actor ? await this.provinceAccess.assignedProvinceIds(actor) : null;
    const filters = this.optionalFilters(query, provinceIds);
    return this.prisma.$queryRaw<DestinationRow[]>`
      SELECT ${DESTINATION_COLUMNS},
        ST_Distance(d."location"::geography, ${origin}) AS "distanceM"
      FROM "Destination" d
      WHERE d."status" = ${ApprovalStatus.PUBLISHED}::"ApprovalStatus"
        AND ST_DWithin(d."location"::geography, ${origin}, ${query.radius}::float8)
        ${filters}
      ORDER BY "distanceM" ASC
      LIMIT ${query.limit}
    `;
  }

  /** Published destinations inside the current map viewport. */
  async findInBbox(query: BboxQueryDto, actor?: Actor): Promise<DestinationRow[]> {
    if (query.minLng >= query.maxLng || query.minLat >= query.maxLat) {
      throw new BadRequestException('Bounding box must satisfy minLng < maxLng and minLat < maxLat');
    }
    const provinceIds = actor ? await this.provinceAccess.assignedProvinceIds(actor) : null;
    const filters = this.optionalFilters(query, provinceIds);
    return this.prisma.$queryRaw<DestinationRow[]>`
      SELECT ${DESTINATION_COLUMNS}
      FROM "Destination" d
      WHERE d."status" = ${ApprovalStatus.PUBLISHED}::"ApprovalStatus"
        AND d."location" && ST_MakeEnvelope(
          ${query.minLng}::float8, ${query.minLat}::float8,
          ${query.maxLng}::float8, ${query.maxLat}::float8, 4326)
        ${filters}
      ORDER BY d."createdAt" DESC
      LIMIT ${query.limit}
    `;
  }

  /**
   * The caller's right to write into `dto.provinceId` is enforced by `@ProvinceScope()`
   * on the route; here we only guard against a province id that does not exist
   * (the raw INSERT would otherwise fail on the foreign key with an opaque 500).
   */
  async create(dto: CreateDestinationDto, actor: Actor): Promise<DestinationRow> {
    assertCoordinates(dto.lng, dto.lat);
    await this.assertSlugFree(dto.slug);
    await this.assertProvinceExists(dto.provinceId);
    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO "Destination" ("id", "name", "slug", "description", "category", "address", "provinceId", "location", "images", "openingHours", "ticketPrice", "status", "createdById", "createdAt", "updatedAt")
      VALUES (
        ${id}, ${dto.name}, ${dto.slug}, ${dto.description ?? null},
        ${dto.category ?? 'OTHER'}::"DestinationCategory", ${dto.address ?? null}, ${dto.provinceId ?? null},
        ST_SetSRID(ST_MakePoint(${dto.lng}::float8, ${dto.lat}::float8), 4326),
        ${dto.images ? JSON.stringify(dto.images) : null}::jsonb,
        ${dto.openingHours ? JSON.stringify(dto.openingHours) : null}::jsonb,
        ${dto.ticketPrice ?? null}::numeric,
        'DRAFT'::"ApprovalStatus", ${actor.id}, NOW(), NOW()
      )
    `;
    // The actor must be passed through: a fresh record is DRAFT, and an anonymous
    // read of a DRAFT is a 404 by design.
    return this.findOne(id, actor);
  }

  async update(id: string, dto: UpdateDestinationDto, actor: Actor): Promise<DestinationRow> {
    const existing = await this.prisma.destination.findUnique({
      where: { id },
      select: { id: true, slug: true, provinceId: true, createdById: true, status: true },
    });
    if (!existing) throw new NotFoundException('Destination not found');
    assertCanUpdate(existing, actor, 'destination');

    // A province-scoped editor must be entitled to the province the record ends up in,
    // whether they are changing it or inheriting the one already stored.
    const effectiveProvinceId =
      dto.provinceId !== undefined ? dto.provinceId : existing.provinceId;
    await this.provinceAccess.assertCanWrite(actor, effectiveProvinceId, {
      required: this.provinceAccess.requiresAssignment(actor.role),
    });
    if (dto.provinceId !== undefined) await this.assertProvinceExists(dto.provinceId);

    const { lng, lat, ...scalars } = dto;
    const movesPoint = lng !== undefined || lat !== undefined;
    if (movesPoint) {
      if (lng === undefined || lat === undefined) {
        throw new BadRequestException('Both lng and lat are required to move a destination');
      }
      assertCoordinates(lng, lat);
    }
    if (scalars.slug && scalars.slug !== existing.slug) {
      await this.assertSlugFree(scalars.slug);
    }

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(scalars).length > 0) {
        await tx.destination.update({
          where: { id },
          data: scalars as Prisma.DestinationUncheckedUpdateInput,
        });
      }
      if (movesPoint) {
        await tx.$executeRaw`
          UPDATE "Destination"
          SET "location" = ST_SetSRID(ST_MakePoint(${lng}::float8, ${lat}::float8), 4326),
              "updatedAt" = NOW()
          WHERE "id" = ${id}
        `;
      }
    });
    return this.findOne(id, actor);
  }

  async remove(id: string, actor: Actor) {
    const existing = await this.prisma.destination.findUnique({
      where: { id },
      select: {
        id: true,
        createdById: true,
        status: true,
        _count: { select: { routePoints: true } },
      },
    });
    if (!existing) throw new NotFoundException('Destination not found');
    assertCanDelete(existing, actor, 'destination');
    // RouteWaypoint → Destination is a required relation, so the FK would block the
    // delete with an opaque 500. Surface it as a clear conflict instead.
    if (existing._count.routePoints > 0) {
      throw new ConflictException(
        'This destination is used by one or more routes; remove it from those routes first',
      );
    }
    // `Approval` references entities by (entityType, entityId) without a foreign key,
    // so the approval row has to be cleaned up explicitly.
    await this.prisma.$transaction([
      this.prisma.approval.deleteMany({
        where: { entityType: EntityType.DESTINATION, entityId: id },
      }),
      this.prisma.destination.delete({ where: { id } }),
    ]);
    return { id, deleted: true };
  }

  /**
   * Fetches an accurate representative photo from Wikipedia/Wikimedia and
   * persists it on the destination, so every surfaced record can carry a real
   * image without manual uploads.
   */
  async resolveImage(id: string): Promise<{ id: string; images: string[] }> {
    const destination = await this.prisma.destination.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        images: true,
        province: { select: { name: true } },
      },
    });
    if (!destination) throw new NotFoundException('Destination not found');
    const existing = Array.isArray(destination.images)
      ? (destination.images as unknown[]).filter(
          (item): item is string => typeof item === 'string',
        )
      : [];
    if (existing.length > 0) return { id, images: existing };

    const url = await resolveWikipediaImage(destination.name, destination.province?.name);
    if (!url) throw new NotFoundException('No representative image found for this destination');

    const images = [...existing, url];
    await this.prisma.destination.update({ where: { id }, data: { images } });
    return { id, images };
  }

  private async assertProvinceExists(provinceId?: string | null) {
    if (!provinceId) return;
    const province = await this.prisma.province.findUnique({
      where: { id: provinceId },
      select: { id: true },
    });
    if (!province) throw new NotFoundException(`Province ${provinceId} not found`);
  }

  private async assertSlugFree(slug: string) {
    const clash = await this.prisma.destination.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (clash) throw new ConflictException(`Slug "${slug}" is already taken`);
  }

  /** Category / province filters shared by the two spatial endpoints. */
  private optionalFilters(
    query: { category?: string; provinceId?: string },
    provinceIds: string[] | null = null,
  ): Prisma.Sql {
    const conditions: Prisma.Sql[] = [];
    if (query.category) {
      conditions.push(Prisma.sql`AND d."category" = ${query.category}::"DestinationCategory"`);
    }
    if (query.provinceId) {
      conditions.push(Prisma.sql`AND d."provinceId" = ${query.provinceId}`);
    }
    if (provinceIds) {
      conditions.push(
        provinceIds.length > 0
          ? Prisma.sql`AND d."provinceId" IN (${Prisma.join(provinceIds)})`
          : Prisma.sql`AND FALSE`,
      );
    }
    return conditions.length > 0 ? Prisma.join(conditions, ' ') : Prisma.empty;
  }

  private buildWhere(
    query: QueryDestinationDto,
    scope: { status?: ApprovalStatus; createdById?: string },
    provinceIds: string[] | null = null,
  ): Prisma.Sql {
    const conditions: Prisma.Sql[] = [];
    if (scope.status) {
      conditions.push(Prisma.sql`d."status" = ${scope.status}::"ApprovalStatus"`);
    }
    if (scope.createdById) {
      conditions.push(Prisma.sql`d."createdById" = ${scope.createdById}`);
    }
    if (query.provinceId) {
      conditions.push(Prisma.sql`d."provinceId" = ${query.provinceId}`);
    }
    if (query.category) {
      conditions.push(Prisma.sql`d."category" = ${query.category}::"DestinationCategory"`);
    }
    if (query.q) {
      const pattern = `%${query.q}%`;
      conditions.push(Prisma.sql`(d."name" ILIKE ${pattern} OR d."address" ILIKE ${pattern})`);
    }
    if (provinceIds) {
      conditions.push(
        provinceIds.length > 0
          ? Prisma.sql`d."provinceId" IN (${Prisma.join(provinceIds)})`
          : Prisma.sql`FALSE`,
      );
    }
    return conditions.length > 0 ? Prisma.join(conditions, ' AND ') : Prisma.sql`TRUE`;
  }

  private async paginate(
    where: Prisma.Sql,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<DestinationRow>> {
    const skip = (page - 1) * limit;
    const [data, counted] = await Promise.all([
      this.prisma.$queryRaw<DestinationRow[]>`
        SELECT ${DESTINATION_COLUMNS}
        FROM "Destination" d
        WHERE ${where}
        ORDER BY d."createdAt" DESC
        LIMIT ${limit} OFFSET ${skip}
      `,
      this.prisma.$queryRaw<{ total: number }[]>`
        SELECT COUNT(*)::int AS "total" FROM "Destination" d WHERE ${where}
      `,
    ]);
    const total = counted[0]?.total ?? 0;
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
