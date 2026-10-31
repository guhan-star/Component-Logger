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
      const record = await tx.lendRecord.findUnique({
        where: { id },
        include: { component: true },
      });

      if (!record) throw new Error('Lend record not found');
      if (record.status === 'Returned') throw new Error('Already returned');

      const quantity = record.quantity;
      const component = record.component;

      // Update lend record
      const updatedRecord = await tx.lendRecord.update({
        where: { id },
        data: {
          actualReturnDate: new Date(),
          status: 'Returned',
          notes: body.notes ? `${record.notes || ''}\nReturn note: ${body.notes}`.trim() : record.notes,
        },
        include: {
          component: { select: { id: true, name: true } },
          lentTo: { select: { id: true, name: true } },
        },
      });

      // Update component quantities
      await tx.component.update({
        where: { id: component.id },
        data: {
          quantityLentOut: Math.max(0, component.quantityLentOut - quantity),
          quantityAvailable: component.quantityAvailable + quantity,
        },
      });

      // Create transaction
      await tx.inventoryTransaction.create({
        data: {
          componentId: component.id,
          transactionType: 'RETURN_LENT',
          quantity,
          previousQty: component.quantityAvailable,
          resultingQty: component.quantityAvailable + quantity,
          relatedPersonId: record.lentToId,
          notes: body.notes || `Returned lent items from record ${id}`,
        },
      });

      return updatedRecord;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('POST /api/lend-records/[id]/return error:', error);
    const message = error instanceof Error ? error.message : 'Failed to return lent item';
    const status = message.includes('not found') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
