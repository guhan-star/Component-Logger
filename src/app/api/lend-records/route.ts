import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const records = await prisma.lendRecord.findMany({
      where: { userId: user.id },
      include: {
        component: {
          select: { id: true, name: true, sku: true, unitOfMeasurement: true },
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

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const body = await request.json();

    if (!body.componentId || !body.lentTo) {
      return NextResponse.json(
        { error: 'Component and Lent-To recipient name are required.' },
        { status: 400 }
      );
    }

    const comp = await prisma.component.findFirst({
      where: { id: body.componentId, userId: user.id },
    });

    if (!comp) {
      return NextResponse.json({ error: 'Component not found in your inventory.' }, { status: 404 });
    }

    const qty = parseInt(body.quantity || 1, 10) || 1;

    if (comp.quantityAvailable < qty) {
      return NextResponse.json(
        { error: `Insufficient available stock (Available: ${comp.quantityAvailable}, Requested: ${qty}).` },
        { status: 400 }
      );
    }

    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.lendRecord.create({
        data: {
          userId: user.id,
          componentId: comp.id,
          lentTo: String(body.lentTo).trim(),
          quantity: qty,
          expectedReturnDate: body.expectedReturnDate ? new Date(body.expectedReturnDate) : null,
          status: 'Active',
          notes: body.notes || null,
        },
      });

      // Deduct from available, add to lentOut
      await tx.component.update({
        where: { id: comp.id },
        data: {
          quantityAvailable: { decrement: qty },
          quantityLentOut: { increment: qty },
          ownershipType: 'Lent',
          lentTo: String(body.lentTo).trim(),
          lendingDate: new Date(),
        },
      });

      return created;
    });

    return NextResponse.json({ record }, { status: 201 });
  } catch (error) {
    console.error('POST /api/lend-records error:', error);
    return NextResponse.json({ error: 'Failed to create lend record' }, { status: 500 });
  }
}
