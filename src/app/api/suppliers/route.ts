import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// GET /api/suppliers - List suppliers from user dropdowns and inventory
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.response;
    const user = auth.user;

    const dropdownSuppliers = await prisma.userDropdownValue.findMany({
      where: {
        userId: user.id,
        categoryKey: 'supplier',
        isActive: true,
      },
      select: { value: true },
    });

    const defaultSuppliers = ['Robu.in', 'Mouser Electronics', 'DigiKey', 'Element14', 'LCSC Electronics'];
    const names = new Set<string>(defaultSuppliers);
    dropdownSuppliers.forEach((d) => names.add(d.value));

    const list = Array.from(names).map((name) => ({
      id: name,
      name,
    }));

    return NextResponse.json({
      suppliers: list,
      data: list,
      total: list.length,
    });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 });
  }
}

// POST /api/suppliers - Add a supplier
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.response;
    const user = auth.user;

    const body = await request.json();
    const name = String(body.name || '').trim();

    if (!name) {
      return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 });
    }

    await prisma.userDropdownValue.upsert({
      where: {
        userId_categoryKey_value: {
          userId: user.id,
          categoryKey: 'supplier',
          value: name,
        },
      },
      create: {
        userId: user.id,
        categoryKey: 'supplier',
        value: name,
      },
      update: {
        isActive: true,
      },
    });

    return NextResponse.json({ supplier: { id: name, name } }, { status: 201 });
  } catch (error) {
    console.error('Error creating supplier:', error);
    return NextResponse.json({ error: 'Failed to create supplier' }, { status: 500 });
  }
}
