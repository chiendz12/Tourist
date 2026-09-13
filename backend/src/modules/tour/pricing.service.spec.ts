import { Prisma } from '@prisma/client';
import { PricingService } from './pricing.service';

describe('PricingService', () => {
  const service = new PricingService({} as never, {} as never);

  it('separates per-person and group costs correctly', () => {
    const result = service.rollUp(
      { days: 1, paxCount: 20, basePrice: new Prisma.Decimal(750_000) },
      [
        { category: 'MEAL' as never, unitPrice: new Prisma.Decimal(150_000), quantity: 1, isPerPerson: true },
        { category: 'GUIDE' as never, unitPrice: new Prisma.Decimal(1_500_000), quantity: 1, isPerPerson: false },
      ],
    );
    expect(result.totalCost.toNumber()).toBe(4_500_000);
    expect(result.costPerPax.toNumber()).toBe(225_000);
    expect(result.revenue.toNumber()).toBe(15_000_000);
    expect(result.profit.toNumber()).toBe(10_500_000);
    expect(result.sellsBelowCost).toBe(false);
  });

  it('requires accommodation for multi-day tours', () => {
    const result = service.rollUp(
      { days: 2, paxCount: 10, basePrice: new Prisma.Decimal(1_000_000) },
      [{ category: 'MEAL' as never, unitPrice: new Prisma.Decimal(100_000), quantity: 1, isPerPerson: true }],
    );
    expect(result.missing).toContain('HOTEL');
    expect(result.completenessRatio).toBeLessThan(1);
  });
});
