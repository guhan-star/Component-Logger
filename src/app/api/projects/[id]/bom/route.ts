import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { getProjectRole } from '@/lib/project-auth';
import { z } from 'zod';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const customBomItemSchema = z.object({
  name: z.string().trim().min(1, 'Item name is required').max(100),
  category: z.string().trim().max(50).optional().nullable(),
  subcategory: z.string().trim().max(50).optional().nullable(),
  manufacturer: z.string().trim().max(100).optional().nullable(),
  mpn: z.string().trim().max(100).optional().nullable(),
  model: z.string().trim().max(100).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  specifications: z.string().optional().nullable(),
  quantityRequired: z.number().int().min(1).default(1),
  unit: z.string().default('Piece'),
  notes: z.string().trim().max(500).optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  datasheetUrl: z.string().optional().nullable(),
});

// GET: list all BOM snapshot items for this project
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.response;
  const user = auth.user;

  const { id: projectId } = await context.params;
  const perm = await getProjectRole(projectId, user.id);
  if (!perm.authorized) {
    return NextResponse.json({ error: perm.error }, { status: perm.statusCode || 403 });
  }

  const bomItems = await prisma.projectBomItem.findMany({
    where: { projectId },
    include: {
      createdBy: {
        select: { id: true, username: true, name: true, avatarUrl: true },
      },
      updatedBy: {
        select: { id: true, username: true, name: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({
    bomItems,
    count: bomItems.length,
    canEdit: perm.role === 'OWNER' || perm.role === 'EDITOR',
  });
}

// POST: add BOM item (either snapshot from private inventory or custom planned item)
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.response;
  const user = auth.user;

  const { id: projectId } = await context.params;
  const perm = await getProjectRole(projectId, user.id);
  if (!perm.authorized) {
    return NextResponse.json({ error: perm.error }, { status: perm.statusCode || 403 });
  }

  if (perm.role !== 'OWNER' && perm.role !== 'EDITOR') {
    return NextResponse.json(
      { error: 'Only project owners and editors can add items to the collaborative BOM.' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const sourceComponentId = body.sourceComponentId || body.componentId;

    if (sourceComponentId) {
      // 1. Snapshot from private inventory
      // Verify that the component strictly belongs to the authenticated user!
      const userComponent = await prisma.component.findFirst({
        where: {
          id: sourceComponentId,
          userId: user.id, // Must own component to share snapshot
        },
        include: {
          specifications: true,
        },
      });

      if (!userComponent) {
        return NextResponse.json(
          { error: 'Component not found in your private inventory.' },
          { status: 404 }
        );
      }

      // Explicit Allowlist Snapshot:
      // NEVER copy quantityOnHand, quantityAvailable, purchasePrice, purchaseDate,
      // supplier, storageLocation, receipts, or private notes.
      const quantityRequired = Math.max(1, parseInt(body.quantityRequired, 10) || 1);
      const teamNotes = body.notes ? String(body.notes).trim() : null;
      const specsSnapshot = userComponent.specifications?.length
        ? JSON.stringify(userComponent.specifications.map((s) => ({
            fieldName: s.fieldName,
            value: s.textValue ?? s.numericValue,
            unit: s.unit,
          })))
        : null;

      const bomItem = await prisma.projectBomItem.create({
        data: {
          projectId,
          name: userComponent.name,
          category: userComponent.category,
          subcategory: userComponent.subcategory,
          manufacturer: userComponent.manufacturer,
          mpn: userComponent.mpn,
          model: userComponent.model,
          description: userComponent.description,
          specifications: specsSnapshot,
          quantityRequired,
          unit: userComponent.unitOfMeasurement || 'Piece',
          notes: teamNotes,
          imageUrl: userComponent.imageUrl,
          datasheetUrl: userComponent.datasheetUrl,

          // Lineage metadata
          sourceComponentId: userComponent.id,
          sourceOwnerId: user.id,
          createdById: user.id,
        },
        include: {
          createdBy: {
            select: { id: true, username: true, name: true },
          },
        },
      });

      return NextResponse.json({
        success: true,
        bomItem,
        message: `Added snapshot of "${userComponent.name}" to project BOM.`,
      }, { status: 201 });
    }

    // 2. Custom planned item
    const parsed = customBomItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed.', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const bomItem = await prisma.projectBomItem.create({
      data: {
        projectId,
        name: data.name,
        category: data.category,
        subcategory: data.subcategory,
        manufacturer: data.manufacturer,
        mpn: data.mpn,
        model: data.model,
        description: data.description,
        specifications: data.specifications,
        quantityRequired: data.quantityRequired,
        unit: data.unit,
        notes: data.notes,
        imageUrl: data.imageUrl,
        datasheetUrl: data.datasheetUrl,
        createdById: user.id,
      },
      include: {
        createdBy: {
          select: { id: true, username: true, name: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      bomItem,
      message: `Added custom item "${data.name}" to project BOM.`,
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects/[id]/bom error:', error);
    return NextResponse.json({ error: 'Failed to add item to BOM.' }, { status: 500 });
  }
}
