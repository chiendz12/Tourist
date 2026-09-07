import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalStatus, EntityType, HocPhanCode, Prisma, Role } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';
import {
  Actor,
  assertCanDelete,
  assertCanUpdate,
  canRead,
} from '../../common/utils/ownership.util';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginatedResult } from '../../types';
import { ProvinceAccessService } from '../province/province-access.service';
import { CreateTourDto } from './dto/create-tour.dto';
import { QueryTourDto } from './dto/query-tour.dto';
import { UpdateTourDto } from './dto/update-tour.dto';

const TOUR_INCLUDE = {
  route: true,
  itinerary: { orderBy: [{ dayNumber: 'asc' }, { order: 'asc' }] },
  costs: true,
} satisfies Prisma.TourInclude;

@Injectable()
export class TourService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provinceAccess: ProvinceAccessService,
  ) {}

  async findPublic(query: QueryTourDto, actor?: Actor) {
    return this.paginate(
      { status: ApprovalStatus.PUBLISHED, ...this.designFilters(query), ...(await this.provinceWhere(actor)) },
      query,
    );
  }

  async findMine(query: PaginationDto, actor: Actor) {
    return this.paginate(
      { createdById: actor.id, ...(await this.provinceWhere(actor)) },
      query,
    );
  }

  async findOne(id: string, actor?: Actor) {
    const found = await this.prisma.tour.findUnique({ where: { id }, include: TOUR_INCLUDE });
    // Unpublished tours must not be distinguishable from missing ones.
    if (!found || !canRead(found, actor)) throw new NotFoundException('Tour not found');
    if (actor) await this.assertTourProvinceAccess(id, actor);
    return found;
  }

  async create(dto: CreateTourDto, actor: Actor) {
    await this.assertCodeFree(dto.code);
    await this.assertRouteAccessible(dto.routeId, actor);
    return this.prisma.tour.create({
      data: {
        name: dto.name,
        code: dto.code,
        description: dto.description,
        routeId: dto.routeId,
        days: dto.days ?? 1,
        basePrice: dto.basePrice,
        currency: dto.currency ?? 'VND',
        paxCount: dto.paxCount ?? 1,
        targetAgeGroups: dto.targetAgeGroups ?? [],
        travelStyles: dto.travelStyles ?? [],
        seasons: dto.seasons ?? [],
        createdById: actor.id,
      },
      include: TOUR_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateTourDto, actor: Actor) {
    const existing = await this.prisma.tour.findUnique({
      where: { id },
      select: { id: true, code: true, createdById: true, status: true },
    });
    if (!existing) throw new NotFoundException('Tour not found');
    assertCanUpdate(existing, actor, 'tour');
    await this.assertTourProvinceAccess(id, actor);
    await this.assertCourseUpdateAccess(dto, actor);

    if (dto.code && dto.code !== existing.code) await this.assertCodeFree(dto.code);
    if (dto.routeId) await this.assertRouteAccessible(dto.routeId, actor);

    await this.prisma.tour.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code,
        description: dto.description,
        routeId: dto.routeId,
        days: dto.days,
        basePrice: dto.basePrice,
        currency: dto.currency,
        paxCount: dto.paxCount,
        // `set` replaces the list; omitting the key leaves it untouched.
        targetAgeGroups: dto.targetAgeGroups ? { set: dto.targetAgeGroups } : undefined,
        travelStyles: dto.travelStyles ? { set: dto.travelStyles } : undefined,
        seasons: dto.seasons ? { set: dto.seasons } : undefined,
      },
    });
    return this.findOne(id, actor);
  }

  async remove(id: string, actor: Actor) {
    const existing = await this.prisma.tour.findUnique({
      where: { id },
      select: { id: true, createdById: true, status: true },
    });
    if (!existing) throw new NotFoundException('Tour not found');
    assertCanDelete(existing, actor, 'tour');
    await this.assertTourProvinceAccess(id, actor);
    // Itinerary items and costs cascade; the approval row does not (no foreign key).
    await this.prisma.$transaction([
      this.prisma.approval.deleteMany({ where: { entityType: EntityType.TOUR, entityId: id } }),
      this.prisma.tour.delete({ where: { id } }),
    ]);
    return { id, deleted: true };
  }

  /** Enum-array columns are matched with `has`, so one query param narrows the list. */
  private designFilters(query: QueryTourDto): Prisma.TourWhereInput {
    const where: Prisma.TourWhereInput = {};
    if (query.ageGroup) where.targetAgeGroups = { has: query.ageGroup };
    if (query.travelStyle) where.travelStyles = { has: query.travelStyle };
    if (query.season) where.seasons = { has: query.season };
    if (query.minDays !== undefined || query.maxDays !== undefined) {
      where.days = { gte: query.minDays, lte: query.maxDays };
    }
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  private async paginate(
    where: Prisma.TourWhereInput,
    query: PaginationDto,
  ): Promise<PaginatedResult<unknown>> {
    const skip = (query.page - 1) * query.limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.tour.findMany({
        where,
        include: TOUR_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
      this.prisma.tour.count({ where }),
    ]);
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  private async assertCodeFree(code: string) {
    const clash = await this.prisma.tour.findUnique({ where: { code }, select: { id: true } });
    if (clash) throw new ConflictException(`Tour code "${code}" is already taken`);
  }

  private async assertRouteAccessible(routeId: string | undefined, actor: Actor) {
    if (!routeId) return;
    const route = await this.prisma.route.findUnique({
      where: { id: routeId },
      select: {
        id: true,
        createdById: true,
        status: true,
        waypoints: { select: { destination: { select: { provinceId: true } } } },
      },
    });
    if (!route) throw new NotFoundException(`Route ${routeId} not found`);
    if (!canRead(route, actor)) throw new NotFoundException(`Route ${routeId} not found`);
    await this.provinceAccess.assertCanAccessProvinces(
      actor,
      route.waypoints.map((waypoint) => waypoint.destination.provinceId),
    );
  }

  private async assertTourProvinceAccess(tourId: string, actor: Actor) {
    const tour = await this.prisma.tour.findUnique({
      where: { id: tourId },
      select: {
        route: {
          select: {
            waypoints: { select: { destination: { select: { provinceId: true } } } },
          },
        },
      },
    });
    if (!tour) throw new NotFoundException('Tour not found');
    await this.provinceAccess.assertCanAccessProvinces(
      actor,
      tour.route?.waypoints.map((waypoint) => waypoint.destination.provinceId) ?? [],
    );
  }

  private async assertCourseUpdateAccess(dto: UpdateTourDto, actor: Actor) {
    if (actor.role !== Role.STUDENT && actor.role !== Role.LEADER) return;
    const enrollments = await this.prisma.hocPhanEnrollment.findMany({
      where: {
        userId: actor.id,
        hocPhan: { code: { in: [HocPhanCode.HP2, HocPhanCode.HP3] } },
      },
      select: { hocPhan: { select: { code: true } } },
    });
    const enrolled = new Set(enrollments.map((row) => row.hocPhan.code));
    const hp2Fields = [
      'name',
      'code',
      'description',
      'routeId',
      'days',
      'targetAgeGroups',
      'travelStyles',
      'seasons',
    ] as const;
    const hp3Fields = ['basePrice', 'currency', 'paxCount'] as const;
    const changesHp2 = hp2Fields.some((field) => dto[field] !== undefined);
    const changesHp3 = hp3Fields.some((field) => dto[field] !== undefined);
    if (changesHp2 && !enrolled.has(HocPhanCode.HP2)) {
      throw new ForbiddenException('This tour design requires HP2 enrollment');
    }
    if (changesHp3 && !enrolled.has(HocPhanCode.HP3)) {
      throw new ForbiddenException('This tour pricing requires HP3 enrollment');
    }
  }

  private async provinceWhere(actor?: Actor): Promise<Prisma.TourWhereInput> {
    if (!actor) return {};
    const provinceIds = await this.provinceAccess.assignedProvinceIds(actor);
    if (provinceIds === null) return {};
    return {
      route: {
        is: {
          waypoints: {
            some: { destination: { provinceId: { in: provinceIds } } },
            every: { destination: { provinceId: { in: provinceIds } } },
          },
        },
      },
    };
  }
}
