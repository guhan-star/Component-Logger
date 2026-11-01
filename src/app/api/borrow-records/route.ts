import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const records = await prisma.borrowRecord.findMany({
      where: { userId: user.id },
      include: {
        component: {
          select: { id: true, name: true, sku: true, unitOfMeasurement: true },
        },
      },
      orderBy: { dateBorrowed: 'desc' },
    });

    // Auto-sync components with Borrowed ownership or borrowedFrom contact
    const activeCompIds = new Set(
      records.filter((r) => r.status === 'Active').map((r) => r.componentId)
    );

    const borrowedComps = await prisma.component.findMany({
      where: {
        userId: user.id,
        OR: [
          { ownershipType: 'Borrowed' },
          { borrowedFrom: { not: null } },
        ],
      },
      select: {
        id: true,
        name: true,
        sku: true,
        unitOfMeasurement: true,
        quantityOwned: true,
        quantityAvailable: true,
        quantityBorrowed: true,
        borrowedFrom: true,
        borrowingDate: true,
        notes: true,
      },
    });

    const newlyCreated: any[] = [];
    for (const c of borrowedComps) {
      if (!activeCompIds.has(c.id)) {
        const borrowCount = c.quantityBorrowed || c.quantityOwned || c.quantityAvailable || 1;
        const lender = (c.borrowedFrom && c.borrowedFrom.trim()) ? c.borrowedFrom.trim() : 'Owner / Laboratory';
        try {
          const created = await prisma.borrowRecord.create({
            data: {
              userId: user.id,
              componentId: c.id,
              borrowedFrom: lender,
              quantity: borrowCount,
              status: 'Active',
              dateBorrowed: c.borrowingDate || new Date(),
              notes: c.notes || 'Synchronized from Component inventory record',
            },
            include: {
              component: {
                select: { id: true, name: true, sku: true, unitOfMeasurement: true },
              },
            },
          });
          newlyCreated.push(created);
        } catch (e) {
          console.error('Error syncing borrowRecord for comp', c.id, e);
        }
      }
    }

    const allRecords = [...records, ...newlyCreated];
    return NextResponse.json({ records: allRecords, data: allRecords });
  } catch (error) {
    console.error('GET /api/borrow-records error:', error);
    return NextResponse.json({ error: 'Failed to fetch borrow records' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const body = await request.json();
    const lender = String(body.borrowedFrom || body.borrowedFromId || '').trim();

    if (!body.componentId || !lender) {
      return NextResponse.json(
        { error: 'Component and Borrowed-From contact name are required.' },
        { status: 400 }
      );
    }

    // Verify component ownership
    const comp = await prisma.component.findFirst({
      where: { id: body.componentId, userId: user.id },
    });

    if (!comp) {
      return NextResponse.json({ error: 'Component not found in your inventory.' }, { status: 404 });
    }

    const qty = parseInt(body.quantity || 1, 10) || 1;

    const created = await prisma.borrowRecord.create({
      data: {
        userId: user.id,
        componentId: comp.id,
        borrowedFrom: lender,
        quantity: qty,
        expectedReturnDate: body.expectedReturnDate ? new Date(body.expectedReturnDate) : null,
        status: 'Active',
        notes: body.notes || null,
      },
    });

    // Update component stock
    await prisma.component.update({
      where: { id: comp.id },
      data: {
        quantityBorrowed: { increment: qty },
        quantityAvailable: { increment: qty },
        ownershipType: 'Borrowed',
        borrowedFrom: lender,
        borrowingDate: new Date(),
      },
    });

    return NextResponse.json({ record: created }, { status: 201 });
  } catch (error) {
    console.error('POST /api/borrow-records error:', error);
    return NextResponse.json({ error: 'Failed to create borrow record' }, { status: 500 });
  }
}
