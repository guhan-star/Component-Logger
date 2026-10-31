import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/components/[id]
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const { id } = await context.params;

    const component = await prisma.component.findFirst({
      where: {
        id,
        userId: user.id, // Strict ownership check
      },
      include: {
        specifications: true,
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 25,
        },
        borrowRecords: {
          orderBy: { createdAt: 'desc' },
        },
        lendRecords: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!component) {
      return NextResponse.json({ error: 'Component not found.' }, { status: 404 });
    }

    return NextResponse.json({ component });
  } catch (error) {
    console.error('GET /api/components/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch component.' }, { status: 500 });
  }
}

// PUT /api/components/[id]
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const { id } = await context.params;
    const body = await request.json();

    const existing = await prisma.component.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Component not found.' }, { status: 404 });
    }

    const totalQty = body.quantityTotal ?? body.quantityOwned ?? existing.quantityOwned;
    const hereQty = body.quantityHere ?? body.quantityAvailable ?? existing.quantityAvailable;
    const unitPrice = body.unitPrice ?? body.unitCost ?? existing.unitCost;

    const updated = await prisma.$transaction(async (tx) => {
      // Record quantity change if adjusted
      if (hereQty !== existing.quantityAvailable) {
        const diff = hereQty - existing.quantityAvailable;
        await tx.inventoryTransaction.create({
          data: {
            userId: user.id,
            componentId: id,
            transactionType: diff > 0 ? 'ADD' : 'REMOVE',
            quantity: Math.abs(diff),
            previousQty: existing.quantityAvailable,
            resultingQty: hereQty,
            notes: body.adjustmentReason || 'Manual stock update',
          },
        });
      }

      return tx.component.update({
        where: { id },
        data: {
          name: body.name ? String(body.name).trim() : existing.name,
          sku: body.sku ? String(body.sku).trim() : existing.sku,
          description: body.description !== undefined ? body.description : existing.description,
          category: body.category || existing.category,
          subcategory: body.subcategory !== undefined ? body.subcategory : existing.subcategory,
          componentType: body.componentType !== undefined ? body.componentType : existing.componentType,
          manufacturer: body.manufacturer !== undefined ? body.manufacturer : existing.manufacturer,
          mpn: body.mpn !== undefined ? body.mpn : existing.mpn,
          model: body.model !== undefined ? body.model : existing.model,
          imageUrl: body.imageUrl !== undefined ? body.imageUrl : existing.imageUrl,
          datasheetUrl: body.datasheetUrl !== undefined ? body.datasheetUrl : existing.datasheetUrl,
          quantityOwned: totalQty,
          quantityAvailable: hereQty,
          unitOfMeasurement: body.unit || body.unitOfMeasurement || existing.unitOfMeasurement,
          condition: body.condition || existing.condition,
          unitCost: unitPrice,
          currency: body.currency || existing.currency,
          supplier: body.supplier !== undefined ? body.supplier : existing.supplier,
          storageLocation: body.storageDescription || body.storageLocation || existing.storageLocation,
          ownershipType: body.ownership || body.ownershipType || existing.ownershipType,
          borrowedFrom: body.borrowedFrom !== undefined ? body.borrowedFrom : existing.borrowedFrom,
          borrowingDate: body.borrowingDate ? new Date(body.borrowingDate) : existing.borrowingDate,
          lentTo: body.lentTo !== undefined ? body.lentTo : existing.lentTo,
          lendingDate: body.lendingDate ? new Date(body.lendingDate) : existing.lendingDate,
          notes: body.generalNotes || body.notes || existing.notes,
        },
      });
    });

    return NextResponse.json({ component: updated });
  } catch (error) {
    console.error('PUT /api/components/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update component.' }, { status: 500 });
  }
}

// DELETE /api/components/[id]
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const { id } = await context.params;

    const existing = await prisma.component.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Component not found.' }, { status: 404 });
    }

    await prisma.component.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Component deleted.' });
  } catch (error) {
    console.error('DELETE /api/components/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete component.' }, { status: 500 });
  }
}
