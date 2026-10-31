import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const { id } = await context.params;

    const record = await prisma.lendRecord.findFirst({
      where: { id, userId: user.id },
    });

    if (!record) {
      return NextResponse.json({ error: 'Lend record not found.' }, { status: 404 });
    }

    if (record.status === 'Returned') {
      return NextResponse.json({ error: 'Record is already returned.' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.lendRecord.update({
        where: { id },
        data: {
          status: 'Returned',
          actualReturnDate: new Date(),
        },
      });

      // Restore available stock
      await tx.component.update({
        where: { id: record.componentId },
        data: {
          quantityLentOut: { decrement: record.quantity },
          quantityAvailable: { increment: record.quantity },
        },
      });
    });

    return NextResponse.json({ success: true, message: 'Item marked as returned by borrower.' });
  } catch (error) {
    console.error('POST /api/lend-records/[id]/return error:', error);
    return NextResponse.json({ error: 'Failed to process return.' }, { status: 500 });
  }
}
