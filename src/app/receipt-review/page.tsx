'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Receipt, Plus, Trash2, CheckCircle2, Upload, FileText, Image as ImageIcon, X } from 'lucide-react';

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
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null);

  const [lines, setLines] = useState<ReceiptLine[]>([
    { id: '1', sku: 'COMP-ESP32', name: 'ESP32-WROOM-32D Development Board', quantity: 2, unitPrice: 320 },
    { id: '2', sku: 'COMP-BME280', name: 'BME280 Temperature & Humidity Sensor', quantity: 1, unitPrice: 180 },
  ]);

  const handleAddLine = () => {
    setLines([
      ...lines,
      {
        id: String(Date.now()),
        sku: `COMP-${String(Date.now()).slice(-4)}`,
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setReceiptFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setReceiptImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const calculateSubtotal = () =>
    lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);

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
            ownershipType: 'Mine',
            supplier: supplier || null,
            purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
            notes: `Procured via ${supplier || 'Vendor'} (Invoice: ${invoiceNumber || 'N/A'}) on ${purchaseDate}`,
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
        <div className="brand text-[10px] sm:text-xs">ASSISTED DATA ENTRY</div>
        <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-[var(--text)] mt-0.5">
          Receipt & invoice line item review
        </h1>
        <p className="text-xs text-[var(--muted)] mt-0.5">
          Review-before-commit staging for hardware procurement and invoice line items.
        </p>
      </div>

      <div className="p-4 rounded-xl bg-[var(--panel)] border border-[var(--line)] space-y-4">
        <div className="p-3 rounded-lg bg-[var(--amber)]/10 border-l-2 border-[var(--amber)] text-[var(--text)] text-xs flex items-center justify-between gap-2">
          <span>
            <strong>Stark Assisted Data Entry:</strong> Review all parsed or entered lines before committing. Nothing is committed to your permanent inventory until you confirm.
          </span>
        </div>

        {/* Receipt Attachment & Metadata Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* File Upload Dropzone */}
          <div className="lg:col-span-1 border border-dashed border-[var(--line)] rounded-xl p-4 flex flex-col items-center justify-center text-center bg-[var(--panel2)]/40 relative">
            {receiptImage ? (
              <div className="space-y-2 w-full">
                <div className="relative max-h-48 overflow-hidden rounded-lg border border-[var(--line)] bg-black/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={receiptImage} alt="Receipt preview" className="w-full h-auto object-contain mx-auto" />
                  <button
                    onClick={() => { setReceiptImage(null); setReceiptFileName(null); }}
                    className="absolute top-2 right-2 p-1 rounded-full bg-black/70 text-white hover:bg-black"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-[11px] font-mono text-[var(--muted)] truncate">
                  {receiptFileName}
                </div>
              </div>
            ) : (
              <label className="cursor-pointer flex flex-col items-center gap-2 py-4">
                <div className="w-10 h-10 rounded-full bg-[var(--amber)]/10 border border-[var(--amber)]/30 flex items-center justify-center text-[var(--amber)]">
                  <Upload className="w-5 h-5" />
                </div>
                <span className="font-semibold text-xs text-[var(--text)]">Upload invoice or receipt</span>
                <span className="text-[10px] text-[var(--muted)]">JPEG, PNG, WebP or PDF (Max 10MB)</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Invoice Metadata */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1">
                Supplier / Distributor
              </label>
              <input
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="e.g. Mouser, DigiKey, Robu.in"
                className="w-full px-2.5 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-[var(--text)]"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1">
                Invoice Number
              </label>
              <input
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="e.g. INV-2026-9041"
                className="w-full px-2.5 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-[var(--text)]"
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
                className="w-full px-2.5 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-[var(--text)]"
              />
            </div>
          </div>
        </div>

        {/* Line Items Section Header */}
        <div className="flex items-center justify-between pt-2 border-b border-[var(--line)] pb-2">
          <span className="brand text-[10px] sm:text-xs">
            LINE ITEMS STAGING ({lines.length})
          </span>
          <span className="font-mono font-bold text-xs text-[var(--amber)]">
            Subtotal: ₹{calculateSubtotal().toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Lines Container (Responsive: Cards on mobile, row table on desktop) */}
        <div className="space-y-2.5">
          {lines.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--muted)] border border-dashed border-[var(--line)] rounded-xl">
              No line items yet. Click &quot;+ Add Line Item&quot; below to add items from your invoice.
            </div>
          ) : (
            lines.map((line) => (
              <div
                key={line.id}
                className="p-3 sm:p-2 rounded-xl border border-[var(--line)] bg-[var(--panel2)]/60 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
              >
                <div className="w-full sm:w-36">
                  <label className="block sm:hidden text-[9px] uppercase font-bold text-[var(--muted)] mb-0.5">
                    SKU / Part Number
                  </label>
                  <input
                    placeholder="SKU / Part #"
                    value={line.sku}
                    onChange={(e) => handleLineChange(line.id, 'sku', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-[var(--text)] font-mono text-xs"
                  />
                </div>

                <div className="flex-1">
                  <label className="block sm:hidden text-[9px] uppercase font-bold text-[var(--muted)] mb-0.5">
                    Component Name *
                  </label>
                  <input
                    placeholder="Component Name *"
                    value={line.name}
                    onChange={(e) => handleLineChange(line.id, 'name', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-[var(--text)] text-xs font-semibold"
                  />
                </div>

                <div className="grid grid-cols-3 sm:flex sm:items-center gap-2">
                  <div>
                    <label className="block sm:hidden text-[9px] uppercase font-bold text-[var(--muted)] mb-0.5">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={line.quantity}
                      onChange={(e) =>
                        handleLineChange(line.id, 'quantity', parseInt(e.target.value, 10) || 1)
                      }
                      className="w-full sm:w-20 px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-[var(--text)] font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block sm:hidden text-[9px] uppercase font-bold text-[var(--muted)] mb-0.5">
                      Price (₹)
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="Price (₹)"
                      value={line.unitPrice}
                      onChange={(e) =>
                        handleLineChange(line.id, 'unitPrice', parseFloat(e.target.value) || 0)
                      }
                      className="w-full sm:w-24 px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-[var(--text)] font-mono text-xs"
                    />
                  </div>

                  <div className="flex items-end sm:items-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(line.id)}
                      className="w-full sm:w-auto h-9 sm:h-auto p-2 rounded-lg text-[var(--red)] border border-rose-500/30 hover:bg-rose-500/10 flex items-center justify-center transition-colors"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-[var(--line)] gap-2">
          <button
            type="button"
            onClick={handleAddLine}
            className="h-10 px-4 rounded-lg border border-[var(--line)] bg-[var(--panel2)] hover:border-[var(--amber)] text-[var(--text)] font-semibold transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Line Item</span>
          </button>

          <button
            type="button"
            onClick={handleCommit}
            className="h-10 px-5 rounded-lg font-bold bg-[var(--amber)] text-[#17120a] hover:bg-[#d97706] transition-all active:scale-95 shadow-sm flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Commit to Inventory</span>
          </button>
        </div>
      </div>
    </div>
  );
}
