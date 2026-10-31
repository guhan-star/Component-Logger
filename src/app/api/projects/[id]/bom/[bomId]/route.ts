import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { getProjectRole } from '@/lib/project-auth';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ id: string; bomId: string }>;
}

const updateBomItemSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  category: z.string().trim().max(50).optional().nullable(),
  subcategory: z.string().trim().max(50).optional().nullable(),
  manufacturer: z.string().trim().max(100).optional().nullable(),
  mpn: z.string().trim().max(100).optional().nullable(),
  model: z.string().trim().max(100).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  specifications: z.string().optional().nullable(),
  quantityRequired: z.number().int().min(1).optional(),
  unit: z.string().optional(),
  notes: z.string().trim().max(500).optional().nullable(),
});

// PATCH: update BOM snapshot item
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.response;
  const user = auth.user;

  const { id: projectId, bomId } = await context.params;
  const perm = await getProjectRole(projectId, user.id);
  if (!perm.authorized) {
    return NextResponse.json({ error: perm.error }, { status: perm.statusCode || 403 });
  }

  if (perm.role !== 'OWNER' && perm.role !== 'EDITOR') {
    return NextResponse.json(
      { error: 'Only project owners and editors can modify BOM items.' },
      { status: 403 }
    );
  }

  const existing = await prisma.projectBomItem.findFirst({
    where: { id: bomId, projectId },
  });

  if (!existing) {
    return NextResponse.json({ error: 'BOM item not found in this project.' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = updateBomItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed.', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data: any = { ...parsed.data, updatedById: user.id };

    const updated = await prisma.projectBomItem.update({
      where: { id: bomId },
      data,
      include: {
        createdBy: {
          select: { id: true, username: true, name: true },
        },
        updatedBy: {
          select: { id: true, username: true, name: true },
        },
      },
    });

    return NextResponse.json({ success: true, bomItem: updated });
  } catch (error) {
    console.error('PATCH /api/projects/[id]/bom/[bomId] error:', error);
    return NextResponse.json({ error: 'Failed to update BOM item.' }, { status: 500 });
  }
}

// DELETE: remove BOM item
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.response;
  const user = auth.user;

  const { id: projectId, bomId } = await context.params;
  const perm = await getProjectRole(projectId, user.id);
  if (!perm.authorized) {
    return NextResponse.json({ error: perm.error }, { status: perm.statusCode || 403 });
  }

  if (perm.role !== 'OWNER' && perm.role !== 'EDITOR') {
    return NextResponse.json(
      { error: 'Only project owners and editors can delete BOM items.' },
      { status: 403 }
    );
  }

  const deleted = await prisma.projectBomItem.deleteMany({
    where: { id: bomId, projectId },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: 'BOM item not found.' }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: 'BOM item removed successfully.' });
}
