import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const record = await prisma.lendRecord.findUnique({
      where: { id },
      include: {
        component: true,
        lentTo: true,
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
    const { id } = await params;
    const body = await request.json();

    const record = await prisma.lendRecord.update({
      where: { id },
      data: {
        expectedReturnDate: body.expectedReturnDate ? new Date(body.expectedReturnDate) : undefined,
        status: body.status,
        notes: body.notes,
      },
    });

    return NextResponse.json(record);
  } catch (error) {
    console.error('PATCH /api/lend-records/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update lend record' }, { status: 500 });
  }
}
