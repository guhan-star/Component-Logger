import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { borrowComponentAtomic } from '@/lib/custody-service';

// GET /api/borrow-records - Read-only query for user's borrow records
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

// POST /api/borrow-records - Authoritative creation of borrow record
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
        { error: 'Component and Lender name are required.' },
        { status: 400 }
      );
    }

    const expectedDate = body.expectedReturnDate ? new Date(body.expectedReturnDate) : null;

    const result = await borrowComponentAtomic({
      userId: user.id,
      componentId,
      borrowedFrom: lender,
      quantity: qty,
      expectedReturnDate: expectedDate,
      notes: body.notes || null,
    });

    return NextResponse.json(
      {
        success: true,
        record: result.borrowRecord,
        data: result.borrowRecord,
        updatedAvailable: result.updatedAvailable,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('POST /api/borrow-records error:', error);
    const msg = error?.message || 'Failed to record borrow.';
    const status = msg.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
