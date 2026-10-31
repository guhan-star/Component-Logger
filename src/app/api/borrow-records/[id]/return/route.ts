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

    const record = await prisma.borrowRecord.findFirst({
      where: { id, userId: user.id },
    });

    if (!record) {
      return NextResponse.json({ error: 'Borrow record not found.' }, { status: 404 });
    }

    if (record.status === 'Returned') {
      return NextResponse.json({ error: 'Record is already returned.' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.borrowRecord.update({
        where: { id },
        data: {
          status: 'Returned',
          actualReturnDate: new Date(),
        },
      });

      await tx.component.update({
        where: { id: record.componentId },
        data: {
          quantityBorrowed: { decrement: record.quantity },
          quantityAvailable: { decrement: record.quantity },
        },
      });
    });

    return NextResponse.json({ success: true, message: 'Item marked as returned to lender.' });
  } catch (error) {
    console.error('POST /api/borrow-records/[id]/return error:', error);
    return NextResponse.json({ error: 'Failed to process return.' }, { status: 500 });
  }
}
