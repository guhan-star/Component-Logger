import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// POST /api/components/[id]/restore - Restore an archived component
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.response;
    const user = auth.user;

    const { id } = await params;

    const existing = await prisma.component.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Component not found in your inventory' },
        { status: 404 }
      );
    }

    if (!existing.isArchived) {
      return NextResponse.json(
        { error: 'Component is not archived' },
        { status: 400 }
      );
    }

    const component = await prisma.$transaction(async (tx) => {
      const restored = await tx.component.update({
        where: { id },
        data: { isArchived: false },
        include: {
          specifications: true,
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          userId: user.id,
          componentId: id,
          transactionType: 'RESTORE',
          quantity: restored.quantityAvailable,
          notes: 'Component restored from archive',
        },
      });

      return restored;
    });

    return NextResponse.json(component);
  } catch (error) {
    console.error('Error restoring component:', error);
    return NextResponse.json(
      { error: 'Failed to restore component' },
      { status: 500 }
    );
  }
}
