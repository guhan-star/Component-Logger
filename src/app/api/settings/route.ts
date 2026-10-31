import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    let settings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
    });

    if (!settings) {
      settings = await prisma.userSettings.create({
        data: {
          userId: user.id,
          theme: 'dark',
          defaultCurrency: 'INR',
          defaultUnit: 'Piece',
          defaultPageSize: 25,
        },
      });
    }

    const dropdownValues = await prisma.userDropdownValue.findMany({
      where: { userId: user.id, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    // Group dropdown values by categoryKey
    const datasets: Record<string, string[]> = {};
    for (const item of dropdownValues) {
      if (!datasets[item.categoryKey]) {
        datasets[item.categoryKey] = [];
      }
      datasets[item.categoryKey].push(item.value);
    }

    return NextResponse.json({
      settings,
      datasets,
    });
  } catch (error) {
    console.error('GET /api/settings error:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const body = await request.json();

    // 1. If modifying a dropdown value
    if (body.action === 'add_dropdown_value') {
      const { categoryKey, value } = body;
      if (!categoryKey || !value) {
        return NextResponse.json({ error: 'categoryKey and value are required.' }, { status: 400 });
      }

      const trimmed = String(value).trim();
      const existing = await prisma.userDropdownValue.findFirst({
        where: {
          userId: user.id,
          categoryKey,
          value: { equals: trimmed },
        },
      });

      if (!existing) {
        await prisma.userDropdownValue.create({
          data: {
            userId: user.id,
            categoryKey,
            value: trimmed,
          },
        });
      }

      return NextResponse.json({ success: true });
    }

    if (body.action === 'remove_dropdown_value') {
      const { categoryKey, value } = body;
      await prisma.userDropdownValue.deleteMany({
        where: {
          userId: user.id,
          categoryKey,
          value: String(value).trim(),
        },
      });
      return NextResponse.json({ success: true });
    }

    // 2. Otherwise update general user settings
    const settings = await prisma.userSettings.upsert({
      where: { userId: user.id },
      update: {
        theme: body.theme,
        defaultCurrency: body.defaultCurrency,
        defaultUnit: body.defaultUnit,
        defaultPageSize: body.defaultPageSize,
        defaultSortField: body.defaultSortField,
        defaultSortOrder: body.defaultSortOrder,
        dateFormat: body.dateFormat,
      },
      create: {
        userId: user.id,
        theme: body.theme || 'dark',
        defaultCurrency: body.defaultCurrency || 'INR',
        defaultUnit: body.defaultUnit || 'Piece',
        defaultPageSize: body.defaultPageSize || 25,
      },
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('POST /api/settings error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
