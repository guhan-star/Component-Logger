import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const result = await prisma.$transaction(async (tx) => {
      const record = await tx.borrowRecord.findUnique({
        where: { id },
        include: { component: true },
      });

      if (!record) throw new Error('Borrow record not found');
      if (record.status === 'Returned') throw new Error('Already returned');

      const quantity = record.quantity;
      const component = record.component;

      if (component.quantityBorrowed < quantity) {
        throw new Error(`Cannot return ${quantity}. Only ${component.quantityBorrowed} borrowed.`);
      }

      // Update borrow record
      const updatedRecord = await tx.borrowRecord.update({
        where: { id },
        data: {
          actualReturnDate: new Date(),
          status: 'Returned',
          notes: body.notes ? `${record.notes || ''}\nReturn note: ${body.notes}`.trim() : record.notes,
        },
        include: {
          component: { select: { id: true, name: true } },
          borrowedFrom: { select: { id: true, name: true } },
        },
      });

      // Update component quantities
      await tx.component.update({
        where: { id: component.id },
        data: {
          quantityBorrowed: component.quantityBorrowed - quantity,
          quantityOwned: component.quantityOwned - quantity,
          quantityAvailable: component.quantityAvailable - quantity,
        },
      });

      // Create transaction
      await tx.inventoryTransaction.create({
        data: {
          componentId: component.id,
          transactionType: 'RETURN_BORROWED',
          quantity,
          previousQty: component.quantityBorrowed,
          resultingQty: component.quantityBorrowed - quantity,
          relatedPersonId: record.borrowedFromId,
          notes: body.notes || `Returned borrowed items from record ${id}`,
        },
      });

      return updatedRecord;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('POST /api/borrow-records/[id]/return error:', error);
    const message = error instanceof Error ? error.message : 'Failed to return borrowed item';
    const status = message.includes('not found') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
