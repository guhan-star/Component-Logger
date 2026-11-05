import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import * as authModule from '@/lib/auth';
import { GET as getStats } from '@/app/api/stats/route';

describe('Integration Tests: Dashboard KPI Aggregations & Real Statistics', () => {
  const testUser = {
    id: 'usr_stat_test_01',
    email: 'stat@stark.test',
    username: 'stat_op',
    name: 'Telemetry Operator',
    role: 'USER' as const,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authModule, 'requireAuth').mockResolvedValue({ user: testUser } as any);
  });

  it('aggregates real inventory telemetry into core Moveon KPIs', async () => {
    // Mock parallel aggregations
    vi.spyOn(prisma.component, 'count').mockImplementation(async ({ where }: any) => {
      if (where?.ownershipType === 'Borrowed') return 2;
      if (where?.ownershipType === 'Lent') return 3;
      return 15; // unique components count
    });

    vi.spyOn(prisma.component, 'aggregate').mockImplementation(async ({ _sum }: any) => {
      if (_sum?.unitCost) {
        return { _sum: { unitCost: 12500 } } as any;
      }
      return {
        _sum: {
          quantityOwned: 150,
          quantityAvailable: 120,
          quantityReserved: 30,
        },
      } as any;
    });

    vi.spyOn(prisma.purchaseItem, 'count').mockResolvedValue(4);

    vi.spyOn(prisma.component, 'groupBy').mockImplementation(async ({ by }: any) => {
      if (by.includes('category')) {
        return [
          { category: 'Microcontroller', _count: { id: 8 }, _sum: { quantityOwned: 80 } },
          { category: 'Sensor', _count: { id: 7 }, _sum: { quantityOwned: 70 } },
        ] as any;
      }
      return [
        { storageLocation: 'Cabinet A-1', _count: { id: 10 }, _sum: { quantityOwned: 100 } },
      ] as any;
    });

    vi.spyOn(prisma.component, 'findMany').mockResolvedValue([] as any);
    vi.spyOn(prisma.borrowRecord, 'findMany').mockResolvedValue([] as any);
    vi.spyOn(prisma.lendRecord, 'findMany').mockResolvedValue([] as any);
    vi.spyOn(prisma.inventoryTransaction, 'findMany').mockResolvedValue([] as any);

    const res = await getStats();
    const body = await res.json();

    expect(res.status).toBe(200);

    const summary = body.summary;
    expect(summary.totalOwnedQuantity).toBe(150);
    expect(summary.availableQuantity).toBe(120);
    expect(summary.reservedQuantity).toBe(30);
    expect(summary.uniqueComponents).toBe(15);
    expect(summary.borrowedCount).toBe(2);
    expect(summary.lentCount).toBe(3);
    expect(body.categoryBreakdown).toHaveLength(2);
    expect(body.categoryBreakdown[0].category).toBe('Microcontroller');
  });
});
