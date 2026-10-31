'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShoppingCart,
  Plus,
  ExternalLink,
  CheckCircle2,
  PackageCheck,
  AlertCircle,
  Trash2,
  Clock,
  IndianRupee,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';

interface PurchaseItem {
  id: string;
  componentId?: string | null;
  componentName: string;
  quantity: number;
  estimatedCost?: number | null;
  currency: string;
  supplierId?: string | null;
  supplierUrl?: string | null;
  priority: string;
  status: string;
  notes?: string | null;
  orderedDate?: string | null;
  receivedDate?: string | null;
  createdAt: string;
  component?: { id: string; name: string; quantityAvailable: number } | null;
  supplier?: { id: string; name: string } | null;
}

export default function PurchaseListPage() {
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form
  const [form, setForm] = useState({
    componentName: '',
    quantity: 1,
    estimatedCost: '',
    currency: 'INR',
    supplierId: '',
    supplierUrl: '',
    priority: 'Normal',
    notes: '',
  });

  const loadItems = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/purchase-items').then((res) => res.json()),
      fetch('/api/suppliers').then((res) => res.json()),
    ])
      .then(([itemRes, suppRes]) => {
        setItems(itemRes.data || []);
        setSuppliers(suppRes.data || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/purchase-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          quantity: Number(form.quantity),
          estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : null,
          supplierId: form.supplierId || null,
        }),
      });

      if (res.ok) {
        setIsAddOpen(false);
        setForm({
          componentName: '',
          quantity: 1,
          estimatedCost: '',
          currency: 'INR',
          supplierId: '',
          supplierUrl: '',
          priority: 'Normal',
          notes: '',
        });
        loadItems();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to add item');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (id: string, status: string, componentId?: string | null, quantity?: number) => {
    try {
      const payload: Record<string, unknown> = { status };
      if (status === 'Ordered') payload.orderedDate = new Date().toISOString();
      if (status === 'Received') payload.receivedDate = new Date().toISOString();

      const res = await fetch(`/api/purchase-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        // If received and associated with an existing component, prompt to add stock!
        if (status === 'Received' && componentId && quantity) {
          if (confirm(`Would you like to automatically add ${quantity} pcs to this component's stock in inventory?`)) {
            await fetch('/api/transactions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                componentId,
                transactionType: 'ADD',
                quantity,
                notes: 'Received from purchase order',
              }),
            });
          }
        }
        loadItems();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Remove this item from the purchase list?')) return;
    try {
      const res = await fetch(`/api/purchase-items/${id}`, { method: 'DELETE' });
      if (res.ok) loadItems();
    } catch (err) {
      console.error(err);
    }
  };

  const totalEstimatedCost = items
    .filter((i) => i.status === 'Needed' && i.estimatedCost)
    .reduce((sum, i) => sum + (i.estimatedCost || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-primary" />
            Purchase List & Order Pipeline
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Plan restocks, manage needed components for prototypes, and track supplier orders.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[11px] text-muted-foreground block">Needed Order Value</span>
            <span className="font-bold text-foreground text-sm">₹{totalEstimatedCost.toLocaleString()}</span>
          </div>
          <button
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Add Needed Item
          </button>
        </div>
      </div>

      {/* Items list */}
      {loading ? (
        <div className="text-center py-16">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading purchase list...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl p-8 space-y-3">
          <ShoppingCart className="w-12 h-12 text-muted-foreground/40 mx-auto" />
          <h3 className="text-base font-semibold text-foreground">Purchase list is empty</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Add items you need to restock or order for upcoming laboratory experiments and hardware builds.
          </p>
          <button
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 mt-2"
          >
            <Plus className="w-3.5 h-3.5" />
            Add First Item
          </button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b border-border text-xs uppercase font-semibold text-muted-foreground">
                <tr>
                  <th className="py-3 px-4">Component Item</th>
                  <th className="py-3 px-4">Quantity</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Supplier / Source</th>
                  <th className="py-3 px-4">Est. Cost</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-foreground">{item.componentName}</div>
                      {item.notes && <p className="text-xs text-muted-foreground mt-0.5">{item.notes}</p>}
                    </td>
                    <td className="py-3 px-4 font-bold">{item.quantity} pcs</td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          item.priority === 'Urgent'
                            ? 'destructive'
                            : item.priority === 'High'
                            ? 'warning'
                            : 'secondary'
                        }
                        size="sm"
                      >
                        {item.priority}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {item.supplier ? (
                        <div className="font-medium text-foreground">{item.supplier.name}</div>
                      ) : (
                        <span className="text-muted-foreground">Any supplier</span>
                      )}
                      {item.supplierUrl && (
                        <a
                          href={item.supplierUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-0.5"
                        >
                          View Store Link <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-foreground">
                      {item.estimatedCost ? `₹${item.estimatedCost}` : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          item.status === 'Received'
                            ? 'success'
                            : item.status === 'Ordered'
                            ? 'primary'
                            : 'secondary'
                        }
                        size="sm"
                      >
                        {item.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {item.status === 'Needed' && (
                          <button
                            onClick={() => handleUpdateStatus(item.id, 'Ordered')}
                            className="px-2.5 py-1 text-xs font-medium rounded-lg border border-border hover:bg-muted"
                          >
                            Mark Ordered
                          </button>
                        )}
                        {item.status === 'Ordered' && (
                          <button
                            onClick={() => handleUpdateStatus(item.id, 'Received', item.componentId, item.quantity)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                          >
                            Mark Received
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1 rounded text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADD ITEM MODAL */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add Item to Purchase List"
        description="Record components and quantities you need to procure."
      >
        <form onSubmit={handleCreateItem} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-foreground mb-1">Item / Component Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Raspberry Pi Zero 2 W, 100uF 25V Capacitors"
              value={form.componentName}
              onChange={(e) => setForm({ ...form, componentName: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-foreground mb-1">Quantity Needed *</label>
              <input
                type="number"
                min="1"
                required
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value, 10) || 1 })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
              />
            </div>
            <div>
              <label className="block font-medium text-foreground mb-1">Estimated Cost (₹)</label>
              <input
                type="number"
                placeholder="e.g. 450"
                value={form.estimatedCost}
                onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-foreground mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
              >
                <option value="Low">Low</option>
                <option value="Normal">Normal</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-foreground mb-1">Preferred Supplier</label>
              <select
                value={form.supplierId}
                onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
              >
                <option value="">Any / None</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-medium text-foreground mb-1">Store / Product URL</label>
            <input
              type="url"
              placeholder="https://..."
              value={form.supplierUrl}
              onChange={(e) => setForm({ ...form, supplierUrl: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
            />
          </div>

          <div>
            <label className="block font-medium text-foreground mb-1">Notes / Requirement</label>
            <input
              type="text"
              placeholder="e.g. For weather station power supply"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="px-4 py-2 border border-border rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90"
            >
              Add to List
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
