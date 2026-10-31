import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const transaction = await prisma.inventoryTransaction.findUnique({
      where: { id },
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
        relatedPerson: { select: { id: true, name: true, email: true } },
        relatedProject: { select: { id: true, name: true, status: true } },
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
