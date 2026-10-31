import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.response;
    const user = auth.user;

    const { id } = await params;

    const transaction = await prisma.inventoryTransaction.findFirst({
      where: { id, userId: user.id },
      include: {
        component: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            quantityOwned: true,
            quantityAvailable: true,
            quantityReserved: true,
            quantityInUse: true,
            quantityLentOut: true,
            quantityBorrowed: true,
          },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    return NextResponse.json(transaction);
  } catch (error) {
    console.error('GET /api/transactions/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transaction' },
      { status: 500 }
    );
  }
}
