import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { purchaseItemCreateSchema } from '@/lib/validations';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = purchaseItemCreateSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const item = await prisma.purchaseItem.update({
      where: { id },
      data: parsed.data,
      include: {
        component: true,
        supplier: true,
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error('PATCH /api/purchase-items/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update purchase item' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.purchaseItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/purchase-items/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete purchase item' }, { status: 500 });
  }
}
