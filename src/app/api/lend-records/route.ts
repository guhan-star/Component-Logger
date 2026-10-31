import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { lendRecordCreateSchema } from '@/lib/validations';

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
    if (personId) where.lentToId = personId;
    if (status) where.status = status;
    if (overdue === 'true') {
      where.status = 'Active';
      where.expectedReturnDate = { lt: new Date() };
    }

    const [records, total] = await Promise.all([
      prisma.lendRecord.findMany({
        where,
        include: {
          component: { select: { id: true, name: true, imageUrl: true } },
          lentTo: { select: { id: true, name: true, email: true, phone: true } },
        },
        orderBy: { dateLent: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.lendRecord.count({ where }),
    ]);

    return NextResponse.json({
      data: records,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error('GET /api/lend-records error:', error);
    return NextResponse.json({ error: 'Failed to fetch lend records' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = lendRecordCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { componentId, lentToId, quantity, dateLent, expectedReturnDate, notes } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const component = await tx.component.findUnique({ where: { id: componentId } });
      if (!component) throw new Error('Component not found');
      if (component.quantityAvailable < quantity) {
        throw new Error(`Insufficient available stock (${component.quantityAvailable}) to lend ${quantity}`);
      }

      const person = await tx.person.findUnique({ where: { id: lentToId } });
      if (!person) throw new Error('Person not found');

      // Update component quantities
      await tx.component.update({
        where: { id: componentId },
        data: {
          quantityAvailable: component.quantityAvailable - quantity,
          quantityLentOut: component.quantityLentOut + quantity,
        },
      });

      // Create lend record
      const record = await tx.lendRecord.create({
        data: {
          componentId,
          lentToId,
          quantity,
          dateLent: dateLent ? new Date(dateLent) : new Date(),
          expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
          notes,
        },
        include: {
          component: { select: { id: true, name: true } },
          lentTo: { select: { id: true, name: true } },
        },
      });

      // Create transaction
      await tx.inventoryTransaction.create({
        data: {
          componentId,
          transactionType: 'LEND',
          quantity,
          previousQty: component.quantityAvailable,
          resultingQty: component.quantityAvailable - quantity,
          relatedPersonId: lentToId,
          notes: notes || `Lent to ${person.name}`,
        },
      });

      return record;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('POST /api/lend-records error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create lend record';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
