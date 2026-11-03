'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Receipt,
  Plus,
  Trash2,
  CheckCircle2,
  Upload,
  FileText,
  Image as ImageIcon,
  X,
  AlertTriangle,
  Info,
} from 'lucide-react';

interface ReceiptLine {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  condition: string;
  notes: string;
}

const CATEGORIES = [
  'General',
  'Microcontroller',
  'Sensor',
  'Power',
  'Passive',
  'Connector',
  'Semiconductor',
  'Display',
  'Communication',
  'Module',
  'Tool',
];

export default function ReceiptReviewPage() {
  const router = useRouter();

  const [supplier, setSupplier] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null);
  const [receiptFileType, setReceiptFileType] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [lines, setLines] = useState<ReceiptLine[]>([
    {
      id: '1',
      sku: 'COMP-ESP32',
      name: 'ESP32-WROOM-32D Development Board',
      category: 'Microcontroller',
      quantity: 2,
      unitPrice: 320,
      condition: 'New',
      notes: 'USB-C dual core dev board',
    },
    {
      id: '2',
      sku: 'COMP-BME280',
      name: 'BME280 Temperature & Humidity Sensor',
      category: 'Sensor',
      quantity: 1,
      unitPrice: 180,
      condition: 'New',
      notes: 'I2C/SPI environmental sensor',
    },
  ]);

  const handleAddLine = () => {
    setLines([
      ...lines,
      {
        id: String(Date.now()),
        sku: `COMP-${String(Date.now()).slice(-4)}`,
        name: '',
        category: 'General',
        quantity: 1,
        unitPrice: 0,
        condition: 'New',
        notes: '',
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
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size: max 10MB
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setUploadError('File size exceeds the 10 MB limit. Please select a smaller file.');
      return;
    }

    // Validate MIME types: JPEG, PNG, WebP, PDF
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!ALLOWED.includes(file.type.toLowerCase())) {
      setUploadError('Unsupported format. Please upload JPEG, PNG, WebP, or PDF.');
      return;
    }

    setReceiptFileName(file.name);
    setReceiptFileType(file.type);

    const reader = new FileReader();
    reader.onload = () => {
      setReceiptImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const calculateSubtotal = () =>
    lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);

  const handleCommit = async () => {
    setSubmitError(null);
    const validLines = lines.filter((l) => l.name.trim());
    if (validLines.length === 0) {
      setSubmitError('Please enter at least one line item with a component name.');
      return;
    }

    // Check invalid quantities or negative prices
    for (const line of validLines) {
      if (line.quantity <= 0) {
        setSubmitError(`Invalid quantity for "${line.name}". Quantity must be at least 1.`);
        return;
      }
      if (line.unitPrice < 0) {
        setSubmitError(`Invalid unit price for "${line.name}". Price cannot be negative.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/receipts/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier: supplier.trim() || undefined,
          invoiceNumber: invoiceNumber.trim() || undefined,
          purchaseDate: purchaseDate || undefined,
          lines: validLines.map((l) => ({
            name: l.name.trim(),
            sku: l.sku.trim() || undefined,
            category: l.category || 'General',
            quantity: Number(l.quantity) || 1,
            unitPrice: Number(l.unitPrice) || 0,
            condition: l.condition || 'New',
            notes: l.notes.trim() || undefined,
          })),
        }),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Failed to atomically commit receipt line items.');
      }

      alert(`✅ Success: ${resData.count} component(s) committed to your inventory.`);
      router.push('/components');
    } catch (err: any) {
      console.error('Receipt commit error:', err);
      setSubmitError(err.message || 'Failed to commit receipt line items.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 text-xs pb-12">
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
        {/* Transparent Extraction Notice */}
        <div className="p-3 rounded-lg bg-[var(--amber)]/10 border-l-2 border-[var(--amber)] text-[var(--text)] text-xs flex items-start gap-2.5">
          <Info className="w-4 h-4 text-[var(--amber)] shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-[var(--amber)]">Manual Line Item Staging Mode Active</div>
            <div className="text-[11px] text-[var(--text)]/80 mt-0.5">
              Optical AI parsing provider is currently not linked. All lines are manually configured, fully editable, and validated against zero duplicate entries before atomic database commit.
            </div>
          </div>
        </div>

        {submitError && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Invoice Metadata Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
              Supplier / Vendor
            </label>
            <input
              type="text"
              placeholder="e.g. Robu.in, Mouser, DigiKey"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)] focus:border-[var(--amber)] outline-hidden"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
              Invoice / Receipt No.
            </label>
            <input
              type="text"
              placeholder="e.g. INV-2026-0418"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)] focus:border-[var(--amber)] outline-hidden"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-1">
              Purchase Date
            </label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)] focus:border-[var(--amber)] outline-hidden"
            />
          </div>
        </div>

        {/* Attachment Upload & Preview */}
        <div className="border border-dashed border-[var(--line)] rounded-xl p-4 bg-[var(--bg)]/50">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[var(--amber)]/10 text-[var(--amber)] flex items-center justify-center shrink-0">
                {receiptFileType === 'application/pdf' ? (
                  <FileText className="w-5 h-5" />
                ) : (
                  <ImageIcon className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="font-semibold text-xs text-[var(--text)]">
                  {receiptFileName || 'Attach receipt document or photo'}
                </div>
                <div className="text-[11px] text-[var(--muted)]">
                  Supported formats: JPEG, PNG, WebP, PDF (Max 10 MB)
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-[var(--panel)] border border-[var(--line)] text-xs font-semibold text-[var(--text)] hover:border-[var(--amber)] transition-colors flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                {receiptFileName ? 'Replace File' : 'Select File'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {receiptFileName && (
                <button
                  type="button"
                  onClick={() => {
                    setReceiptFileName(null);
                    setReceiptFileType(null);
                    setReceiptImage(null);
                  }}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--muted)] hover:text-red-400 transition-colors"
                  title="Remove receipt"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {uploadError && (
            <div className="mt-2 text-[11px] text-red-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {receiptImage && receiptFileType?.startsWith('image/') && (
            <div className="mt-3 pt-3 border-t border-[var(--line)] flex justify-center">
              <img
                src={receiptImage}
                alt="Receipt Preview"
                className="max-h-48 rounded-lg border border-[var(--line)] object-contain shadow-xs"
              />
            </div>
          )}
        </div>

        {/* Staged Line Items Header */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[var(--amber)]" />
            <span className="font-bold text-xs uppercase tracking-wide text-[var(--text)]">
              Staged Line Items ({lines.length})
            </span>
          </div>
          <button
            type="button"
            onClick={handleAddLine}
            className="px-3 py-1.5 rounded-lg bg-[var(--amber)]/10 text-[var(--amber)] hover:bg-[var(--amber)]/20 border border-[var(--amber)]/30 font-semibold text-xs flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Line Item
          </button>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto border border-[var(--line)] rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--bg)] border-b border-[var(--line)] uppercase text-[10px] text-[var(--muted)] font-semibold tracking-wider">
              <tr>
                <th className="py-2.5 px-3">SKU / MPN</th>
                <th className="py-2.5 px-3">Component Name *</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 w-24">Qty *</th>
                <th className="py-2.5 px-3 w-28">Unit Price (₹)</th>
                <th className="py-2.5 px-3 w-28">Total (₹)</th>
                <th className="py-2.5 px-3 w-12 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)] bg-[var(--panel)]">
              {lines.map((line) => {
                const total = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
                return (
                  <tr key={line.id} className="hover:bg-[var(--bg)]/40 transition-colors">
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={line.sku}
                        onChange={(e) => handleLineChange(line.id, 'sku', e.target.value)}
                        placeholder="SKU"
                        className="w-full px-2 py-1 bg-[var(--bg)] border border-[var(--line)] rounded text-xs text-[var(--text)] font-mono"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={line.name}
                        onChange={(e) => handleLineChange(line.id, 'name', e.target.value)}
                        placeholder="Component name required"
                        className="w-full px-2 py-1 bg-[var(--bg)] border border-[var(--line)] rounded text-xs text-[var(--text)] font-medium"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <select
                        value={line.category}
                        onChange={(e) => handleLineChange(line.id, 'category', e.target.value)}
                        className="w-full px-2 py-1 bg-[var(--bg)] border border-[var(--line)] rounded text-xs text-[var(--text)]"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={(e) =>
                          handleLineChange(line.id, 'quantity', parseInt(e.target.value, 10) || 1)
                        }
                        className="w-full px-2 py-1 bg-[var(--bg)] border border-[var(--line)] rounded text-xs text-[var(--text)] font-mono"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unitPrice}
                        onChange={(e) =>
                          handleLineChange(line.id, 'unitPrice', parseFloat(e.target.value) || 0)
                        }
                        className="w-full px-2 py-1 bg-[var(--bg)] border border-[var(--line)] rounded text-xs text-[var(--text)] font-mono"
                      />
                    </td>
                    <td className="py-2 px-3 font-mono font-semibold text-[var(--amber)]">
                      ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(line.id)}
                        className="p-1 hover:text-red-400 text-[var(--muted)] transition-colors"
                        title="Remove line"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Responsive Cards View */}
        <div className="md:hidden space-y-3">
          {lines.map((line, idx) => {
            const total = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
            return (
              <div
                key={line.id}
                className="p-3.5 rounded-xl bg-[var(--bg)] border border-[var(--line)] space-y-2.5 relative"
              >
                <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] pb-2">
                  <span className="font-bold text-[11px] text-[var(--muted)]">Line #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveLine(line.id)}
                    className="text-red-400 hover:text-red-300 p-1 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-[10px] text-[var(--muted)] uppercase font-semibold mb-1">
                    Component Name *
                  </label>
                  <input
                    type="text"
                    value={line.name}
                    onChange={(e) => handleLineChange(line.id, 'name', e.target.value)}
                    placeholder="Component name required"
                    className="w-full px-2.5 py-1.5 bg-[var(--panel)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)] font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-[var(--muted)] uppercase font-semibold mb-1">
                      SKU / MPN
                    </label>
                    <input
                      type="text"
                      value={line.sku}
                      onChange={(e) => handleLineChange(line.id, 'sku', e.target.value)}
                      placeholder="SKU"
                      className="w-full px-2.5 py-1.5 bg-[var(--panel)] border border-[var(--line)] rounded-lg text-xs font-mono text-[var(--text)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[var(--muted)] uppercase font-semibold mb-1">
                      Category
                    </label>
                    <select
                      value={line.category}
                      onChange={(e) => handleLineChange(line.id, 'category', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[var(--panel)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)]"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-[var(--muted)] uppercase font-semibold mb-1">
                      Qty
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={(e) =>
                        handleLineChange(line.id, 'quantity', parseInt(e.target.value, 10) || 1)
                      }
                      className="w-full px-2.5 py-1.5 bg-[var(--panel)] border border-[var(--line)] rounded-lg text-xs font-mono text-[var(--text)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[var(--muted)] uppercase font-semibold mb-1">
                      Unit Price (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitPrice}
                      onChange={(e) =>
                        handleLineChange(line.id, 'unitPrice', parseFloat(e.target.value) || 0)
                      }
                      className="w-full px-2.5 py-1.5 bg-[var(--panel)] border border-[var(--line)] rounded-lg text-xs font-mono text-[var(--text)]"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-1 border-t border-[var(--line)] text-xs">
                  <span className="text-[var(--muted)]">Line Total:</span>
                  <span className="font-mono font-bold text-[var(--amber)]">
                    ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Staging Summary & Commit Action */}
        <div className="pt-4 border-t border-[var(--line)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-xs">
            <span className="text-[var(--muted)]">
              Total Items: <strong className="text-[var(--text)]">{lines.length}</strong>
            </span>
            <span className="text-[var(--muted)]">
              Estimated Total: <strong className="text-[var(--amber)] text-sm font-mono font-bold">
                ₹{calculateSubtotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => router.push('/components')}
              className="w-1/2 sm:w-auto px-4 py-2 rounded-xl border border-[var(--line)] hover:bg-[var(--bg)] font-semibold text-xs text-[var(--text)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting || lines.length === 0}
              onClick={handleCommit}
              className="w-1/2 sm:w-auto px-5 py-2 rounded-xl bg-[var(--amber)] text-black font-bold text-xs hover:bg-amber-400 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSubmitting ? 'Committing...' : 'Commit to Inventory'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
