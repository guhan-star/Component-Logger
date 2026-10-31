import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { borrowRecordCreateSchema } from '@/lib/validations';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const componentId = searchParams.get('componentId');
    const personId = searchParams.get('personId');
    const status = searchParams.get('status');
    const overdue = searchParams.get('overdue');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '25', 10);

    const where: Record<string, unknown> = {};

    if (componentId) where.componentId = componentId;
    if (personId) where.borrowedFromId = personId;
    if (status) where.status = status;
    if (overdue === 'true') {
      where.status = 'Active';
      where.expectedReturnDate = { lt: new Date() };
    }

    const [records, total] = await Promise.all([
      prisma.borrowRecord.findMany({
        where,
        include: {
          component: { select: { id: true, name: true, imageUrl: true } },
          borrowedFrom: { select: { id: true, name: true, email: true, phone: true } },
        },
        orderBy: { dateBorrowed: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.borrowRecord.count({ where }),
    ]);

    return NextResponse.json({
      data: records,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error('GET /api/borrow-records error:', error);
    return NextResponse.json({ error: 'Failed to fetch borrow records' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = borrowRecordCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { componentId, borrowedFromId, quantity, dateBorrowed, expectedReturnDate, notes } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const component = await tx.component.findUnique({ where: { id: componentId } });
      if (!component) throw new Error('Component not found');

      const person = await tx.person.findUnique({ where: { id: borrowedFromId } });
      if (!person) throw new Error('Person not found');

      // Update component quantities
      const previousQty = component.quantityBorrowed;
      await tx.component.update({
        where: { id: componentId },
        data: {
          quantityBorrowed: component.quantityBorrowed + quantity,
          quantityOwned: component.quantityOwned + quantity,
          quantityAvailable: component.quantityAvailable + quantity,
          ...(component.quantityOwned === 0 ? { ownershipType: 'Borrowed' } : {}),
        },
      });

      // Create borrow record
      const record = await tx.borrowRecord.create({
        data: {
          componentId,
          borrowedFromId,
          quantity,
          dateBorrowed: dateBorrowed ? new Date(dateBorrowed) : new Date(),
          expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
          notes,
        },
        include: {
          component: { select: { id: true, name: true } },
          borrowedFrom: { select: { id: true, name: true } },
        },
      });

      // Create transaction
      await tx.inventoryTransaction.create({
        data: {
          componentId,
          transactionType: 'BORROW',
          quantity,
          previousQty,
          resultingQty: component.quantityBorrowed + quantity,
          relatedPersonId: borrowedFromId,
          notes,
        },
      });

      return record;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('POST /api/borrow-records error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create borrow record';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
