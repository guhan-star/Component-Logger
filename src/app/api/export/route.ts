import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import Papa from 'papaparse';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const format = searchParams.get('format') || 'json';

    const components = await prisma.component.findMany({
      include: {
        category: { select: { name: true } },
        manufacturer: { select: { name: true } },
        supplier: { select: { name: true } },
        tags: { include: { tag: true } },
        specifications: true,
      },
      orderBy: { name: 'asc' },
    });

    if (format === 'csv') {
      const flatData = components.map((c) => ({
        ID: c.id,
        Name: c.name,
        Description: c.description || '',
        Category: c.category?.name || '',
        Subcategory: c.subcategory || '',
        Manufacturer: c.manufacturer?.name || '',
        MPN: c.mpn || '',
        GenericPartNumber: c.genericPartNumber || '',
        QuantityOwned: c.quantityOwned,
        QuantityAvailable: c.quantityAvailable,
        QuantityReserved: c.quantityReserved,
        QuantityInUse: c.quantityInUse,
        QuantityLentOut: c.quantityLentOut,
        QuantityBorrowed: c.quantityBorrowed,
        Condition: c.condition,
        UnitOfMeasurement: c.unitOfMeasurement,
        OwnershipType: c.ownershipType,
        AcquisitionDate: c.acquisitionDate ? c.acquisitionDate.toISOString() : '',
        AcquisitionMethod: c.acquisitionMethod || '',
        UnitCost: c.unitCost ?? '',
        Currency: c.currency,
        Supplier: c.supplier?.name || '',
        StorageLocation: c.storageLocation || '',
        MinimumStock: c.minimumStock ?? '',
        Tags: c.tags.map((t) => t.tag.name).join('; '),
        Notes: c.notes || '',
        DatasheetURL: c.datasheetUrl || '',
      }));

      const csv = Papa.unparse(flatData);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="inventory-export-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json(components, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="inventory-export-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    console.error('GET /api/export error:', error);
    return NextResponse.json({ error: 'Failed to export components' }, { status: 500 });
  }
}
