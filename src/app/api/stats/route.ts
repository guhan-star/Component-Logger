import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const [
      totalComponents,
      lowStockComponents,
      borrowedCount,
      lentCount,
      activeProjectsCount,
      purchaseItemsCount,
      categoriesCount,
      recentTransactions,
      allComponents,
    ] = await Promise.all([
      prisma.component.count({ where: { isArchived: false } }),
      prisma.component.count({
        where: {
          isArchived: false,
          quantityAvailable: { lte: 5 },
        },
      }),
      prisma.borrowRecord.count({ where: { status: 'Active' } }),
      prisma.lendRecord.count({ where: { status: 'Active' } }),
      prisma.project.count({ where: { status: { in: ['Planning', 'Active'] } } }),
      prisma.purchaseItem.count({ where: { status: 'Needed' } }),
      prisma.category.count(),
      prisma.inventoryTransaction.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: {
          component: { select: { id: true, name: true } },
          relatedPerson: { select: { id: true, name: true } },
          relatedProject: { select: { id: true, name: true } },
        },
      }),
      prisma.component.findMany({
        where: { isArchived: false },
        select: {
          quantityOwned: true,
          quantityAvailable: true,
          unitCost: true,
          currency: true,
          categoryId: true,
          category: { select: { name: true } },
        },
      }),
    ]);

    // Calculate total valuation
    let totalValuation = 0;
    const categoryDistribution: Record<string, number> = {};

    allComponents.forEach((c) => {
      if (c.unitCost && c.quantityOwned) {
        totalValuation += c.unitCost * c.quantityOwned;
      }
      const catName = c.category?.name || 'Uncategorized';
      categoryDistribution[catName] = (categoryDistribution[catName] || 0) + 1;
    });

    const categoryBreakdown = Object.entries(categoryDistribution).map(([name, count]) => ({
      name,
      count,
    }));

    return NextResponse.json({
      summary: {
        totalComponents,
        lowStockComponents,
        borrowedCount,
        lentCount,
        activeProjectsCount,
        purchaseItemsCount,
        categoriesCount,
        totalValuation: Math.round(totalValuation * 100) / 100,
      },
      categoryBreakdown,
      recentTransactions,
    });
  } catch (error) {
    console.error('GET /api/stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}
