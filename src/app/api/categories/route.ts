import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.response;
    const user = auth.user;

    const dropdowns = await prisma.userDropdownValue.findMany({
      where: {
        userId: user.id,
        categoryKey: 'category',
        isActive: true,
      },
      select: { value: true },
    });

    const defaults = ['Microcontroller', 'Sensor', 'Power', 'Passive', 'Connector', 'Semiconductor', 'Display', 'Communication', 'Tool', 'Module'];
    const names = new Set<string>(defaults);
    dropdowns.forEach((d) => names.add(d.value));

    const list = Array.from(names).map((name) => ({
      id: name,
      name,
    }));

    return NextResponse.json(list);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.response;
    const user = auth.user;

    const body = await request.json();
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: 'Category name is required' }, { status: 400 });

    await prisma.userDropdownValue.upsert({
      where: {
        userId_categoryKey_value: {
          userId: user.id,
          categoryKey: 'category',
          value: name,
        },
      },
      create: { userId: user.id, categoryKey: 'category', value: name },
      update: { isActive: true },
    });

    return NextResponse.json({ id: name, name }, { status: 201 });
  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}
