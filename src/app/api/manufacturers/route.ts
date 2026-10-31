import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { manufacturerCreateSchema } from '@/lib/validations';
import { Prisma } from '@prisma/client';

// GET /api/manufacturers - List manufacturers with search and component counts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const query = searchParams.get('query') || undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)));

    const where: Prisma.ManufacturerWhereInput = {};

    if (query) {
      where.OR = [
        { name: { contains: query } },
        { country: { contains: query } },
        { notes: { contains: query } },
      ];
    }

    const [manufacturers, total] = await Promise.all([
      prisma.manufacturer.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: {
            select: { components: true },
          },
        },
      }),
      prisma.manufacturer.count({ where }),
    ]);

    return NextResponse.json({
      manufacturers,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Error fetching manufacturers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch manufacturers' },
      { status: 500 }
    );
  }
}

// POST /api/manufacturers - Create a new manufacturer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = manufacturerCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const manufacturer = await prisma.manufacturer.create({
      data: parsed.data,
      include: {
        _count: { select: { components: true } },
      },
    });

    return NextResponse.json(manufacturer, { status: 201 });
  } catch (error) {
    console.error('Error creating manufacturer:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A manufacturer with this name already exists' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create manufacturer' },
      { status: 500 }
    );
  }
}
