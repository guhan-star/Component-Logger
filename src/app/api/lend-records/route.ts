import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { lendComponentAtomic } from '@/lib/custody-service';

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

// POST /api/lend-records - Authoritative creation of loan & stock deduction
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

    const expectedDate = body.expectedReturnDate ? new Date(body.expectedReturnDate) : null;

    const result = await lendComponentAtomic({
      userId: user.id,
      componentId,
      lentTo: recipient,
      quantity: qty,
      expectedReturnDate: expectedDate,
      notes: body.notes || null,
    });

    return NextResponse.json(
      {
        success: true,
        record: result.lendRecord,
        data: result.lendRecord,
        updatedAvailable: result.updatedAvailable,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('POST /api/lend-records error:', error);
    const msg = error?.message || 'Failed to record loan.';
    const status = msg.includes('Insufficient')
      ? 400
      : msg.includes('not found')
      ? 404
      : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
