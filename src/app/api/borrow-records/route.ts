import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// GET /api/borrow-records - Read-only query for user's borrowed items
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;

    const where: any = { userId: user.id };
    if (status) {
      where.status = status;
    }

    const records = await prisma.borrowRecord.findMany({
      where,
      include: {
        component: {
          select: {
            id: true,
            name: true,
            sku: true,
            unitOfMeasurement: true,
            quantityAvailable: true,
            quantityOwned: true,
          },
        },
      },
      orderBy: { dateBorrowed: 'desc' },
    });

    return NextResponse.json({ records, data: records });
  } catch (error) {
    console.error('GET /api/borrow-records error:', error);
    return NextResponse.json({ error: 'Failed to fetch borrow records' }, { status: 500 });
  }
}

// POST /api/borrow-records - Transactional recording of borrowed items
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const body = await request.json();
    const lender = String(body.borrowedFrom || body.borrowedFromId || '').trim();
    const componentId = body.componentId;
    const qty = Math.max(1, parseInt(body.quantity || 1, 10) || 1);

    if (!componentId || !lender) {
      return NextResponse.json(
        { error: 'Component and Borrowed-From contact name are required.' },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const comp = await tx.component.findFirst({
        where: { id: componentId, userId: user.id },
      });

      if (!comp) {
        throw new Error('Component not found in your inventory.');
      }

      const prevAvail = comp.quantityAvailable;
      const newAvail = comp.quantityAvailable + qty;
      const newBorrowed = (comp.quantityBorrowed || 0) + qty;

      const created = await tx.borrowRecord.create({
        data: {
          userId: user.id,
          componentId: comp.id,
          borrowedFrom: lender,
          quantity: qty,
          expectedReturnDate: body.expectedReturnDate ? new Date(body.expectedReturnDate) : null,
          status: 'Active',
          notes: body.notes ? String(body.notes).trim() : null,
        },
        include: {
          component: {
            select: {
              id: true,
              name: true,
              sku: true,
              unitOfMeasurement: true,
              quantityAvailable: true,
              quantityOwned: true,
            },
          },
        },
      });

      // Update component stock
      await tx.component.update({
        where: { id: comp.id },
        data: {
          quantityBorrowed: newBorrowed,
          quantityAvailable: newAvail,
          ownershipType: 'Borrowed',
          borrowedFrom: lender,
          borrowingDate: new Date(),
        },
      });

      // Audit transaction
      await tx.inventoryTransaction.create({
        data: {
          userId: user.id,
          componentId: comp.id,
          transactionType: 'BORROW',
          quantity: qty,
          previousQty: prevAvail,
          resultingQty: newAvail,
          notes: `Borrowed ${qty} ${comp.unitOfMeasurement} from ${lender}`,
        },
      });

      return created;
    });

    return NextResponse.json({ record: result, data: result }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/borrow-records error:', error);
    const msg = error?.message || 'Failed to create borrow record';
    const status = msg.includes('not found') ? 404 : msg.includes('required') ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
