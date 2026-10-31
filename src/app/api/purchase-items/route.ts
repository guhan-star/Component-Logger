import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { purchaseItemCreateSchema } from '@/lib/validations';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;

    const items = await prisma.purchaseItem.findMany({
      where,
      include: {
        component: { select: { id: true, name: true, quantityAvailable: true } },
        supplier: { select: { id: true, name: true } },
      },
      orderBy: [
        { status: 'asc' },
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({ data: items });
  } catch (error) {
    console.error('GET /api/purchase-items error:', error);
    return NextResponse.json({ error: 'Failed to fetch purchase items' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = purchaseItemCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const item = await prisma.purchaseItem.create({
      data: parsed.data,
      include: {
        component: true,
        supplier: true,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('POST /api/purchase-items error:', error);
    return NextResponse.json({ error: 'Failed to create purchase item' }, { status: 500 });
  }
}
