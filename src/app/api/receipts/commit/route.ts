import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { z } from 'zod';

const receiptLineSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'Component name is required').max(150),
  sku: z.string().trim().max(60).optional(),
  category: z.string().trim().default('General'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
  unitOfMeasurement: z.string().trim().default('Piece'),
  condition: z.string().trim().default('New'),
  storageLocation: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

const commitReceiptSchema = z.object({
  supplier: z.string().trim().max(100).optional(),
  invoiceNumber: z.string().trim().max(100).optional(),
  purchaseDate: z.string().optional(),
  receiptStoragePath: z.string().optional(),
  lines: z.array(receiptLineSchema).min(1, 'At least one valid line item is required'),
});

// POST /api/receipts/commit - Atomic commit of validated receipt line items
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const body = await request.json();
    const parsed = commitReceiptSchema.safeParse(body);

    if (!parsed.success) {
      const err = parsed.error.issues[0]?.message || 'Invalid receipt data';
      return NextResponse.json({ error: err }, { status: 400 });
    }

    const { supplier, invoiceNumber, purchaseDate, lines } = parsed.data;
    const parsedDate = purchaseDate ? new Date(purchaseDate) : new Date();

    // Prevent duplicate invoice re-commits if invoiceNumber provided
    if (invoiceNumber) {
      const existingMatch = await prisma.component.findFirst({
        where: {
          userId: user.id,
          supplier: supplier || undefined,
          notes: { contains: `Invoice: ${invoiceNumber}` },
        },
      });

      if (existingMatch) {
        return NextResponse.json(
          {
            error: `Invoice "${invoiceNumber}" from supplier "${supplier || 'vendor'}" has already been committed to your inventory to prevent double-counting.`,
          },
          { status: 409 }
        );
      }
    }

    // Atomic transaction: commit all line items and generate audit records
    const createdComponents = await prisma.$transaction(async (tx) => {
      const created: any[] = [];

      for (const line of lines) {
        const generatedSku = line.sku || `COMP-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
        const invoiceNote = invoiceNumber ? `Invoice: ${invoiceNumber}` : 'Direct Receipt';
        const notesStr = [
          `Procured via ${supplier || 'Vendor'} (${invoiceNote}) on ${parsedDate.toISOString().split('T')[0]}`,
          line.notes,
        ]
          .filter(Boolean)
          .join(' | ');

        const comp = await tx.component.create({
          data: {
            userId: user.id,
            name: line.name,
            sku: generatedSku,
            mpn: line.sku || null,
            genericPartNumber: line.sku || null,
            category: line.category || 'General',
            quantityOwned: line.quantity,
            quantityAvailable: line.quantity,
            unitCost: line.unitPrice,
            currency: 'INR',
            unitOfMeasurement: line.unitOfMeasurement || 'Piece',
            condition: line.condition || 'New',
            ownershipType: 'Mine',
            supplier: supplier || null,
            purchaseDate: parsedDate,
            storageLocation: line.storageLocation || null,
            notes: notesStr,
          },
        });

        await tx.inventoryTransaction.create({
          data: {
            userId: user.id,
            componentId: comp.id,
            transactionType: 'ADD',
            quantity: line.quantity,
            previousQty: 0,
            resultingQty: line.quantity,
            notes: `Receipt Staging Commit: Procured from ${supplier || 'Vendor'} (${invoiceNote})`,
          },
        });

        created.push(comp);
      }

      return created;
    });

    return NextResponse.json(
      {
        success: true,
        message: `Successfully committed ${createdComponents.length} component line item(s) to inventory.`,
        count: createdComponents.length,
        components: createdComponents,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('POST /api/receipts/commit error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to atomically commit receipt line items.' },
      { status: 500 }
    );
  }
}
