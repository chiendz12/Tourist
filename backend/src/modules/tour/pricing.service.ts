import { Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalStatus, CostCategory, Prisma, Role } from '@prisma/client';
import { Actor, canRead } from '../../common/utils/ownership.util';
import { PrismaService } from '../../prisma/prisma.service';
import { ProvinceAccessService } from '../province/province-access.service';

/** Cost lines a complete quotation is expected to carry (HP3 "đầy đủ chi phí"). */
const ALWAYS_REQUIRED: CostCategory[] = [
  CostCategory.TRANSPORT,
  CostCategory.MEAL,
  CostCategory.TICKET,
  CostCategory.GUIDE,
];

export type PricedTour = {
  days: number;
  paxCount: number;
  basePrice: Prisma.Decimal;
};

export type PricedCost = {
  category: CostCategory;
  unitPrice: Prisma.Decimal;
  quantity: number;
  isPerPerson: boolean;
};

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provinceAccess: ProvinceAccessService,
  ) {}

  async computeFor(tourId: string, actor?: Actor) {
    const tour = await this.prisma.tour.findUnique({
      where: { id: tourId },
      include: {
        costs: { include: { supplier: { select: { id: true, name: true, provinceId: true } } } },
        route: {
          select: {
            waypoints: { select: { destination: { select: { provinceId: true } } } },
          },
        },
      },
    });
    if (!tour || !canRead(tour, actor)) throw new NotFoundException('Tour not found');
    if (actor) {
      await this.provinceAccess.assertCanAccessProvinces(
        actor,
        tour.route?.waypoints.map((waypoint) => waypoint.destination.provinceId) ?? [],
      );
      await this.provinceAccess.assertCanAccessProvinces(
        actor,
        tour.costs
          .map((cost) => (cost.supplierId ? cost.supplier?.provinceId ?? null : undefined))
          .filter((provinceId): provinceId is string | null => provinceId !== undefined),
      );
    }

    const canSeeDraftCosts = !!actor &&
      (actor.role === Role.LEADER || actor.role === Role.LECTURER || actor.role === Role.SUPER_ADMIN || tour.createdById === actor.id);
    const costs = canSeeDraftCosts
      ? tour.costs
      : tour.costs.filter((cost) => cost.status === ApprovalStatus.PUBLISHED);

    // Peer set for "khả năng cạnh tranh": published tours of the same length.
    const peers = await this.prisma.tour.findMany({
      where: { status: ApprovalStatus.PUBLISHED, days: tour.days, id: { not: tour.id } },
      select: { basePrice: true },
    });
    const roll = this.rollUp(tour, costs);

    return {
      tour: { id: tour.id, name: tour.name, code: tour.code, days: tour.days, status: tour.status },
      currency: tour.currency,
      paxCount: roll.paxCount,
      costs: {
        lines: costs.map((cost) => ({
          id: cost.id,
          category: cost.category,
          supplier: cost.supplier,
          unitPrice: cost.unitPrice.toNumber(),
          quantity: cost.quantity,
          isPerPerson: cost.isPerPerson,
          lineTotal: this.lineTotal(cost, roll.paxCount).toNumber(),
          notes: cost.notes,
        })),
        byCategory: [...roll.byCategory.entries()].map(([category, total]) => ({
          category,
          total: total.toNumber(),
          share: roll.totalCost.isZero() ? 0 : round(total.div(roll.totalCost).mul(100)),
        })),
        perPersonSubtotal: roll.perPersonSubtotal.toNumber(),
        groupSubtotal: roll.groupSubtotal.toNumber(),
        totalCost: roll.totalCost.toNumber(),
        costPerPax: roll.costPerPax.toNumber(),
      },
      selling: {
        pricePerPax: tour.basePrice.toNumber(),
        totalRevenue: roll.revenue.toNumber(),
      },
      margin: {
        profit: roll.profit.toNumber(),
        // Margin is profit over revenue; markup is profit over cost. Both get asked
        // for in different places, and conflating them is the classic pricing error.
        marginPercent: roll.marginPercent,
        markupPercent: roll.markupPercent,
        sellsBelowCost: roll.sellsBelowCost,
      },
      completeness: {
        required: roll.required,
        covered: roll.required.filter((category) => roll.byCategory.has(category)),
        missing: roll.missing,
        ratio: roll.completenessRatio,
        isComplete: roll.missing.length === 0,
      },
      competitiveness: this.compare(tour.basePrice, peers),
    };
  }

  /**
   * The shared arithmetic behind both the pricing endpoint and the HP3 grading
   * indicators — kept in one place so the two can never drift apart.
   */
  rollUp(tour: PricedTour, costs: PricedCost[]) {
    const paxCount = Math.max(tour.paxCount, 1);
    const zero = new Prisma.Decimal(0);

    let perPersonSubtotal = zero;
    let groupSubtotal = zero;
    const byCategory = new Map<CostCategory, Prisma.Decimal>();

    for (const cost of costs) {
      const units = cost.unitPrice.mul(cost.quantity);
      if (cost.isPerPerson) perPersonSubtotal = perPersonSubtotal.add(units);
      else groupSubtotal = groupSubtotal.add(units);
      const lineTotal = this.lineTotal(cost, paxCount);
      byCategory.set(cost.category, (byCategory.get(cost.category) ?? zero).add(lineTotal));
    }

    const totalCost = perPersonSubtotal.mul(paxCount).add(groupSubtotal);
    const revenue = tour.basePrice.mul(paxCount);
    const profit = revenue.sub(totalCost);

    // A multi-day tour without accommodation is an incomplete quotation.
    const required = tour.days > 1 ? [...ALWAYS_REQUIRED, CostCategory.HOTEL] : ALWAYS_REQUIRED;
    const missing = required.filter((category) => !byCategory.has(category));

    return {
      paxCount,
      byCategory,
      perPersonSubtotal,
      groupSubtotal,
      totalCost,
      costPerPax: totalCost.div(paxCount),
      revenue,
      profit,
      marginPercent: revenue.isZero() ? null : round(profit.div(revenue).mul(100)),
      markupPercent: totalCost.isZero() ? null : round(profit.div(totalCost).mul(100)),
      sellsBelowCost: profit.isNegative(),
      required,
      missing,
      completenessRatio: round(
        new Prisma.Decimal(required.length - missing.length).div(required.length),
      ),
    };
  }

  private lineTotal(cost: PricedCost, paxCount: number): Prisma.Decimal {
    const units = cost.unitPrice.mul(cost.quantity);
    return cost.isPerPerson ? units.mul(paxCount) : units;
  }

  /** Where this price sits against published tours of the same length. */
  private compare(price: Prisma.Decimal, peers: { basePrice: Prisma.Decimal }[]) {
    if (peers.length === 0) {
      return { peerCount: 0, medianPrice: null, deltaPercent: null, position: 'NO_PEERS' as const };
    }
    const sorted = peers.map((peer) => peer.basePrice).sort((a, b) => a.comparedTo(b));
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0 ? sorted[mid - 1].add(sorted[mid]).div(2) : sorted[mid];

    const deltaPercent = median.isZero() ? null : round(price.sub(median).div(median).mul(100));
    const position =
      deltaPercent === null || Math.abs(deltaPercent) <= 10
        ? ('AT_MARKET' as const)
        : deltaPercent < 0
          ? ('BELOW_MARKET' as const)
          : ('ABOVE_MARKET' as const);

    return { peerCount: peers.length, medianPrice: median.toNumber(), deltaPercent, position };
  }
}

function round(value: Prisma.Decimal): number {
  return Number(value.toFixed(2));
}
