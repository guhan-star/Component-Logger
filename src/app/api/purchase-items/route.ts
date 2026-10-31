import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// GET /api/purchase-items - User's private procurement pipeline
export async function GET() {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const items = await prisma.purchaseItem.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error('GET /api/purchase-items error:', error);
    return NextResponse.json({ error: 'Failed to fetch purchase items.' }, { status: 500 });
  }
}

// POST /api/purchase-items - Add new item to user's procurement list
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const body = await request.json();

    if (!body.componentName || !String(body.componentName).trim()) {
      return NextResponse.json({ error: 'Component name is required.' }, { status: 400 });
    }

    const item = await prisma.purchaseItem.create({
      data: {
        userId: user.id,
        componentName: String(body.componentName).trim(),
        quantity: parseInt(body.quantity || 1, 10) || 1,
        estimatedCost: body.estimatedCost ? parseFloat(body.estimatedCost) : null,
        currency: body.currency || 'INR',
        supplier: body.supplier || null,
        supplierUrl: body.supplierUrl || null,
        priority: body.priority || 'Normal',
        status: body.status || 'Needed',
        notes: body.notes || null,
      },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('POST /api/purchase-items error:', error);
    return NextResponse.json({ error: 'Failed to create purchase item.' }, { status: 500 });
  }
}
