import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import Papa from 'papaparse';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let items: Array<Record<string, unknown>> = [];

    if (contentType.includes('application/json')) {
      items = await request.json();
    } else {
      const text = await request.text();
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      items = parsed.data as Array<Record<string, unknown>>;
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items found to import' }, { status: 400 });
    }

    let importedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const name = String(item.name || item.Name || '').trim();
      if (!name) {
        errors.push(`Row ${i + 1}: Name is required`);
        continue;
      }

      try {
        // Resolve Category if present
        let categoryId: string | null = null;
        const categoryName = String(item.category || item.Category || '').trim();
        if (categoryName) {
          const cat = await prisma.category.upsert({
            where: { name: categoryName },
            update: {},
            create: { name: categoryName },
          });
          categoryId = cat.id;
        }

        // Resolve Manufacturer if present
        let manufacturerId: string | null = null;
        const mfgName = String(item.manufacturer || item.Manufacturer || '').trim();
        if (mfgName) {
          const mfg = await prisma.manufacturer.upsert({
            where: { name: mfgName },
            update: {},
            create: { name: mfgName },
          });
          manufacturerId = mfg.id;
        }

        // Resolve Supplier if present
        let supplierId: string | null = null;
        const suppName = String(item.supplier || item.Supplier || '').trim();
        if (suppName) {
          const supp = await prisma.supplier.upsert({
            where: { name: suppName },
            update: {},
            create: { name: suppName },
          });
          supplierId = supp.id;
        }

        const qty = parseInt(String(item.quantityOwned || item.QuantityOwned || item.quantity || 0), 10) || 0;
        const unitCost = parseFloat(String(item.unitCost || item.UnitCost || '')) || null;

        await prisma.component.create({
          data: {
            name,
            description: (item.description || item.Description || null) as string | null,
            categoryId,
            subcategory: (item.subcategory || item.Subcategory || null) as string | null,
            manufacturerId,
            supplierId,
            mpn: (item.mpn || item.MPN || null) as string | null,
            genericPartNumber: (item.genericPartNumber || item.GenericPartNumber || null) as string | null,
            quantityOwned: qty,
            quantityAvailable: qty,
            condition: (item.condition || item.Condition || 'New') as string,
            unitOfMeasurement: (item.unitOfMeasurement || item.UnitOfMeasurement || 'pcs') as string,
            ownershipType: (item.ownershipType || item.OwnershipType || 'Personal') as string,
            storageLocation: (item.storageLocation || item.StorageLocation || null) as string | null,
            unitCost,
            currency: String(item.currency || item.Currency || 'INR'),
            notes: (item.notes || item.Notes || null) as string | null,
            datasheetUrl: (item.datasheetUrl || item.DatasheetURL || null) as string | null,
          },
        });

        importedCount++;
      } catch (err) {
        errors.push(`Row ${i + 1} (${name}): ${err instanceof Error ? err.message : 'Failed to import'}`);
      }
    }

    return NextResponse.json({
      success: true,
      importedCount,
      failedCount: errors.length,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    console.error('POST /api/import error:', error);
    return NextResponse.json({ error: 'Failed to process import file' }, { status: 500 });
  }
}
