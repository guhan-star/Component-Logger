import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { personCreateSchema } from '@/lib/validations';

// GET /api/persons - List persons with search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const query = searchParams.get('query') || undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)));

    const where: { OR?: Array<Record<string, { contains: string }>> } = {};

    if (query) {
      where.OR = [
        { name: { contains: query } },
        { email: { contains: query } },
        { phone: { contains: query } },
        { notes: { contains: query } },
      ];
    }

    const [persons, total] = await Promise.all([
      prisma.person.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: {
            select: {
              borrowRecords: true,
              lendRecords: true,
            },
          },
        },
      }),
      prisma.person.count({ where }),
    ]);

    return NextResponse.json({
      persons,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Error fetching persons:', error);
    return NextResponse.json(
      { error: 'Failed to fetch persons' },
      { status: 500 }
    );
  }
}

// POST /api/persons - Create a new person
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = personCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const person = await prisma.person.create({
      data: parsed.data,
      include: {
        _count: {
          select: { borrowRecords: true, lendRecords: true },
        },
      },
    });

    return NextResponse.json(person, { status: 201 });
  } catch (error) {
    console.error('Error creating person:', error);
    return NextResponse.json(
      { error: 'Failed to create person' },
      { status: 500 }
    );
  }
}
