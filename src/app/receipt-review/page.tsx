'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Receipt, Plus, Trash2, CheckCircle2 } from 'lucide-react';

interface ReceiptLine {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export default function ReceiptReviewPage() {
  const router = useRouter();

  const [supplier, setSupplier] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);

  const [lines, setLines] = useState<ReceiptLine[]>([]);

  const handleAddLine = () => {
    setLines([
      ...lines,
      {
        id: String(Date.now()),
        sku: `COMP-${String(Date.now()).slice(-3)}`,
        name: '',
        quantity: 1,
        unitPrice: 0,
      },
    ]);
  };

  const handleRemoveLine = (id: string) => {
    setLines(lines.filter((l) => l.id !== id));
  };

  const handleLineChange = (id: string, field: keyof ReceiptLine, value: any) => {
    setLines(
      lines.map((line) => (line.id === id ? { ...line, [field]: value } : line))
    );
  };

  const handleCommit = async () => {
    const validLines = lines.filter((l) => l.name.trim());
    if (validLines.length === 0) {
      alert('Please enter at least one line item with a name.');
      return;
    }

    try {
      for (const line of validLines) {
        await fetch('/api/components', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: line.name,
            mpn: line.sku,
            genericPartNumber: line.sku,
            quantityOwned: Number(line.quantity) || 1,
            quantityAvailable: Number(line.quantity) || 1,
            unitCost: Number(line.unitPrice) || 0,
            unitOfMeasurement: 'Piece',
            condition: 'New',
            ownershipType: 'Personal',
            notes: `Purchased via ${supplier} (Invoice: ${invoiceNumber}) on ${purchaseDate}`,
          }),
        });
      }

      alert(`Successfully committed ${validLines.length} component line(s) to inventory!`);
      router.push('/components');
    } catch (err) {
      console.error(err);
      alert('Failed to commit line items');
    }
  };

  return (
    <div className="space-y-4 text-xs">
      <div>
        <div className="brand">ASSISTED DATA ENTRY</div>
        <h1 className="text-xl font-bold tracking-tight text-[var(--text)] mt-0.5">
          Receipt & invoice line item review
        </h1>
        <p className="text-xs text-[var(--muted)] mt-0.5">
          Review-before-commit staging for hardware procurement and invoice line items.
        </p>
      </div>

      <div className="p-4 rounded bg-[var(--panel)] border border-[var(--line)] space-y-4">
        <div className="p-2.5 rounded bg-[var(--amber)]/10 border-l-2 border-[var(--amber)] text-[var(--text)] text-[11px]">
          Local review mode: verified line items are committed directly into your persistent SQLite inventory upon confirmation.
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1">
              Supplier / Distributor
            </label>
            <input
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)]"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1">
              Invoice Number
            </label>
            <input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)]"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1">
              Purchase Date
            </label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)]"
            />
          </div>
        </div>

        <div className="brand pt-2 border-b border-[var(--line)] pb-1">
          LINE ITEM REVIEW
        </div>

        <div className="space-y-2">
          {lines.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--muted)] border border-dashed border-[var(--line)] rounded">
              No line items yet. Click &quot;+ Add Line&quot; below to add items from your invoice or receipt.
            </div>
          ) : (
            lines.map((line) => (
            <div key={line.id} className="flex items-center gap-2">
              <input
                placeholder="SKU / MPN"
                value={line.sku}
                onChange={(e) => handleLineChange(line.id, 'sku', e.target.value)}
                className="w-32 px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] font-mono"
              />
              <input
                placeholder="Component Name *"
                value={line.name}
                onChange={(e) => handleLineChange(line.id, 'name', e.target.value)}
                className="flex-1 px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)]"
              />
              <input
                type="number"
                min="1"
                placeholder="Qty"
                value={line.quantity}
                onChange={(e) => handleLineChange(line.id, 'quantity', parseInt(e.target.value, 10) || 1)}
                className="w-20 px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] font-mono"
              />
              <input
                type="number"
                step="any"
                placeholder="Price (₹)"
                value={line.unitPrice}
                onChange={(e) => handleLineChange(line.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                className="w-24 px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] font-mono"
              />
              <button
                type="button"
                onClick={() => handleRemoveLine(line.id)}
                className="p-2 rounded text-[var(--red)] border border-[var(--line)] hover:bg-[var(--red)]/10"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )))}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-[var(--line)]">
          <button
            type="button"
            onClick={handleAddLine}
            className="px-3 py-1.5 rounded border border-[var(--line)] bg-[var(--panel2)] hover:border-[var(--amber)] text-[var(--text)] font-medium"
          >
            + Add Line
          </button>

          <button
            type="button"
            onClick={handleCommit}
            className="px-4 py-1.5 rounded font-bold bg-[var(--amber)] text-[#17120a] hover:bg-[#d97706]"
          >
            Commit Reviewed Lines
          </button>
        </div>
      </div>
    </div>
  );
}
