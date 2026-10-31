import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.response;
    const user = auth.user;

    const { id } = await params;
    const record = await prisma.lendRecord.findFirst({
      where: { id, userId: user.id },
      include: {
        component: {
          select: { id: true, name: true, sku: true, unitOfMeasurement: true },
        },
      },
    });

    if (!record) {
      return NextResponse.json({ error: 'Lend record not found' }, { status: 404 });
    }

    return NextResponse.json(record);
  } catch (error) {
    console.error('GET /api/lend-records/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch lend record' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.response;
    const user = auth.user;

    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.lendRecord.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Lend record not found' }, { status: 404 });
    }

    const record = await prisma.lendRecord.update({
      where: { id },
      data: {
        expectedReturnDate: body.expectedReturnDate ? new Date(body.expectedReturnDate) : undefined,
        status: body.status,
        notes: body.notes,
        lentTo: body.lentTo,
      },
    });

    return NextResponse.json(record);
  } catch (error) {
    console.error('PATCH /api/lend-records/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update lend record' }, { status: 500 });
  }
}
