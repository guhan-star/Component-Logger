import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    let settings = await prisma.userSettings.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      settings = await prisma.userSettings.create({
        data: { id: 'default' },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('GET /api/settings error:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const settings = await prisma.userSettings.upsert({
      where: { id: 'default' },
      update: {
        theme: body.theme,
        defaultCurrency: body.defaultCurrency,
        defaultUnit: body.defaultUnit,
        defaultPageSize: body.defaultPageSize,
        defaultSortField: body.defaultSortField,
        defaultSortOrder: body.defaultSortOrder,
        lowStockThreshold: body.lowStockThreshold,
        dateFormat: body.dateFormat,
        defaultVisibleColumns: body.defaultVisibleColumns,
      },
      create: {
        id: 'default',
        theme: body.theme || 'dark',
        defaultCurrency: body.defaultCurrency || 'INR',
        defaultUnit: body.defaultUnit || 'pcs',
        defaultPageSize: body.defaultPageSize || 25,
        defaultSortField: body.defaultSortField || 'updatedAt',
        defaultSortOrder: body.defaultSortOrder || 'desc',
        lowStockThreshold: body.lowStockThreshold || 5,
        dateFormat: body.dateFormat || 'DD/MM/YYYY',
        defaultVisibleColumns: body.defaultVisibleColumns,
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error('POST /api/settings error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
