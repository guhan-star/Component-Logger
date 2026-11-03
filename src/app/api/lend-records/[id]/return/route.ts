import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/lend-records/[id]/return - Transactional return of lent component
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const { id } = await context.params;

    const result = await prisma.$transaction(async (tx) => {
      const record = await tx.lendRecord.findFirst({
        where: { id, userId: user.id },
      });

      if (!record) {
        throw new Error('Lend record not found.');
      }

      if (record.status === 'Returned') {
        throw new Error('This loan has already been marked as returned.');
      }

      // Mark record as returned
      const updatedRecord = await tx.lendRecord.update({
        where: { id },
        data: {
          status: 'Returned',
          actualReturnDate: new Date(),
        },
      });

      // Restore available stock on the component
      const comp = await tx.component.findUnique({
        where: { id: record.componentId },
      });

      if (comp) {
        const prevAvail = comp.quantityAvailable;
        const newAvail = comp.quantityAvailable + record.quantity;
        const newLentOut = Math.max(0, (comp.quantityLentOut || 0) - record.quantity);

        // Check if there are other active loans for this component
        const remainingActiveLoans = await tx.lendRecord.findMany({
          where: {
            componentId: comp.id,
            userId: user.id,
            status: 'Active',
            id: { not: id },
          },
          orderBy: { dateLent: 'desc' },
          take: 1,
        });

        const nextLentTo = remainingActiveLoans.length > 0 ? remainingActiveLoans[0].lentTo : null;
        const nextLendingDate = remainingActiveLoans.length > 0 ? remainingActiveLoans[0].dateLent : null;
        const nextOwnership = newLentOut > 0 ? 'Lent' : comp.quantityBorrowed > 0 ? 'Borrowed' : 'Mine';

        await tx.component.update({
          where: { id: comp.id },
          data: {
            quantityAvailable: newAvail,
            quantityLentOut: newLentOut,
            ownershipType: nextOwnership,
            lentTo: nextLentTo,
            lendingDate: nextLendingDate,
          },
        });

        // Audit transaction
        await tx.inventoryTransaction.create({
          data: {
            userId: user.id,
            componentId: comp.id,
            transactionType: 'RETURN_LENT',
            quantity: record.quantity,
            previousQty: prevAvail,
            resultingQty: newAvail,
            notes: `Returned ${record.quantity} units from ${record.lentTo}`,
          },
        });
      }

      return updatedRecord;
    });

    return NextResponse.json({
      success: true,
      message: 'Item marked as returned and available stock restored.',
      record: result,
    });
  } catch (error: any) {
    console.error('POST /api/lend-records/[id]/return error:', error);
    const msg = error?.message || 'Failed to process return.';
    const status = msg.includes('not found') ? 404 : msg.includes('already') ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
