import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { Prisma } from '@prisma/client';

// GET /api/components - List user's private components with search, filter, sort, paginate
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const { searchParams } = request.nextUrl;

    // Parse query parameters
    const query = searchParams.get('query') || undefined;
    const category = searchParams.get('category') || undefined;
    const subcategory = searchParams.get('subcategory') || undefined;
    const componentType = searchParams.get('componentType') || undefined;
    const manufacturer = searchParams.get('manufacturer') || undefined;
    const supplier = searchParams.get('supplier') || undefined;
    const ownershipType = searchParams.get('ownershipType') || undefined;
    const condition = searchParams.get('condition') || undefined;
    const status = searchParams.get('status') || undefined;
    const storageLocation = searchParams.get('storageLocation') || undefined;
    const isArchived = searchParams.get('isArchived') === 'true';
    const sortField = searchParams.get('sortField') || 'updatedAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '200', 10)));

    // Strict user scoping
    const where: Prisma.ComponentWhereInput = {
      userId: user.id,
      isArchived,
    };

    // Text search
    if (query) {
      where.OR = [
        { name: { contains: query } },
        { description: { contains: query } },
        { mpn: { contains: query } },
        { sku: { contains: query } },
        { model: { contains: query } },
        { manufacturer: { contains: query } },
        { notes: { contains: query } },
      ];
    }

    if (category) where.category = category;
    if (subcategory) where.subcategory = subcategory;
    if (componentType) where.componentType = componentType;
    if (manufacturer) where.manufacturer = manufacturer;
    if (supplier) where.supplier = supplier;
    if (ownershipType) where.ownershipType = ownershipType;
    if (condition) where.condition = condition;
    if (storageLocation) where.storageLocation = storageLocation;

    // Dynamic sorting
    const allowedSortFields: Record<string, string> = {
      name: 'name',
      sku: 'sku',
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      quantityAvailable: 'quantityAvailable',
      quantityOwned: 'quantityOwned',
      unitCost: 'unitCost',
    };
    const resolvedSortField = allowedSortFields[sortField] || 'updatedAt';

    const [total, components] = await Promise.all([
      prisma.component.count({ where }),
      prisma.component.findMany({
        where,
        orderBy: { [resolvedSortField]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          specifications: true,
        },
      }),
    ]);

    return NextResponse.json({
      components,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('GET /api/components error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve inventory items.' },
      { status: 500 }
    );
  }
}

// POST /api/components - Create component in user's private inventory
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const body = await request.json();

    if (!body.name || !String(body.name).trim()) {
      return NextResponse.json(
        { error: 'Component name is required.' },
        { status: 400 }
      );
    }

    // Auto-generate or sanitize SKU
    let sku = body.sku ? String(body.sku).trim() : null;
    if (!sku) {
      const count = await prisma.component.count({ where: { userId: user.id } });
      sku = `COMP-${String(count + 1).padStart(3, '0')}`;
    }

    // Verify SKU uniqueness for this specific user
    const existing = await prisma.component.findFirst({
      where: {
        userId: user.id,
        sku,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Component SKU "${sku}" already exists in your inventory.` },
        { status: 409 }
      );
    }

    const totalQty = parseInt(body.quantityTotal ?? body.quantityOwned ?? 1, 10) || 0;
    const hereQty = parseInt(body.quantityHere ?? body.quantityAvailable ?? totalQty, 10) || 0;
    const unitPrice = parseFloat(body.unitPrice ?? body.unitCost ?? 0) || 0;

    const component = await prisma.$transaction(async (tx) => {
      const created = await tx.component.create({
        data: {
          userId: user.id,
          sku,
          name: String(body.name).trim(),
          description: body.description ? String(body.description).trim() : null,
          category: body.category || 'General',
          subcategory: body.subcategory || null,
          componentType: body.componentType || null,
          manufacturer: body.manufacturer ? String(body.manufacturer).trim() : null,
          mpn: body.mpn ? String(body.mpn).trim() : null,
          model: body.model ? String(body.model).trim() : null,
          imageUrl: body.imageUrl || null,
          datasheetUrl: body.datasheetUrl || null,
          quantityOwned: totalQty,
          quantityAvailable: hereQty,
          unitOfMeasurement: body.unit || body.unitOfMeasurement || 'Piece',
          condition: body.condition || 'New',
          unitCost: unitPrice,
          currency: body.currency || 'INR',
          supplier: body.supplier || null,
          storageLocation: body.storageDescription || body.storageLocation || null,
          ownershipType: body.ownership || body.ownershipType || 'Mine',
          borrowedFrom: body.borrowedFrom || null,
          borrowingDate: body.borrowingDate ? new Date(body.borrowingDate) : null,
          lentTo: body.lentTo || null,
          lendingDate: body.lendingDate ? new Date(body.lendingDate) : null,
          notes: body.generalNotes || body.notes || null,
          protocols: Array.isArray(body.protocols) ? JSON.stringify(body.protocols) : null,
        },
      });

      // Log initial stock creation transaction
      await tx.inventoryTransaction.create({
        data: {
          userId: user.id,
          componentId: created.id,
          transactionType: 'INITIAL',
          quantity: totalQty,
          previousQty: 0,
          resultingQty: totalQty,
          notes: 'Initial inventory intake',
        },
      });

      return created;
    });

    return NextResponse.json({ component }, { status: 201 });
  } catch (error) {
    console.error('POST /api/components error:', error);
    return NextResponse.json(
      { error: 'Failed to create component.' },
      { status: 500 }
    );
  }
}
