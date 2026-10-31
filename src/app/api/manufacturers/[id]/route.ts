import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { manufacturerCreateSchema } from '@/lib/validations';
import { Prisma } from '@prisma/client';

const manufacturerUpdateSchema = manufacturerCreateSchema.partial();

// GET /api/manufacturers/[id] - Get a single manufacturer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const manufacturer = await prisma.manufacturer.findUnique({
      where: { id },
      include: {
        _count: { select: { components: true } },
        components: {
          take: 20,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            name: true,
            mpn: true,
            imageUrl: true,
            quantityAvailable: true,
          },
        },
      },
    });

    if (!manufacturer) {
      return NextResponse.json(
        { error: 'Manufacturer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(manufacturer);
  } catch (error) {
    console.error('Error fetching manufacturer:', error);
    return NextResponse.json(
      { error: 'Failed to fetch manufacturer' },
      { status: 500 }
    );
  }
}

// PUT /api/manufacturers/[id] - Update a manufacturer
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = manufacturerUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.manufacturer.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Manufacturer not found' },
        { status: 404 }
      );
    }

    const manufacturer = await prisma.manufacturer.update({
      where: { id },
      data: parsed.data,
      include: {
        _count: { select: { components: true } },
      },
    });

    return NextResponse.json(manufacturer);
  } catch (error) {
    console.error('Error updating manufacturer:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A manufacturer with this name already exists' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update manufacturer' },
      { status: 500 }
    );
  }
}

// DELETE /api/manufacturers/[id] - Delete a manufacturer
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.manufacturer.findUnique({
      where: { id },
      include: { _count: { select: { components: true } } },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Manufacturer not found' },
        { status: 404 }
      );
    }

    if (existing._count.components > 0) {
      return NextResponse.json(
        { error: `Cannot delete manufacturer with ${existing._count.components} associated components. Reassign them first.` },
        { status: 400 }
      );
    }

    await prisma.manufacturer.delete({ where: { id } });

    return NextResponse.json({ message: 'Manufacturer deleted successfully' });
  } catch (error) {
    console.error('Error deleting manufacturer:', error);
    return NextResponse.json(
      { error: 'Failed to delete manufacturer' },
      { status: 500 }
    );
  }
}
