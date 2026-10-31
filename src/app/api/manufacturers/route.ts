import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.response;
    const user = auth.user;

    const dropdownMfgs = await prisma.userDropdownValue.findMany({
      where: {
        userId: user.id,
        categoryKey: 'manufacturer',
        isActive: true,
      },
      select: { value: true },
    });

    const defaults = ['Espressif Systems', 'Texas Instruments', 'STMicroelectronics', 'Bosch Sensortec', 'Microchip', 'Vishay', 'Adafruit'];
    const names = new Set<string>(defaults);
    dropdownMfgs.forEach((d) => names.add(d.value));

    const list = Array.from(names).map((name) => ({ id: name, name }));
    return NextResponse.json({ manufacturers: list, data: list, total: list.length });
  } catch (error) {
    console.error('Error fetching manufacturers:', error);
    return NextResponse.json({ error: 'Failed to fetch manufacturers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.response;
    const user = auth.user;

    const body = await request.json();
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: 'Manufacturer name is required' }, { status: 400 });

    await prisma.userDropdownValue.upsert({
      where: {
        userId_categoryKey_value: {
          userId: user.id,
          categoryKey: 'manufacturer',
          value: name,
        },
      },
      create: { userId: user.id, categoryKey: 'manufacturer', value: name },
      update: { isActive: true },
    });

    return NextResponse.json({ manufacturer: { id: name, name } }, { status: 201 });
  } catch (error) {
    console.error('Error creating manufacturer:', error);
    return NextResponse.json({ error: 'Failed to create manufacturer' }, { status: 500 });
  }
}
