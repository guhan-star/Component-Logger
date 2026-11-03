import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/borrow-records/[id]/return - Transactional return of borrowed item to owner
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const { id } = await context.params;

    const result = await prisma.$transaction(async (tx) => {
      const record = await tx.borrowRecord.findFirst({
        where: { id, userId: user.id },
      });

      if (!record) {
        throw new Error('Borrow record not found.');
      }

      if (record.status === 'Returned') {
        throw new Error('This borrowed item has already been marked as returned.');
      }

      // Mark record as returned
      const updatedRecord = await tx.borrowRecord.update({
        where: { id },
        data: {
          status: 'Returned',
          actualReturnDate: new Date(),
        },
      });

      // Deduct from available stock and borrowed count on the component
      const comp = await tx.component.findUnique({
        where: { id: record.componentId },
      });

      if (comp) {
        const prevAvail = comp.quantityAvailable;
        const newAvail = Math.max(0, comp.quantityAvailable - record.quantity);
        const newBorrowed = Math.max(0, (comp.quantityBorrowed || 0) - record.quantity);

        // Check if there are other active borrowed records for this component
        const remainingActiveBorrows = await tx.borrowRecord.findMany({
          where: {
            componentId: comp.id,
            userId: user.id,
            status: 'Active',
            id: { not: id },
          },
          orderBy: { dateBorrowed: 'desc' },
          take: 1,
        });

        const nextBorrowedFrom = remainingActiveBorrows.length > 0 ? remainingActiveBorrows[0].borrowedFrom : null;
        const nextBorrowingDate = remainingActiveBorrows.length > 0 ? remainingActiveBorrows[0].dateBorrowed : null;
        const nextOwnership = newBorrowed > 0 ? 'Borrowed' : comp.quantityLentOut > 0 ? 'Lent' : 'Mine';

        await tx.component.update({
          where: { id: comp.id },
          data: {
            quantityAvailable: newAvail,
            quantityBorrowed: newBorrowed,
            ownershipType: nextOwnership,
            borrowedFrom: nextBorrowedFrom,
            borrowingDate: nextBorrowingDate,
          },
        });

        // Audit transaction
        await tx.inventoryTransaction.create({
          data: {
            userId: user.id,
            componentId: comp.id,
            transactionType: 'RETURN_BORROWED',
            quantity: record.quantity,
            previousQty: prevAvail,
            resultingQty: newAvail,
            notes: `Returned ${record.quantity} borrowed units back to ${record.borrowedFrom}`,
          },
        });
      }

      return updatedRecord;
    });

    return NextResponse.json({
      success: true,
      message: 'Item marked as returned to lender.',
      record: result,
    });
  } catch (error: any) {
    console.error('POST /api/borrow-records/[id]/return error:', error);
    const msg = error?.message || 'Failed to process return.';
    const status = msg.includes('not found') ? 404 : msg.includes('already') ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
