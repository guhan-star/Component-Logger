import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { projectCreateSchema } from '@/lib/validations';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        components: {
          include: {
            component: {
              select: {
                id: true,
                name: true,
                quantityAvailable: true,
                unitOfMeasurement: true,
              },
            },
          },
        },
        _count: {
          select: { components: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ data: projects });
  } catch (error) {
    console.error('GET /api/projects error:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = projectCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const project = await prisma.project.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        status: parsed.data.status,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        targetDate: parsed.data.targetDate ? new Date(parsed.data.targetDate) : null,
        notes: parsed.data.notes,
        relatedLinks: parsed.data.relatedLinks,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects error:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
