import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// POST /api/components/[id]/restore - Restore an archived component
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.component.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Component not found' },
        { status: 404 }
      );
    }

    if (!existing.isArchived) {
      return NextResponse.json(
        { error: 'Component is not archived' },
        { status: 400 }
      );
    }

    const component = await prisma.$transaction(async (tx) => {
      const restored = await tx.component.update({
        where: { id },
        data: { isArchived: false },
        include: {
          category: true,
          manufacturer: true,
          supplier: true,
          tags: { include: { tag: true } },
          specifications: true,
        },
      });

      await tx.changeHistory.create({
        data: {
          componentId: id,
          fieldName: 'isArchived',
          oldValue: 'true',
          newValue: 'false',
          changeType: 'RESTORE',
          notes: 'Component restored from archive',
        },
      });

      return restored;
    });

    return NextResponse.json(component);
  } catch (error) {
    console.error('Error restoring component:', error);
    return NextResponse.json(
      { error: 'Failed to restore component' },
      { status: 500 }
    );
  }
}
