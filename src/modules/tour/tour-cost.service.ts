import { Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalStatus, Role } from '@prisma/client';
import { Actor, assertCanDelete, assertCanUpdate, canRead } from '../../common/utils/ownership.util';
import { PrismaService } from '../../prisma/prisma.service';
import { ProvinceAccessService } from '../province/province-access.service';
import { CreateTourCostDto } from './dto/create-tour-cost.dto';
import { UpdateTourCostDto } from './dto/update-tour-cost.dto';

const COST_INCLUDE = {
  supplier: { select: { id: true, name: true, type: true, provinceId: true, status: true } },
};

/**
 * Học phần 3 — "cấu hình: chi phí, giá bán". Cost lines belong to a tour, so the
 * permission is the tour's: you may price a tour exactly when you may edit it.
 */
@Injectable()
export class TourCostService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provinceAccess: ProvinceAccessService,
  ) {}

  async findAll(tourId: string, actor?: Actor) {
    const tour = await this.loadTour(tourId);
    if (!canRead(tour, actor)) throw new NotFoundException('Tour not found');
    if (actor) await this.assertProvinceAccess(tour, actor);
    const canSeeDrafts = !!actor &&
      (actor.role === Role.LEADER || actor.role === Role.LECTURER || actor.role === Role.SUPER_ADMIN || tour.createdById === actor.id);
    const costs = await this.prisma.tourCost.findMany({
      where: { tourId, ...(canSeeDrafts ? {} : { status: ApprovalStatus.PUBLISHED }) },
      include: COST_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    if (actor) {
      await this.provinceAccess.assertCanAccessProvinces(
        actor,
        costs
          .map((cost) => (cost.supplierId ? cost.supplier?.provinceId ?? null : undefined))
          .filter((provinceId): provinceId is string | null => provinceId !== undefined),
      );
    }
    return costs;
  }

  async create(tourId: string, dto: CreateTourCostDto, actor: Actor) {
    const tour = await this.loadTour(tourId);
    assertCanUpdate(tour, actor, 'tour');
    await this.assertProvinceAccess(tour, actor);
    await this.assertSupplierExists(dto.supplierId, actor);
    return this.prisma.tourCost.create({
      data: {
        tourId,
        category: dto.category,
        supplierId: dto.supplierId,
        unitPrice: dto.unitPrice,
        quantity: dto.quantity ?? 1,
        isPerPerson: dto.isPerPerson ?? true,
        notes: dto.notes,
      },
      include: COST_INCLUDE,
    });
  }

  async update(tourId: string, costId: string, dto: UpdateTourCostDto, actor: Actor) {
    const tour = await this.loadTour(tourId);
    assertCanUpdate(tour, actor, 'tour');
    await this.assertProvinceAccess(tour, actor);
    const cost = await this.assertCostBelongs(tourId, costId);
    assertCanUpdate({ createdById: tour.createdById, status: cost.status }, actor, 'cost line');
    await this.assertSupplierExists(dto.supplierId, actor);
    return this.prisma.tourCost.update({
      where: { id: costId },
      data: dto,
      include: COST_INCLUDE,
    });
  }

  async remove(tourId: string, costId: string, actor: Actor) {
    const tour = await this.loadTour(tourId);
    assertCanUpdate(tour, actor, 'tour');
    await this.assertProvinceAccess(tour, actor);
    const cost = await this.assertCostBelongs(tourId, costId);
    assertCanDelete({ createdById: tour.createdById, status: cost.status }, actor, 'cost line');
    await this.prisma.tourCost.delete({ where: { id: costId } });
    return { id: costId, deleted: true };
  }

  private async loadTour(tourId: string) {
    const tour = await this.prisma.tour.findUnique({
      where: { id: tourId },
      select: {
        id: true,
        createdById: true,
        status: true,
        route: {
          select: {
            waypoints: { select: { destination: { select: { provinceId: true } } } },
          },
        },
      },
    });
    if (!tour) throw new NotFoundException('Tour not found');
    return tour;
  }

  private assertProvinceAccess(
    tour: Awaited<ReturnType<TourCostService['loadTour']>>,
    actor: Actor,
  ) {
    return this.provinceAccess.assertCanAccessProvinces(
      actor,
      tour.route?.waypoints.map((waypoint) => waypoint.destination.provinceId) ?? [],
    );
  }

  /** Guards against editing a cost line through the wrong tour's URL. */
  private async assertCostBelongs(tourId: string, costId: string) {
    const cost = await this.prisma.tourCost.findUnique({
      where: { id: costId },
      select: { tourId: true, status: true },
    });
    if (!cost || cost.tourId !== tourId) {
      throw new NotFoundException('Cost line not found on this tour');
    }
    return cost;
  }

  private async assertSupplierExists(supplierId: string | undefined, actor: Actor) {
    if (!supplierId) return;
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true, provinceId: true },
    });
    if (!supplier) throw new NotFoundException(`Provider ${supplierId} not found`);
    await this.provinceAccess.assertCanAccessProvinces(actor, [supplier.provinceId]);
  }
}
