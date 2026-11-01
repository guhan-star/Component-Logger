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

    const record = await prisma.borrowRecord.findFirst({
      where: { id, userId: user.id },
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
    const auth = await requireAuth(request);
    if (auth.error) return auth.response;
    const user = auth.user;

    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.borrowRecord.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Borrow record not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.expectedReturnDate !== undefined) {
      updateData.expectedReturnDate = body.expectedReturnDate ? new Date(body.expectedReturnDate) : null;
    }
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.status !== undefined) {
      updateData.status = body.status;
      if (body.status === 'Returned') {
        updateData.actualReturnDate = new Date();
      }
    }
    if (body.borrowedFrom !== undefined) updateData.borrowedFrom = body.borrowedFrom;

    const updated = await prisma.borrowRecord.update({
      where: { id },
      data: updateData,
      include: {
        component: { select: { id: true, name: true } },
      },
    });

    if (body.status === 'Returned' && existing.status !== 'Returned') {
      const comp = await prisma.component.findUnique({ where: { id: existing.componentId } });
      if (comp) {
        const newBorrowed = Math.max(0, (comp.quantityBorrowed || 0) - existing.quantity);
        const newAvail = Math.max(0, (comp.quantityAvailable || 0) - existing.quantity);
        await prisma.component.update({
          where: { id: existing.componentId },
          data: {
            quantityBorrowed: newBorrowed,
            quantityAvailable: newAvail,
            ownershipType: newBorrowed > 0 ? comp.ownershipType : 'Mine',
            borrowedFrom: newBorrowed > 0 ? comp.borrowedFrom : null,
          },
        });
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PUT /api/borrow-records/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update borrow record' }, { status: 500 });
  }
}
