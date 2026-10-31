import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { componentCreateSchema } from '@/lib/validations';
import { Prisma } from '@prisma/client';

// GET /api/components - List components with search, filter, sort, paginate
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    // Parse query parameters
    const query = searchParams.get('query') || undefined;
    const categoryId = searchParams.get('categoryId') || undefined;
    const subcategory = searchParams.get('subcategory') || undefined;
    const manufacturerId = searchParams.get('manufacturerId') || undefined;
    const supplierId = searchParams.get('supplierId') || undefined;
    const ownershipType = searchParams.get('ownershipType') || undefined;
    const condition = searchParams.get('condition') || undefined;
    const tagIds = searchParams.get('tagIds') || undefined;
    const minQuantity = searchParams.get('minQuantity');
    const maxQuantity = searchParams.get('maxQuantity');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const lowStock = searchParams.get('lowStock');
    const hasDatasheet = searchParams.get('hasDatasheet');
    const hasImage = searchParams.get('hasImage');
    const isArchived = searchParams.get('isArchived');
    const projectId = searchParams.get('projectId') || undefined;
    const borrowedFromId = searchParams.get('borrowedFromId') || undefined;
    const lentToId = searchParams.get('lentToId') || undefined;
    const status = searchParams.get('status') || undefined;
    const specFilters = searchParams.get('specFilters') || undefined;
    const sortField = searchParams.get('sortField') || 'updatedAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '25', 10)));

    // Build where clause
    const where: Prisma.ComponentWhereInput = {};

    // Archive filter (default: show non-archived)
    where.isArchived = isArchived === 'true' ? true : false;

    // Text search across multiple fields
    if (query) {
      where.OR = [
        { name: { contains: query } },
        { description: { contains: query } },
        { mpn: { contains: query } },
        { genericPartNumber: { contains: query } },
        { notes: { contains: query } },
      ];
    }

    // Direct field filters
    if (categoryId) where.categoryId = categoryId;
    if (subcategory) where.subcategory = subcategory;
    if (manufacturerId) where.manufacturerId = manufacturerId;
    if (supplierId) where.supplierId = supplierId;
    if (ownershipType) where.ownershipType = ownershipType;
    if (condition) where.condition = condition;

    // Quantity range filters
    if (minQuantity !== null || maxQuantity !== null) {
      where.quantityAvailable = {};
      if (minQuantity !== null) where.quantityAvailable.gte = parseInt(minQuantity, 10);
      if (maxQuantity !== null) where.quantityAvailable.lte = parseInt(maxQuantity, 10);
    }

    // Price range filters
    if (minPrice !== null || maxPrice !== null) {
      where.unitCost = {};
      if (minPrice !== null) where.unitCost.gte = parseFloat(minPrice);
      if (maxPrice !== null) where.unitCost.lte = parseFloat(maxPrice);
    }

    // Low stock filter
    if (lowStock === 'true') {
      where.minimumStock = { not: null };
      where.quantityAvailable = {
        ...(where.quantityAvailable as Prisma.IntFilter || {}),
        lte: prisma.component.fields.minimumStock as unknown as number,
      };
      // SQLite doesn't support field comparison directly, use raw filter approach
      // Instead, we'll handle this with a raw where condition
      delete where.quantityAvailable;
      delete where.minimumStock;
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        { minimumStock: { not: null } },
        { minimumStock: { gt: 0 } },
      ];
      // We'll post-filter or use a raw query segment. For Prisma compatibility,
      // we use a workaround: fetch components where minimumStock is set and check in raw SQL.
      // Actually, Prisma doesn't support column-to-column comparison.
      // We'll use $queryRawUnsafe for this specific case, or handle it in a two-step approach.
      // For simplicity and correctness, we'll filter low stock items via raw SQL condition.
    }

    // Datasheet and image filters
    if (hasDatasheet === 'true') where.datasheetUrl = { not: null };
    if (hasDatasheet === 'false') where.datasheetUrl = null;
    if (hasImage === 'true') where.imageUrl = { not: null };
    if (hasImage === 'false') where.imageUrl = null;

    // Tag filter
    if (tagIds) {
      const tagIdList = tagIds.split(',').map((id) => id.trim()).filter(Boolean);
      if (tagIdList.length > 0) {
        where.tags = {
          some: {
            tagId: { in: tagIdList },
          },
        };
      }
    }

    // Project association filter
    if (projectId) {
      where.projectComponents = {
        some: { projectId },
      };
    }

    // Borrow/Lend person filters
    if (borrowedFromId) {
      where.borrowRecords = {
        some: { borrowedFromId, status: 'Active' },
      };
    }
    if (lentToId) {
      where.lendRecords = {
        some: { lentToId, status: 'Active' },
      };
    }

    // Status filter (derives from quantity fields)
    if (status) {
      switch (status) {
        case 'InStorage':
          where.quantityAvailable = { gt: 0 };
          break;
        case 'InUse':
          where.quantityInUse = { gt: 0 };
          break;
        case 'LentOut':
          where.quantityLentOut = { gt: 0 };
          break;
        case 'Borrowed':
          where.quantityBorrowed = { gt: 0 };
          break;
      }
    }

    // Technical spec filters
    if (specFilters) {
      try {
        const filters = JSON.parse(specFilters) as Array<{
          fieldName: string;
          min?: number;
          max?: number;
          value?: string;
        }>;
        for (const filter of filters) {
          const specCondition: Prisma.TechnicalSpecWhereInput = {
            fieldName: filter.fieldName,
          };
          if (filter.value !== undefined) {
            specCondition.textValue = filter.value;
          }
          if (filter.min !== undefined || filter.max !== undefined) {
            specCondition.numericValue = {};
            if (filter.min !== undefined) specCondition.numericValue.gte = filter.min;
            if (filter.max !== undefined) specCondition.numericValue.lte = filter.max;
          }
          where.specifications = {
            some: specCondition,
          };
        }
      } catch {
        // Invalid JSON, skip spec filters
      }
    }

    // Handle low stock with raw filtering since Prisma can't compare two columns
    let lowStockIds: string[] | undefined;
    if (lowStock === 'true') {
      const lowStockComponents = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM Component WHERE minimumStock IS NOT NULL AND minimumStock > 0 AND quantityAvailable <= minimumStock AND isArchived = 0`
      );
      lowStockIds = lowStockComponents.map((c) => c.id);
      // Clean up the AND we added earlier
      if (Array.isArray(where.AND)) {
        where.AND = (where.AND as Prisma.ComponentWhereInput[]).filter(
          (c) => !('minimumStock' in c)
        );
        if (where.AND.length === 0) delete where.AND;
      }
      where.id = { in: lowStockIds };
    }

    // Build orderBy
    const orderBy: Prisma.ComponentOrderByWithRelationInput = {};
    const validSortFields = [
      'name', 'createdAt', 'updatedAt', 'quantityOwned', 'quantityAvailable',
      'unitCost', 'condition', 'ownershipType', 'lastUsedAt',
    ];
    if (validSortFields.includes(sortField)) {
      (orderBy as Record<string, string>)[sortField] = sortOrder;
    } else {
      orderBy.updatedAt = sortOrder;
    }

    // Execute query
    const [components, total] = await Promise.all([
      prisma.component.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          category: true,
          manufacturer: true,
          supplier: true,
          tags: {
            include: {
              tag: true,
            },
          },
          specifications: true,
        },
      }),
      prisma.component.count({ where }),
    ]);

    return NextResponse.json({
      components,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Error fetching components:', error);
    return NextResponse.json(
      { error: 'Failed to fetch components' },
      { status: 500 }
    );
  }
}

// POST /api/components - Create a new component
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = componentCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { tagIds, specifications, ...componentData } = parsed.data;

    // Parse acquisition date if provided
    const createData: Prisma.ComponentCreateInput = {
      ...componentData,
      acquisitionDate: componentData.acquisitionDate
        ? new Date(componentData.acquisitionDate)
        : undefined,
      // Connect relations by ID
      category: componentData.categoryId
        ? { connect: { id: componentData.categoryId } }
        : undefined,
      manufacturer: componentData.manufacturerId
        ? { connect: { id: componentData.manufacturerId } }
        : undefined,
      supplier: componentData.supplierId
        ? { connect: { id: componentData.supplierId } }
        : undefined,
    };

    // Remove raw FK fields since we're using connect
    delete (createData as Record<string, unknown>).categoryId;
    delete (createData as Record<string, unknown>).manufacturerId;
    delete (createData as Record<string, unknown>).supplierId;

    const component = await prisma.$transaction(async (tx) => {
      // Create the component
      const created = await tx.component.create({
        data: createData,
      });

      // Create tag associations
      if (tagIds && tagIds.length > 0) {
        await tx.componentTag.createMany({
          data: tagIds.map((tagId) => ({
            componentId: created.id,
            tagId,
          })),
        });
      }

      // Create specifications
      if (specifications && specifications.length > 0) {
        await tx.technicalSpec.createMany({
          data: specifications.map((spec) => ({
            componentId: created.id,
            fieldName: spec.fieldName,
            textValue: spec.textValue ?? null,
            numericValue: spec.numericValue ?? null,
            unit: spec.unit ?? null,
          })),
        });
      }

      // Record INITIAL transaction if quantity > 0
      if (componentData.quantityOwned && componentData.quantityOwned > 0) {
        await tx.inventoryTransaction.create({
          data: {
            componentId: created.id,
            transactionType: 'INITIAL',
            quantity: componentData.quantityOwned,
            previousQty: 0,
            resultingQty: componentData.quantityOwned,
            notes: 'Initial inventory entry',
          },
        });
      }

      // Record creation in ChangeHistory
      await tx.changeHistory.create({
        data: {
          componentId: created.id,
          fieldName: 'component',
          oldValue: null,
          newValue: created.name,
          changeType: 'CREATE',
          notes: 'Component created',
        },
      });

      // Return the created component with relations
      return tx.component.findUnique({
        where: { id: created.id },
        include: {
          category: true,
          manufacturer: true,
          supplier: true,
          tags: { include: { tag: true } },
          specifications: true,
        },
      });
    });

    return NextResponse.json(component, { status: 201 });
  } catch (error) {
    console.error('Error creating component:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'A component with these details already exists' },
          { status: 400 }
        );
      }
      if (error.code === 'P2025') {
        return NextResponse.json(
          { error: 'Referenced record not found (category, manufacturer, or supplier)' },
          { status: 400 }
        );
      }
    }
    return NextResponse.json(
      { error: 'Failed to create component' },
      { status: 500 }
    );
  }
}
