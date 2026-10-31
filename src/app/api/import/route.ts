import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import Papa from 'papaparse';

function cleanInputString(val: any): string | null {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (!str) return null;
  // Strip dangerous leading formula triggers if present
  if (/^[=+\-@\t\r]/.test(str)) {
    return str.substring(1).trim() || null;
  }
  return str;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.response;
  const user = auth.user;

  try {
    const contentType = request.headers.get('content-type') || '';
    let items: Array<Record<string, unknown>> = [];

    if (contentType.includes('application/json')) {
      const body = await request.json();
      items = Array.isArray(body) ? body : (body.items || body.components || []);
    } else {
      const text = await request.text();
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      items = parsed.data as Array<Record<string, unknown>>;
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No component rows found to import.' }, { status: 400 });
    }

    let importedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const name = cleanInputString(item.name || item.Name);
      if (!name) {
        errors.push(`Row ${i + 1}: Component name is required.`);
        continue;
      }

      try {
        const qty = Math.max(0, parseInt(String(item.quantityOwned || item.QuantityOwned || item.quantityOnHand || item.quantity || 0), 10) || 0);
        const unitCost = parseFloat(String(item.unitCost || item.UnitCost || item.purchasePrice || '')) || null;

        // Auto-generate unique SKU scoped to user if not provided
        let sku = cleanInputString(item.sku || item.SKU);
        if (!sku) {
          sku = `SKU-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        }

        await prisma.component.create({
          data: {
            userId: user.id, // Strictly scoped to authenticated user
            sku,
            name,
            category: cleanInputString(item.category || item.Category) || 'General',
            subcategory: cleanInputString(item.subcategory || item.Subcategory),
            manufacturer: cleanInputString(item.manufacturer || item.Manufacturer),
            mpn: cleanInputString(item.mpn || item.MPN),
            model: cleanInputString(item.model || item.Model),
            componentType: cleanInputString(item.componentType || item.ComponentType || item.packageType),
            description: cleanInputString(item.description || item.Description),
            quantityOwned: qty,
            quantityAvailable: qty,
            quantityReserved: 0,
            quantityInUse: 0,
            quantityLentOut: 0,
            quantityBorrowed: 0,
            unitOfMeasurement: cleanInputString(item.unitOfMeasurement || item.UnitOfMeasurement) || 'Piece',
            condition: cleanInputString(item.condition || item.Condition) || 'New',
            ownershipType: cleanInputString(item.ownershipType || item.OwnershipType) || 'Mine',
            storageLocation: cleanInputString(item.storageLocation || item.StorageLocation),
            supplier: cleanInputString(item.supplier || item.Supplier),
            unitCost,
            notes: cleanInputString(item.notes || item.Notes),
            datasheetUrl: cleanInputString(item.datasheetUrl || item.DatasheetURL),
          },
        });

        importedCount++;
      } catch (err: any) {
        errors.push(`Row ${i + 1} (${name}): ${err.message || 'Import failed.'}`);
      }
    }

    return NextResponse.json({
      success: true,
      importedCount,
      totalRows: items.length,
      errors: errors.slice(0, 20), // Show up to first 20 errors
    });
  } catch (error) {
    console.error('POST /api/import error:', error);
    return NextResponse.json({ error: 'Failed to process import file.' }, { status: 500 });
  }
}
