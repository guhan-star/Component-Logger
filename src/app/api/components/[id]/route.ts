import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { componentUpdateSchema } from '@/lib/validations';
import { Prisma } from '@prisma/client';

// GET /api/components/[id] - Get a single component with all relations
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const component = await prisma.component.findUnique({
      where: { id },
      include: {
        category: true,
        manufacturer: true,
        supplier: true,
        tags: {
          include: { tag: true },
        },
        specifications: true,
        documents: true,
        borrowRecords: {
          include: { borrowedFrom: true },
          orderBy: { createdAt: 'desc' },
        },
        lendRecords: {
          include: { lentTo: true },
          orderBy: { createdAt: 'desc' },
        },
        projectComponents: {
          include: { project: true },
        },
        customFieldValues: {
          include: { field: true },
        },
        inventoryLots: {
          orderBy: { createdAt: 'desc' },
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            relatedPerson: true,
            relatedProject: true,
          },
        },
      },
    });

    if (!component) {
      return NextResponse.json(
        { error: 'Component not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(component);
  } catch (error) {
    console.error('Error fetching component:', error);
    return NextResponse.json(
      { error: 'Failed to fetch component' },
      { status: 500 }
    );
  }
}

// PUT /api/components/[id] - Update a component
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = componentUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Check if component exists
    const existing = await prisma.component.findUnique({
      where: { id },
      include: { tags: true, specifications: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Component not found' },
        { status: 404 }
      );
    }

    const { tagIds, specifications, ...updateFields } = parsed.data;

    const component = await prisma.$transaction(async (tx) => {
      // Track changes in ChangeHistory
      const trackedFields = [
        'name', 'description', 'categoryId', 'subcategory', 'manufacturerId',
        'mpn', 'genericPartNumber', 'imageUrl', 'quantityOwned', 'quantityAvailable',
        'quantityReserved', 'quantityInUse', 'quantityLentOut', 'quantityBorrowed',
        'condition', 'unitOfMeasurement', 'ownershipType', 'acquisitionDate',
        'acquisitionMethod', 'unitCost', 'currency', 'supplierId',
        'manufacturerUrl', 'datasheetUrl', 'pinoutUrl', 'cadUrl', 'schematicUrl',
        'storageLocation', 'notes', 'minimumStock',
      ] as const;

      const changeRecords: Prisma.ChangeHistoryCreateManyInput[] = [];
      for (const field of trackedFields) {
        if (field in updateFields) {
          const oldValue = String(existing[field] ?? '');
          const newValue = String((updateFields as Record<string, unknown>)[field] ?? '');
          if (oldValue !== newValue) {
            changeRecords.push({
              componentId: id,
              fieldName: field,
              oldValue: existing[field] != null ? String(existing[field]) : null,
              newValue: (updateFields as Record<string, unknown>)[field] != null
                ? String((updateFields as Record<string, unknown>)[field])
                : null,
              changeType: 'UPDATE',
            });
          }
        }
      }

      if (changeRecords.length > 0) {
        await tx.changeHistory.createMany({ data: changeRecords });
      }

      // Build update data, handling date conversion
      const updateData: Prisma.ComponentUpdateInput = { ...updateFields };
      if (updateFields.acquisitionDate !== undefined) {
        updateData.acquisitionDate = updateFields.acquisitionDate
          ? new Date(updateFields.acquisitionDate)
          : null;
      }

      // Handle relation connects/disconnects
      if ('categoryId' in updateFields) {
        updateData.category = updateFields.categoryId
          ? { connect: { id: updateFields.categoryId } }
          : { disconnect: true };
        delete (updateData as Record<string, unknown>).categoryId;
      }
      if ('manufacturerId' in updateFields) {
        updateData.manufacturer = updateFields.manufacturerId
          ? { connect: { id: updateFields.manufacturerId } }
          : { disconnect: true };
        delete (updateData as Record<string, unknown>).manufacturerId;
      }
      if ('supplierId' in updateFields) {
        updateData.supplier = updateFields.supplierId
          ? { connect: { id: updateFields.supplierId } }
          : { disconnect: true };
        delete (updateData as Record<string, unknown>).supplierId;
      }

      // Update the component
      await tx.component.update({
        where: { id },
        data: updateData,
      });

      // Update tag associations if tagIds provided
      if (tagIds !== undefined) {
        // Remove existing tags
        await tx.componentTag.deleteMany({
          where: { componentId: id },
        });

        // Add new tags
        if (tagIds.length > 0) {
          await tx.componentTag.createMany({
            data: tagIds.map((tagId) => ({
              componentId: id,
              tagId,
            })),
          });
        }
      }

      // Update specifications if provided
      if (specifications !== undefined) {
        // Remove existing specs
        await tx.technicalSpec.deleteMany({
          where: { componentId: id },
        });

        // Add new specs
        if (specifications.length > 0) {
          await tx.technicalSpec.createMany({
            data: specifications.map((spec) => ({
              componentId: id,
              fieldName: spec.fieldName,
              textValue: spec.textValue ?? null,
              numericValue: spec.numericValue ?? null,
              unit: spec.unit ?? null,
            })),
          });
        }
      }

      // Return updated component with relations
      return tx.component.findUnique({
        where: { id },
        include: {
          category: true,
          manufacturer: true,
          supplier: true,
          tags: { include: { tag: true } },
          specifications: true,
        },
      });
    });

    return NextResponse.json(component);
  } catch (error) {
    console.error('Error updating component:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          { error: 'Referenced record not found' },
          { status: 400 }
        );
      }
    }
    return NextResponse.json(
      { error: 'Failed to update component' },
      { status: 500 }
    );
  }
}

// DELETE /api/components/[id] - Soft delete (archive) a component
export async function DELETE(
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

    await prisma.$transaction(async (tx) => {
      await tx.component.update({
        where: { id },
        data: { isArchived: true },
      });

      await tx.changeHistory.create({
        data: {
          componentId: id,
          fieldName: 'isArchived',
          oldValue: 'false',
          newValue: 'true',
          changeType: 'ARCHIVE',
          notes: 'Component archived',
        },
      });
    });

    return NextResponse.json({ message: 'Component archived successfully' });
  } catch (error) {
    console.error('Error archiving component:', error);
    return NextResponse.json(
      { error: 'Failed to archive component' },
      { status: 500 }
    );
  }
}
