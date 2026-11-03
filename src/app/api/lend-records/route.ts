import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// GET /api/lend-records - Read-only query for user's lend records
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

    const records = await prisma.lendRecord.findMany({
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
      orderBy: { dateLent: 'desc' },
    });

    return NextResponse.json({ records, data: records });
  } catch (error) {
    console.error('GET /api/lend-records error:', error);
    return NextResponse.json({ error: 'Failed to fetch lend records' }, { status: 500 });
  }
}

// POST /api/lend-records - Transactional creation of loan & stock deduction
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const body = await request.json();
    const recipient = String(body.lentTo || body.lentToId || '').trim();
    const componentId = body.componentId;
    const qty = Math.max(1, parseInt(body.quantity || 1, 10) || 1);

    if (!componentId || !recipient) {
      return NextResponse.json(
        { error: 'Component and Lent-To recipient name are required.' },
        { status: 400 }
      );
    }

    // Atomic transaction: verify stock, reserve, record loan, audit
    const result = await prisma.$transaction(async (tx) => {
      const comp = await tx.component.findFirst({
        where: { id: componentId, userId: user.id },
      });

      if (!comp) {
        throw new Error('Component not found in your inventory.');
      }

      if (comp.quantityAvailable < qty) {
        throw new Error(
          `Insufficient available stock (Available: ${comp.quantityAvailable}, Requested: ${qty}).`
        );
      }

      const prevAvail = comp.quantityAvailable;
      const newAvail = comp.quantityAvailable - qty;
      const newLentOut = (comp.quantityLentOut || 0) + qty;

      const createdRecord = await tx.lendRecord.create({
        data: {
          userId: user.id,
          componentId: comp.id,
          lentTo: recipient,
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

      // Update component stock & custody metadata
      await tx.component.update({
        where: { id: comp.id },
        data: {
          quantityAvailable: newAvail,
          quantityLentOut: newLentOut,
          ownershipType: 'Lent',
          lentTo: recipient,
          lendingDate: new Date(),
        },
      });

      // Create audit transaction
      await tx.inventoryTransaction.create({
        data: {
          userId: user.id,
          componentId: comp.id,
          transactionType: 'LEND',
          quantity: qty,
          previousQty: prevAvail,
          resultingQty: newAvail,
          notes: `Lent ${qty} ${comp.unitOfMeasurement} to ${recipient}`,
        },
      });

      return createdRecord;
    });

    return NextResponse.json({ record: result, data: result }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/lend-records error:', error);
    const msg = error?.message || 'Failed to create lend record';
    const status = msg.includes('Insufficient') || msg.includes('required') ? 400 : msg.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
