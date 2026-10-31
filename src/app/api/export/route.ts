import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import Papa from 'papaparse';

/**
 * Sanitizes spreadsheet formula injection (CSV/Excel)
 * Values starting with =, +, -, @, tab, or carriage return are escaped with a leading single quote.
 */
function sanitizeForSpreadsheet(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.response;
  const user = auth.user;

  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';

    // Strictly scope export to authenticated user's inventory
    const components = await prisma.component.findMany({
      where: {
        userId: user.id,
      },
      orderBy: { name: 'asc' },
    });

    if (format === 'csv') {
      const flatData = components.map((c) => ({
        SKU: sanitizeForSpreadsheet(c.sku),
        Name: sanitizeForSpreadsheet(c.name),
        Category: sanitizeForSpreadsheet(c.category),
        Subcategory: sanitizeForSpreadsheet(c.subcategory),
        Manufacturer: sanitizeForSpreadsheet(c.manufacturer),
        MPN: sanitizeForSpreadsheet(c.mpn),
        Model: sanitizeForSpreadsheet(c.model),
        ComponentType: sanitizeForSpreadsheet(c.componentType),
        Description: sanitizeForSpreadsheet(c.description),
        QuantityOwned: c.quantityOwned,
        QuantityAvailable: c.quantityAvailable,
        QuantityReserved: c.quantityReserved,
        QuantityInUse: c.quantityInUse,
        QuantityLentOut: c.quantityLentOut,
        QuantityBorrowed: c.quantityBorrowed,
        UnitOfMeasurement: sanitizeForSpreadsheet(c.unitOfMeasurement),
        Condition: sanitizeForSpreadsheet(c.condition),
        OwnershipType: sanitizeForSpreadsheet(c.ownershipType),
        StorageLocation: sanitizeForSpreadsheet(c.storageLocation),
        Supplier: sanitizeForSpreadsheet(c.supplier),
        UnitCost: c.unitCost !== null ? c.unitCost : '',
        PurchaseDate: c.purchaseDate ? c.purchaseDate.toISOString().split('T')[0] : '',
        Notes: sanitizeForSpreadsheet(c.notes),
        DatasheetURL: sanitizeForSpreadsheet(c.datasheetUrl),
      }));

      const csv = Papa.unparse(flatData);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="stark-inventory-${user.username}-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // JSON export
    return NextResponse.json(
      {
        exportedAt: new Date().toISOString(),
        operator: user.username,
        count: components.length,
        components,
      },
      {
        headers: {
          'Content-Disposition': `attachment; filename="stark-inventory-${user.username}-${new Date().toISOString().split('T')[0]}.json"`,
        },
      }
    );
  } catch (error) {
    console.error('GET /api/export error:', error);
    return NextResponse.json({ error: 'Failed to export inventory records.' }, { status: 500 });
  }
}
