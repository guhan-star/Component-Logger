import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { projectComponentSchema } from '@/lib/validations';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();
    const parsed = projectComponentSchema.safeParse({ ...body, projectId });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { componentId, plannedQuantity, reservedQuantity, usedQuantity, notes } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      // Find component
      const component = await tx.component.findUnique({ where: { id: componentId } });
      if (!component) throw new Error('Component not found');

      // Check existing project component
      const existing = await tx.projectComponent.findUnique({
        where: {
          projectId_componentId: { projectId, componentId },
        },
      });

      const oldReserved = existing?.reservedQuantity || 0;
      const oldUsed = existing?.usedQuantity || 0;

      const deltaReserved = reservedQuantity - oldReserved;
      const deltaUsed = usedQuantity - oldUsed;

      if (deltaReserved > 0 && component.quantityAvailable < deltaReserved) {
        throw new Error(`Insufficient available stock (${component.quantityAvailable}) to reserve ${deltaReserved}`);
      }
      if (deltaUsed > 0 && component.quantityAvailable < deltaUsed) {
        throw new Error(`Insufficient available stock (${component.quantityAvailable}) to use ${deltaUsed}`);
      }

      // Update component counts
      await tx.component.update({
        where: { id: componentId },
        data: {
          quantityAvailable: component.quantityAvailable - deltaReserved - deltaUsed,
          quantityReserved: component.quantityReserved + deltaReserved,
          quantityInUse: component.quantityInUse + deltaUsed,
        },
      });

      const projectComp = await tx.projectComponent.upsert({
        where: {
          projectId_componentId: { projectId, componentId },
        },
        create: {
          projectId,
          componentId,
          plannedQuantity,
          reservedQuantity,
          usedQuantity,
          notes,
        },
        update: {
          plannedQuantity,
          reservedQuantity,
          usedQuantity,
          notes,
        },
        include: {
          component: true,
        },
      });

      return projectComp;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('POST /api/projects/[id]/components error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update project component';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const { searchParams } = request.nextUrl;
    const componentId = searchParams.get('componentId');

    if (!componentId) {
      return NextResponse.json({ error: 'componentId is required' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      const pc = await tx.projectComponent.findUnique({
        where: { projectId_componentId: { projectId, componentId } },
      });
      if (!pc) return;

      // Release reservations and used quantities back if applicable
      await tx.component.update({
        where: { id: componentId },
        data: {
          quantityAvailable: { increment: pc.reservedQuantity },
          quantityReserved: { decrement: pc.reservedQuantity },
        },
      });

      await tx.projectComponent.delete({
        where: { projectId_componentId: { projectId, componentId } },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/projects/[id]/components error:', error);
    return NextResponse.json({ error: 'Failed to remove project component' }, { status: 500 });
  }
}
