'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Boxes,
  ArrowLeft,
  QrCode,
  Edit2,
  Trash2,
  ExternalLink,
  MapPin,
  Clock,
  ArrowUpDown,
  Tag,
  Cpu,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import QRCode from 'qrcode';

interface ComponentDetail {
  id: string;
  name: string;
  description?: string | null;
  categoryId?: string | null;
  subcategory?: string | null;
  manufacturerId?: string | null;
  supplierId?: string | null;
  mpn?: string | null;
  genericPartNumber?: string | null;
  quantityOwned: number;
  quantityAvailable: number;
  quantityReserved: number;
  quantityInUse: number;
  quantityLentOut: number;
  quantityBorrowed: number;
  condition: string;
  unitOfMeasurement: string;
  ownershipType: string;
  unitCost?: number | null;
  currency: string;
  storageLocation?: string | null;
  minimumStock?: number | null;
  datasheetUrl?: string | null;
  pinoutUrl?: string | null;
  schematicUrl?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  category?: { id: string; name: string } | null;
  manufacturer?: { id: string; name: string; website?: string | null } | null;
  supplier?: { id: string; name: string; website?: string | null } | null;
  tags?: Array<{ tag: { id: string; name: string; color?: string | null } }>;
  specifications?: Array<{ id: string; fieldName: string; textValue?: string | null; numericValue?: number | null; unit?: string | null }>;
  transactions?: Array<{
    id: string;
    transactionType: string;
    quantity: number;
    notes?: string | null;
    createdAt: string;
    relatedPerson?: { id: string; name: string } | null;
  }>;
}

function ComponentDetailContent({ id }: { id: string }) {
  const router = useRouter();

  const [item, setItem] = useState<ComponentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Stock Adjustment
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [stockDelta, setStockDelta] = useState(1);
  const [stockTxType, setStockTxType] = useState('ADD');
  const [stockTxNotes, setStockTxNotes] = useState('');

  const loadComponent = () => {
    fetch(`/api/components/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then((data) => {
        setItem(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadComponent();
  }, [id]);

  useEffect(() => {
    if (item && qrOpen) {
      const payload = JSON.stringify({
        id: item.id,
        name: item.name,
        mpn: item.mpn || '',
        location: item.storageLocation || '',
      });
      QRCode.toDataURL(payload, { width: 256, margin: 2 })
        .then(setQrDataUrl)
        .catch(console.error);
    }
  }, [item, qrOpen]);

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          componentId: id,
          transactionType: stockTxType,
          quantity: Math.max(1, stockDelta),
          notes: stockTxNotes,
        }),
      });
      if (res.ok) {
        setAdjustOpen(false);
        setStockTxNotes('');
        loadComponent();
      } else {
        const err = await res.json();
        alert(err.error || 'Adjustment failed');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to permanently delete this component?')) return;
    try {
      const res = await fetch(`/api/components/${id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/components');
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Loading component specs...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="text-center py-20 space-y-3">
        <h2 className="text-lg font-bold text-foreground">Component Not Found</h2>
        <Link href="/components" className="text-primary hover:underline text-sm">
          Return to Components List
        </Link>
      </div>
    );
  }

  const isLowStock = item.quantityAvailable <= (item.minimumStock ?? 5);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top back & actions bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link
          href="/components"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Inventory
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setQrOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted text-xs font-medium"
          >
            <QrCode className="w-3.5 h-3.5" />
            QR Label
          </button>
          <button
            onClick={() => setAdjustOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            Adjust Stock
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 text-xs"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Info Card */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={item.ownershipType === 'Borrowed' ? 'warning' : 'primary'}>
                  {item.ownershipType} Item
                </Badge>
                <Badge variant="secondary">{item.condition} Condition</Badge>
                {item.category && <Badge variant="outline">{item.category.name}</Badge>}
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{item.name}</h1>
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                {item.mpn && <span>MPN: <span className="font-mono font-medium text-foreground">{item.mpn}</span></span>}
                {item.manufacturer && (
                  <span>
                    Manufacturer: <span className="font-medium text-foreground">{item.manufacturer.name}</span>
                  </span>
                )}
                {item.supplier && (
                  <span>
                    Supplier: <span className="font-medium text-foreground">{item.supplier.name}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="text-right sm:border-l sm:border-border sm:pl-6 shrink-0">
              <span className="text-xs uppercase text-muted-foreground font-semibold">Stock Status</span>
              <p className={`text-3xl font-extrabold ${isLowStock ? 'text-amber-500' : 'text-emerald-500'}`}>
                {item.quantityAvailable} <span className="text-sm font-normal text-muted-foreground">{item.unitOfMeasurement}</span>
              </p>
              {isLowStock && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-500">
                  <AlertTriangle className="w-3 h-3" /> Low Stock
                </span>
              )}
            </div>
          </div>

          {item.description && (
            <p className="text-sm text-muted-foreground leading-relaxed pt-2 border-t border-border/60">
              {item.description}
            </p>
          )}

          {/* Quick links: Datasheet etc. */}
          {(item.datasheetUrl || item.pinoutUrl || item.schematicUrl) && (
            <div className="flex items-center gap-3 pt-2 text-xs flex-wrap">
              {item.datasheetUrl && (
                <a
                  href={item.datasheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-foreground hover:bg-muted/80 font-medium"
                >
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  Datasheet
                  <ExternalLink className="w-3 h-3 text-muted-foreground" />
                </a>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quantities & Locations breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-4 text-center">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Total Owned</span>
          <p className="text-xl font-bold text-foreground mt-1">{item.quantityOwned}</p>
        </Card>
        <Card className="p-4 text-center">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Available</span>
          <p className="text-xl font-bold text-emerald-500 mt-1">{item.quantityAvailable}</p>
        </Card>
        <Card className="p-4 text-center">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Reserved</span>
          <p className="text-xl font-bold text-blue-500 mt-1">{item.quantityReserved}</p>
        </Card>
        <Card className="p-4 text-center">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">In Use</span>
          <p className="text-xl font-bold text-violet-500 mt-1">{item.quantityInUse}</p>
        </Card>
        <Card className="p-4 text-center">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Lent Out</span>
          <p className="text-xl font-bold text-amber-500 mt-1">{item.quantityLentOut}</p>
        </Card>
        <Card className="p-4 text-center">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Borrowed</span>
          <p className="text-xl font-bold text-indigo-500 mt-1">{item.quantityBorrowed}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Technical Specs Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary" />
              Technical Specifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {item.specifications && item.specifications.length > 0 ? (
              <div className="divide-y divide-border/60">
                {item.specifications.map((spec) => (
                  <div key={spec.id} className="py-2.5 flex items-center justify-between text-xs first:pt-0 last:pb-0">
                    <span className="text-muted-foreground capitalize">
                      {spec.fieldName.replace(/_/g, ' ')}
                    </span>
                    <span className="font-semibold text-foreground">
                      {spec.textValue || spec.numericValue} {spec.unit || ''}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No technical specifications entered.
              </p>
            )}

            <div className="pt-3 border-t border-border/60 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Storage Location:</span>
                <span className="font-medium text-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-primary" />
                  {item.storageLocation || 'Unassigned'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimated Unit Cost:</span>
                <span className="font-medium text-foreground">
                  {item.unitCost ? `₹${item.unitCost} ${item.currency}` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Minimum Stock Alert:</span>
                <span className="font-medium text-foreground">{item.minimumStock ?? 5} units</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Audit & Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Stock Audit History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {item.transactions && item.transactions.length > 0 ? (
              <div className="divide-y divide-border/60">
                {item.transactions.map((tx) => (
                  <div key={tx.id} className="py-2.5 flex items-center justify-between text-xs first:pt-0 last:pb-0">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" size="sm">
                          {tx.transactionType}
                        </Badge>
                        <span className="text-muted-foreground">{tx.notes || 'Transaction'}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground mt-0.5 block">
                        {new Date(tx.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <span className="font-bold text-foreground">
                      {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No past transactions recorded.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ADJUST STOCK MODAL */}
      <Modal
        isOpen={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        title={`Adjust Stock for ${item.name}`}
      >
        <form onSubmit={handleAdjustStock} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-foreground mb-1">Transaction Type</label>
            <select
              value={stockTxType}
              onChange={(e) => setStockTxType(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
            >
              <option value="ADD">Add Stock (+)</option>
              <option value="REMOVE">Remove Stock (-)</option>
              <option value="DAMAGE">Damaged / Defective (-)</option>
              <option value="CORRECTION">Manual Inventory Correction</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-foreground mb-1">Quantity</label>
            <input
              type="number"
              min="1"
              required
              value={stockDelta}
              onChange={(e) => setStockDelta(parseInt(e.target.value, 10) || 1)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
            />
          </div>

          <div>
            <label className="block font-medium text-foreground mb-1">Reason / Notes</label>
            <input
              type="text"
              placeholder="e.g. Received shipment, discarded fried component"
              value={stockTxNotes}
              onChange={(e) => setStockTxNotes(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setAdjustOpen(false)}
              className="px-4 py-2 border border-border rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg"
            >
              Save Adjustment
            </button>
          </div>
        </form>
      </Modal>

      {/* QR MODAL */}
      <Modal isOpen={qrOpen} onClose={() => setQrOpen(false)} title="Component QR Code" maxWidth="sm">
        <div className="flex flex-col items-center justify-center p-4 space-y-4">
          {qrDataUrl && (
            <div className="p-4 bg-white rounded-xl shadow-xs border border-slate-200 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR Code" className="w-48 h-48 mx-auto" />
              <p className="text-slate-900 font-bold text-xs mt-2 truncate max-w-[200px]">{item.name}</p>
              {item.storageLocation && (
                <p className="text-slate-600 text-[10px] mt-0.5">Loc: {item.storageLocation}</p>
              )}
            </div>
          )}
          <button
            onClick={() => window.print()}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-xs"
          >
            Print Label
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default function ComponentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <React.Suspense fallback={<div className="text-center py-20 text-muted-foreground text-sm">Loading component...</div>}>
      <ComponentDetailContent id={id} />
    </React.Suspense>
  );
}
