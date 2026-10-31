import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { categoryUpdateSchema } from '@/lib/validations';
import { Prisma } from '@prisma/client';

// GET /api/categories/[id] - Get a single category
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: {
          include: {
            _count: { select: { components: true } },
          },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
        _count: {
          select: { components: true },
        },
        specTemplates: {
          orderBy: { sortOrder: 'asc' },
        },
        components: {
          take: 10,
          orderBy: { updatedAt: 'desc' },
          select: { id: true, name: true, imageUrl: true },
        },
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(category);
  } catch (error) {
    console.error('Error fetching category:', error);
    return NextResponse.json(
      { error: 'Failed to fetch category' },
      { status: 500 }
    );
  }
}

// PUT /api/categories/[id] - Update a category
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = categoryUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Prevent setting parent to self
    if (parsed.data.parentId === id) {
      return NextResponse.json(
        { error: 'Category cannot be its own parent' },
        { status: 400 }
      );
    }

    const category = await prisma.category.update({
      where: { id },
      data: parsed.data,
      include: {
        _count: { select: { components: true } },
        specTemplates: { orderBy: { sortOrder: 'asc' } },
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A category with this name already exists' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update category' },
      { status: 500 }
    );
  }
}

// DELETE /api/categories/[id] - Delete a category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: { select: { components: true, children: true } },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    if (existing._count.components > 0) {
      return NextResponse.json(
        { error: `Cannot delete category with ${existing._count.components} associated components. Reassign them first.` },
        { status: 400 }
      );
    }

    if (existing._count.children > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category with subcategories. Delete or reassign them first.' },
        { status: 400 }
      );
    }

    await prisma.category.delete({ where: { id } });

    return NextResponse.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 }
    );
  }
}
