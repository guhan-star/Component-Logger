import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const { id } = await context.params;
    const body = await request.json();

    const existing = await prisma.purchaseItem.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Purchase item not found.' }, { status: 404 });
    }

    const updated = await prisma.purchaseItem.update({
      where: { id },
      data: {
        componentName: body.componentName !== undefined ? body.componentName : existing.componentName,
        quantity: body.quantity !== undefined ? parseInt(body.quantity, 10) : existing.quantity,
        estimatedCost: body.estimatedCost !== undefined ? parseFloat(body.estimatedCost) : existing.estimatedCost,
        currency: body.currency || existing.currency,
        supplier: body.supplier !== undefined ? body.supplier : existing.supplier,
        supplierUrl: body.supplierUrl !== undefined ? body.supplierUrl : existing.supplierUrl,
        priority: body.priority || existing.priority,
        status: body.status || existing.status,
        notes: body.notes !== undefined ? body.notes : existing.notes,
        orderedDate: body.status === 'Ordered' && !existing.orderedDate ? new Date() : existing.orderedDate,
        receivedDate: body.status === 'Received' && !existing.receivedDate ? new Date() : existing.receivedDate,
      },
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error('PUT /api/purchase-items/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update purchase item.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const { id } = await context.params;

    const existing = await prisma.purchaseItem.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Purchase item not found.' }, { status: 404 });
    }

    await prisma.purchaseItem.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Purchase item deleted.' });
  } catch (error) {
    console.error('DELETE /api/purchase-items/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete purchase item.' }, { status: 500 });
  }
}
