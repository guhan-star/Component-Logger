import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.response;
    const user = auth.user;

    const dropdowns = await prisma.userDropdownValue.findMany({
      where: { userId: user.id, categoryKey: 'tag', isActive: true },
      select: { value: true },
    });

    const list = dropdowns.map((d) => ({ id: d.value, name: d.value }));
    return NextResponse.json(list);
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.response;
    const user = auth.user;

    const body = await request.json();
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: 'Tag name is required' }, { status: 400 });

    await prisma.userDropdownValue.upsert({
      where: {
        userId_categoryKey_value: {
          userId: user.id,
          categoryKey: 'tag',
          value: name,
        },
      },
      create: { userId: user.id, categoryKey: 'tag', value: name },
      update: { isActive: true },
    });

    return NextResponse.json({ id: name, name }, { status: 201 });
  } catch (error) {
    console.error('Error creating tag:', error);
    return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 });
  }
}
