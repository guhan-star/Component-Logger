import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

const specTemplateCreateSchema = z.object({
  fieldName: z.string().min(1, 'Field name is required').max(100),
  label: z.string().min(1, 'Label is required').max(100),
  fieldType: z.enum(['number', 'text', 'select', 'boolean']),
  unit: z.string().optional().nullable(),
  baseUnit: z.string().optional().nullable(),
  options: z.string().optional().nullable(), // JSON array for select fields
  sortOrder: z.number().int().default(0),
  isRequired: z.boolean().default(false),
});

// GET /api/categories/[id]/specs - Get spec templates for a category
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify category exists
    const category = await prisma.category.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    const specTemplates = await prisma.specTemplate.findMany({
      where: { categoryId: id },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json(specTemplates);
  } catch (error) {
    console.error('Error fetching spec templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch spec templates' },
      { status: 500 }
    );
  }
}

// POST /api/categories/[id]/specs - Add a spec template to a category
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = specTemplateCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Verify category exists
    const category = await prisma.category.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    const specTemplate = await prisma.specTemplate.create({
      data: {
        ...parsed.data,
        categoryId: id,
      },
    });

    return NextResponse.json(specTemplate, { status: 201 });
  } catch (error) {
    console.error('Error creating spec template:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A spec template with this field name already exists for this category' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create spec template' },
      { status: 500 }
    );
  }
}
