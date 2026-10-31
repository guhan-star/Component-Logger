import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { personCreateSchema } from '@/lib/validations';

const personUpdateSchema = personCreateSchema.partial();

// GET /api/persons/[id] - Get a single person
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const person = await prisma.person.findUnique({
      where: { id },
      include: {
        _count: {
          select: { borrowRecords: true, lendRecords: true },
        },
        borrowRecords: {
          include: {
            component: {
              select: { id: true, name: true, imageUrl: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        lendRecords: {
          include: {
            component: {
              select: { id: true, name: true, imageUrl: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!person) {
      return NextResponse.json(
        { error: 'Person not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(person);
  } catch (error) {
    console.error('Error fetching person:', error);
    return NextResponse.json(
      { error: 'Failed to fetch person' },
      { status: 500 }
    );
  }
}

// PUT /api/persons/[id] - Update a person
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = personUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.person.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Person not found' },
        { status: 404 }
      );
    }

    const person = await prisma.person.update({
      where: { id },
      data: parsed.data,
      include: {
        _count: { select: { borrowRecords: true, lendRecords: true } },
      },
    });

    return NextResponse.json(person);
  } catch (error) {
    console.error('Error updating person:', error);
    return NextResponse.json(
      { error: 'Failed to update person' },
      { status: 500 }
    );
  }
}

// DELETE /api/persons/[id] - Delete a person
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.person.findUnique({
      where: { id },
      include: {
        _count: {
          select: { borrowRecords: true, lendRecords: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Person not found' },
        { status: 404 }
      );
    }

    // Check for active borrow/lend records
    const activeRecords = await prisma.borrowRecord.count({
      where: { borrowedFromId: id, status: 'Active' },
    });
    const activeLends = await prisma.lendRecord.count({
      where: { lentToId: id, status: 'Active' },
    });

    if (activeRecords > 0 || activeLends > 0) {
      return NextResponse.json(
        { error: 'Cannot delete person with active borrow or lend records. Resolve them first.' },
        { status: 400 }
      );
    }

    await prisma.person.delete({ where: { id } });

    return NextResponse.json({ message: 'Person deleted successfully' });
  } catch (error) {
    console.error('Error deleting person:', error);
    return NextResponse.json(
      { error: 'Failed to delete person' },
      { status: 500 }
    );
  }
}
