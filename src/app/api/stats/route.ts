import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    // Aggregate user-scoped statistics
    const [
      totalComponents,
      ownedValuationResult,
      borrowedCount,
      lentCount,
      purchaseItemsCount,
      categoriesResult,
      recentTransactions,
    ] = await Promise.all([
      prisma.component.count({
        where: { userId: user.id, isArchived: false },
      }),
      prisma.component.aggregate({
        where: { userId: user.id, isArchived: false, ownershipType: 'Mine' },
        _sum: {
          quantityOwned: true,
          quantityAvailable: true,
        },
      }),
      prisma.component.count({
        where: { userId: user.id, isArchived: false, ownershipType: 'Borrowed' },
      }),
      prisma.component.count({
        where: { userId: user.id, isArchived: false, ownershipType: 'Lent' },
      }),
      prisma.purchaseItem.count({
        where: { userId: user.id, status: 'Needed' },
      }),
      prisma.component.groupBy({
        by: ['category'],
        where: { userId: user.id, isArchived: false },
        _count: { id: true },
      }),
      prisma.inventoryTransaction.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          component: { select: { name: true, sku: true } },
        },
      }),
    ]);

    // Calculate total portfolio valuation in INR
    const allUserComponents = await prisma.component.findMany({
      where: { userId: user.id, isArchived: false, ownershipType: 'Mine' },
      select: { quantityOwned: true, unitCost: true },
    });

    const totalValuation = allUserComponents.reduce(
      (acc, c) => acc + (c.quantityOwned || 0) * (c.unitCost || 0),
      0
    );

    return NextResponse.json({
      summary: {
        totalComponents,
        totalValuation,
        borrowedCount,
        lentCount,
        purchaseItemsCount,
        categoriesCount: categoriesResult.length,
      },
      categoryBreakdown: categoriesResult.map((c) => ({
        category: c.category,
        count: c._count.id,
      })),
      recentTransactions,
    });
  } catch (error) {
    console.error('GET /api/stats error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate inventory statistics.' },
      { status: 500 }
    );
  }
}
