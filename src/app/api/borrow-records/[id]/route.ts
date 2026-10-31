import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const record = await prisma.borrowRecord.findUnique({
      where: { id },
      include: {
        component: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            quantityBorrowed: true,
            ownershipType: true,
          },
        },
        borrowedFrom: { select: { id: true, name: true, email: true, phone: true } },
      },
    });

    if (!record) {
      return NextResponse.json({ error: 'Borrow record not found' }, { status: 404 });
    }

    return NextResponse.json(record);
  } catch (error) {
    console.error('GET /api/borrow-records/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch borrow record' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.borrowRecord.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Borrow record not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.expectedReturnDate !== undefined) {
      updateData.expectedReturnDate = body.expectedReturnDate ? new Date(body.expectedReturnDate) : null;
    }
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.status !== undefined) updateData.status = body.status;

    const updated = await prisma.borrowRecord.update({
      where: { id },
      data: updateData,
      include: {
        component: { select: { id: true, name: true } },
        borrowedFrom: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PUT /api/borrow-records/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update borrow record' }, { status: 500 });
  }
}
