import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const now = new Date();

    // 1. Parallel aggregations for core KPIs
    const [
      uniqueComponentsCount,
      ownedStockAgg,
      borrowedCount,
      lentCount,
      purchaseItemsCount,
      categoriesGroup,
      storageGroup,
      zeroStockComponents,
      missingDatasheetComponents,
      overdueBorrows,
      pendingLends,
      recentTransactions,
    ] = await Promise.all([
      // Total unique component records
      prisma.component.count({
        where: { userId: user.id, isArchived: false },
      }),
      // Owned and available stock sums (strictly for owned items, never borrowed or lent)
      prisma.component.aggregate({
        where: { userId: user.id, isArchived: false, ownershipType: 'Mine' },
        _sum: {
          quantityOwned: true,
          quantityAvailable: true,
          quantityReserved: true,
        },
      }),
      // Borrowed records count
      prisma.component.count({
        where: { userId: user.id, isArchived: false, ownershipType: 'Borrowed' },
      }),
      // Lent records count
      prisma.component.count({
        where: { userId: user.id, isArchived: false, ownershipType: 'Lent' },
      }),
      // Needed purchases
      prisma.purchaseItem.count({
        where: { userId: user.id, status: 'Needed' },
      }),
      // Category breakdown
      prisma.component.groupBy({
        by: ['category'],
        where: { userId: user.id, isArchived: false },
        _count: { id: true },
        _sum: { quantityOwned: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      // Storage location breakdown
      prisma.component.groupBy({
        by: ['storageLocation'],
        where: {
          userId: user.id,
          isArchived: false,
          storageLocation: { not: null },
        },
        _count: { id: true },
        _sum: { quantityOwned: true },
        orderBy: { _count: { id: 'desc' } },
        take: 8,
      }),
      // Attention: Owned components with zero available stock
      prisma.component.findMany({
        where: {
          userId: user.id,
          isArchived: false,
          ownershipType: 'Mine',
          quantityAvailable: 0,
        },
        select: {
          id: true,
          sku: true,
          name: true,
          category: true,
          quantityOwned: true,
          quantityAvailable: true,
          storageLocation: true,
        },
        take: 5,
      }),
      // Attention: Components missing datasheets
      prisma.component.findMany({
        where: {
          userId: user.id,
          isArchived: false,
          datasheetUrl: null,
        },
        select: {
          id: true,
          sku: true,
          name: true,
          category: true,
        },
        take: 5,
      }),
      // Attention: Overdue borrow records
      prisma.borrowRecord.findMany({
        where: {
          userId: user.id,
          actualReturnDate: null,
          expectedReturnDate: { lt: now },
        },
        include: {
          component: { select: { id: true, name: true, sku: true } },
        },
        take: 5,
      }),
      // Attention: Pending lent records awaiting return
      prisma.lendRecord.findMany({
        where: {
          userId: user.id,
          actualReturnDate: null,
          expectedReturnDate: { lt: now },
        },
        include: {
          component: { select: { id: true, name: true, sku: true } },
        },
        take: 5,
      }),
      // Recent transactions
      prisma.inventoryTransaction.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          component: { select: { id: true, name: true, sku: true, category: true } },
        },
      }),
    ]);

    // Calculate total valuation
    const allUserComponents = await prisma.component.findMany({
      where: { userId: user.id, isArchived: false, ownershipType: 'Mine' },
      select: { quantityOwned: true, unitCost: true },
    });

    const totalValuation = allUserComponents.reduce(
      (acc, c) => acc + (c.quantityOwned || 0) * (c.unitCost || 0),
      0
    );

    // Structure attention items
    const attentionItems: Array<{
      id: string;
      componentId?: string;
      name: string;
      sku?: string | null;
      reason: string;
      type: 'critical' | 'warning' | 'info';
      dateOrQty?: string;
    }> = [];

    zeroStockComponents.forEach((c) => {
      attentionItems.push({
        id: `zero-${c.id}`,
        componentId: c.id,
        name: c.name,
        sku: c.sku,
        reason: 'Zero available stock in inventory',
        type: 'critical',
        dateOrQty: '0 available',
      });
    });

    overdueBorrows.forEach((b) => {
      attentionItems.push({
        id: `overdue-borrow-${b.id}`,
        componentId: b.component?.id,
        name: b.component?.name || 'Borrowed Item',
        sku: b.component?.sku,
        reason: `Overdue return from ${b.borrowedFrom}`,
        type: 'warning',
        dateOrQty: b.expectedReturnDate?.toISOString().split('T')[0],
      });
    });

    pendingLends.forEach((l) => {
      attentionItems.push({
        id: `overdue-lend-${l.id}`,
        componentId: l.component?.id,
        name: l.component?.name || 'Lent Item',
        sku: l.component?.sku,
        reason: `Awaiting return from ${l.lentTo}`,
        type: 'warning',
        dateOrQty: l.expectedReturnDate?.toISOString().split('T')[0],
      });
    });

    missingDatasheetComponents.forEach((c) => {
      if (attentionItems.length < 10) {
        attentionItems.push({
          id: `datasheet-${c.id}`,
          componentId: c.id,
          name: c.name,
          sku: c.sku,
          reason: 'Datasheet URL not attached',
          type: 'info',
        });
      }
    });

    // Clean total count of attention records
    const attentionCount =
      zeroStockComponents.length +
      overdueBorrows.length +
      pendingLends.length +
      missingDatasheetComponents.length;

    // Category breakdown with real percentages
    const totalCount = uniqueComponentsCount || 1;
    const categoryBreakdown = categoriesGroup.map((c) => ({
      category: c.category || 'Uncategorized',
      count: c._count.id,
      totalQty: c._sum.quantityOwned || 0,
      percentage: Math.round((c._count.id / totalCount) * 100),
    }));

    // Storage distribution
    const storageDistribution = storageGroup.map((s) => ({
      location: s.storageLocation || 'Unassigned',
      componentCount: s._count.id,
      totalQuantity: s._sum.quantityOwned || 0,
    }));

    // Compute past 30-day timeline series from real transactions
    const historyMap = new Map<string, { owned: number; transactions: number }>();
    const d = new Date();
    for (let i = 29; i >= 0; i--) {
      const dateKey = new Date(d.getTime() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      historyMap.set(dateKey, { owned: ownedStockAgg._sum.quantityOwned || 0, transactions: 0 });
    }

    recentTransactions.forEach((tx) => {
      const dateKey = tx.createdAt.toISOString().split('T')[0];
      const entry = historyMap.get(dateKey);
      if (entry) {
        entry.transactions += 1;
      }
    });

    const historySeries = Array.from(historyMap.entries()).map(([date, val]) => ({
      date: date.slice(5), // "MM-DD"
      fullDate: date,
      stockCount: val.owned,
      activityCount: val.transactions,
    }));

    return NextResponse.json({
      summary: {
        totalOwnedQuantity: ownedStockAgg._sum.quantityOwned || 0,
        uniqueComponents: uniqueComponentsCount,
        availableQuantity: ownedStockAgg._sum.quantityAvailable || 0,
        reservedQuantity: ownedStockAgg._sum.quantityReserved || 0,
        borrowedCount,
        lentCount,
        attentionCount,
        purchaseItemsCount,
        totalValuation,
        storageLocationsCount: storageGroup.length,
      },
      categoryBreakdown,
      storageDistribution,
      attentionItems,
      recentTransactions,
      historySeries,
    });
  } catch (error) {
    console.error('GET /api/stats error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate inventory statistics.' },
      { status: 500 }
    );
  }
}
