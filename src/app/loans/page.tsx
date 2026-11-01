'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  User,
  Boxes,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';

interface LoanItem {
  id: string;
  componentId: string;
  quantity: number;
  dateBorrowed?: string;
  dateLent?: string;
  expectedReturnDate?: string | null;
  actualReturnDate?: string | null;
  status: string;
  notes?: string | null;
  component: { id: string; name: string };
  borrowedFrom?: any;
  lentTo?: any;
}

interface Person {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
}

interface ComponentOption {
  id: string;
  name: string;
  quantityAvailable: number;
}

const getPersonName = (val: any): string => {
  if (!val) return '—';
  if (typeof val === 'string') return val;
  return val.name || val.email || '—';
};

function LoansContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab = tabParam === 'lent' ? 'lent' : tabParam === 'borrowed' ? 'borrowed' : 'all';

  const [activeTab, setActiveTab] = useState<'all' | 'borrowed' | 'lent'>(initialTab);
  const [borrowRecords, setBorrowRecords] = useState<LoanItem[]>([]);
  const [lendRecords, setLendRecords] = useState<LoanItem[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [components, setComponents] = useState<ComponentOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
  const [isLendModalOpen, setIsLendModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returningRecord, setReturningRecord] = useState<{ id: string; type: 'borrow' | 'lend'; name: string } | null>(null);
  const [returnNotes, setReturnNotes] = useState('');

  // Form states
  const [borrowForm, setBorrowForm] = useState({
    componentId: '',
    borrowedFrom: '',
    quantity: 1,
    expectedReturnDate: '',
    notes: '',
  });

  const [lendForm, setLendForm] = useState({
    componentId: '',
    lentTo: '',
    quantity: 1,
    expectedReturnDate: '',
    notes: '',
  });

  // New Contact Inline Form
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonEmail, setNewPersonEmail] = useState('');
  const [newPersonPhone, setNewPersonPhone] = useState('');
  const [showAddPerson, setShowAddPerson] = useState(false);

  const combinedRecords = useMemo(() => {
    const lends = lendRecords.map((r) => ({
      ...r,
      type: 'lend' as const,
      contactName: getPersonName(r.lentTo),
      recordDate: r.dateLent || (r as any).createdAt,
    }));
    const borrows = borrowRecords.map((r) => ({
      ...r,
      type: 'borrow' as const,
      contactName: getPersonName(r.borrowedFrom),
      recordDate: r.dateBorrowed || (r as any).createdAt,
    }));
    return [...lends, ...borrows].sort((a, b) => {
      const dateA = a.recordDate ? new Date(a.recordDate).getTime() : 0;
      const dateB = b.recordDate ? new Date(b.recordDate).getTime() : 0;
      return dateB - dateA;
    });
  }, [lendRecords, borrowRecords]);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/borrow-records').then((res) => res.json()).catch(() => ({ data: [] })),
      fetch('/api/lend-records').then((res) => res.json()).catch(() => ({ data: [] })),
      fetch('/api/persons').then((res) => res.json()).catch(() => ({ data: [] })),
      fetch('/api/components?pageSize=200').then((res) => res.json()).catch(() => ({ components: [] })),
    ])
      .then(([borrows, lends, people, compList]) => {
        const rawBorrows: LoanItem[] = [...(borrows.data || borrows.records || [])];
        const rawLends: LoanItem[] = [...(lends.data || lends.records || [])];
        setPersons(people.data || people.persons || []);

        let rawComps = compList.components || compList.data || [];
        // Support guest mode or session storage fallback
        if (typeof window !== 'undefined') {
          try {
            const guest = sessionStorage.getItem('stark_guest_components');
            if (guest) {
              const parsedGuest = JSON.parse(guest);
              if (rawComps.length === 0) {
                rawComps = parsedGuest;
              } else {
                const existingIds = new Set(rawComps.map((c: any) => c.id));
                for (const g of parsedGuest) {
                  if (!existingIds.has(g.id)) rawComps.push(g);
                }
              }
            }
          } catch {}
        }

        // Bridge any inventory components listed as lent or borrowed directly into the loans rosters
        const activeLendCompIds = new Set(
          rawLends
            .filter((r) => r.status === 'Active')
            .map((r) => r.componentId || r.component?.id)
        );
        const activeBorrowCompIds = new Set(
          rawBorrows
            .filter((r) => r.status === 'Active')
            .map((r) => r.componentId || r.component?.id)
        );

        for (const c of rawComps) {
          const totalQty = c.quantityTotal ?? c.quantityOwned ?? 0;
          const hereQty = c.quantityAvailable ?? c.quantityHere ?? totalQty;
          const isLent =
            c.currentStatus === 'Lent Out' ||
            c.quantityLentOut > 0 ||
            c.quantityLent > 0 ||
            Boolean(c.lentTo) ||
            (totalQty > hereQty && c.ownership !== 'Borrowed' && c.ownershipType !== 'Borrowed');
          const isBorrowed =
            c.ownership === 'Borrowed' ||
            c.ownershipType === 'Borrowed' ||
            Boolean(c.borrowedFrom);

          if (isLent && !activeLendCompIds.has(c.id)) {
            const lentCount =
              c.quantityLent ||
              c.quantityLentOut ||
              Math.max(1, totalQty - hereQty);
            const recipient =
              c.lentTo ||
              (c.lendRecords && c.lendRecords[0] ? c.lendRecords[0].lentTo : '') ||
              'Friend / Teammate';
            rawLends.push({
              id: `comp-lend-${c.id}`,
              componentId: c.id,
              quantity: lentCount,
              dateLent: c.lendingDate || c.updatedAt || new Date().toISOString(),
              expectedReturnDate: c.expectedReturnDate || null,
              status: 'Active',
              notes: c.notes || c.generalNotes || 'Inventory custody loan',
              component: { id: c.id, name: c.name || c.sku || 'Component' },
              lentTo: recipient,
            });
            activeLendCompIds.add(c.id);
          }

          if (isBorrowed && !activeBorrowCompIds.has(c.id)) {
            const borrowCount = c.quantityBorrowed || totalQty || 1;
            const lender =
              c.borrowedFrom ||
              (c.borrowRecords && c.borrowRecords[0] ? c.borrowRecords[0].borrowedFrom : '') ||
              'Owner / Lab';
            rawBorrows.push({
              id: `comp-borrow-${c.id}`,
              componentId: c.id,
              quantity: borrowCount,
              dateBorrowed: c.borrowingDate || c.createdAt || new Date().toISOString(),
              expectedReturnDate: c.expectedReturnDate || null,
              status: 'Active',
              notes: c.notes || c.generalNotes || 'Inventory borrowed item',
              component: { id: c.id, name: c.name || c.sku || 'Component' },
              borrowedFrom: lender,
            });
            activeBorrowCompIds.add(c.id);
          }
        }

        setBorrowRecords(rawBorrows);
        setLendRecords(rawLends);

        setComponents(
          rawComps.map((c: any, index: number) => ({
            id: c.id,
            name: `${c.sku ? `[${c.sku}] ` : `[COMP-${String(index + 1).padStart(3, '0')}] `}${c.name}`,
            quantityAvailable: c.quantityAvailable ?? c.quantityHere ?? c.quantityOwned ?? 1,
          }))
        );
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreatePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonName.trim()) return;

    try {
      const res = await fetch('/api/persons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPersonName,
          email: newPersonEmail || null,
          phone: newPersonPhone || null,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setPersons((prev) => [...prev, created]);
        if (isBorrowModalOpen) setBorrowForm((f) => ({ ...f, borrowedFrom: created.name }));
        if (isLendModalOpen) setLendForm((f) => ({ ...f, lentTo: created.name }));
        setShowAddPerson(false);
        setNewPersonName('');
        setNewPersonEmail('');
        setNewPersonPhone('');
      } else {
        alert('Failed to add contact');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRecordBorrow = async (e: React.FormEvent) => {
    e.preventDefault();
    const lender = borrowForm.borrowedFrom.trim();
    if (!borrowForm.componentId || !lender) {
      alert('Component and Lender name are required');
      return;
    }
    try {
      const res = await fetch('/api/borrow-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          componentId: borrowForm.componentId,
          borrowedFrom: lender,
          borrowedFromId: lender,
          quantity: Number(borrowForm.quantity) || 1,
          expectedReturnDate: borrowForm.expectedReturnDate || null,
          notes: borrowForm.notes || null,
        }),
      });
      if (res.ok) {
        setIsBorrowModalOpen(false);
        setBorrowForm({ componentId: '', borrowedFrom: '', quantity: 1, expectedReturnDate: '', notes: '' });
        loadData();
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed to record borrow' }));
        alert(err.error || 'Failed to record borrow');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRecordLend = async (e: React.FormEvent) => {
    e.preventDefault();
    const recipient = lendForm.lentTo.trim();
    if (!lendForm.componentId || !recipient) {
      alert('Component and Recipient name are required');
      return;
    }
    try {
      const res = await fetch('/api/lend-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          componentId: lendForm.componentId,
          lentTo: recipient,
          lentToId: recipient,
          quantity: Number(lendForm.quantity) || 1,
          expectedReturnDate: lendForm.expectedReturnDate || null,
          notes: lendForm.notes || null,
        }),
      });
      if (res.ok) {
        setIsLendModalOpen(false);
        setLendForm({ componentId: '', lentTo: '', quantity: 1, expectedReturnDate: '', notes: '' });
        loadData();
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed to record loan' }));
        alert(err.error || 'Failed to record loan');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returningRecord) return;

    try {
      if (returningRecord.id.startsWith('comp-lend-') || returningRecord.id.startsWith('comp-borrow-')) {
        const compId = returningRecord.id.replace('comp-lend-', '').replace('comp-borrow-', '');

        if (typeof window !== 'undefined') {
          try {
            const guest = sessionStorage.getItem('stark_guest_components');
            if (guest) {
              const parsed = JSON.parse(guest);
              const updated = parsed.map((c: any) => {
                if (c.id === compId) {
                  return {
                    ...c,
                    quantityHere: c.quantityTotal || c.quantityOwned,
                    quantityLent: 0,
                    currentStatus: 'In Storage',
                    lentTo: '',
                    lendingDate: '',
                    lendRecords: [],
                  };
                }
                return c;
              });
              sessionStorage.setItem('stark_guest_components', JSON.stringify(updated));
            }
          } catch {}
        }

        await fetch(`/api/components/${compId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentStatus: 'In Storage',
            lentTo: '',
            lendingDate: '',
          }),
        }).catch(() => {});

        setIsReturnModalOpen(false);
        setReturningRecord(null);
        setReturnNotes('');
        loadData();
        return;
      }

      const endpoint =
        returningRecord.type === 'borrow'
          ? `/api/borrow-records/${returningRecord.id}/return`
          : `/api/lend-records/${returningRecord.id}/return`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: returnNotes }),
      });

      if (res.ok) {
        setIsReturnModalOpen(false);
        setReturningRecord(null);
        setReturnNotes('');
        loadData();
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed to process return' }));
        alert(err.error || 'Failed to process return');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ArrowDownLeft className="w-6 h-6 text-primary" />
            Borrow & Lending Manager
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track hardware borrowed from colleagues, lab gear lent to team members, and return statuses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsBorrowModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition-colors"
          >
            <ArrowDownLeft className="w-4 h-4" />
            Record Borrowed Item
          </button>
          <button
            onClick={() => setIsLendModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 shadow-xs transition-colors"
          >
            <ArrowUpRight className="w-4 h-4" />
            Lend Component
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'all'
              ? 'border-amber-500 text-amber-500'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Boxes className="w-4 h-4" />
          All Custody ({borrowRecords.filter((r) => r.status === 'Active').length + lendRecords.filter((r) => r.status === 'Active').length} Active)
        </button>
        <button
          onClick={() => setActiveTab('lent')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'lent'
              ? 'border-violet-500 text-violet-500'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
          Lent to Others ({lendRecords.filter((r) => r.status === 'Active').length} Active)
        </button>
        <button
          onClick={() => setActiveTab('borrowed')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'borrowed'
              ? 'border-indigo-500 text-indigo-500'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4" />
          Borrowed From Others ({borrowRecords.filter((r) => r.status === 'Active').length} Active)
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-16">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading loan records...</p>
        </div>
      ) : activeTab === 'all' ? (
        /* ALL COMBINED CUSTODY LIST */
        combinedRecords.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-xl p-8 space-y-3">
            <Boxes className="w-10 h-10 text-muted-foreground/40 mx-auto" />
            <h3 className="text-base font-semibold text-foreground">No active custody records</h3>
            <p className="text-xs text-muted-foreground">
              You currently do not have any components lent to others or borrowed from peers.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => setIsLendModalOpen(true)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-colors"
              >
                + Lend Component
              </button>
              <button
                onClick={() => setIsBorrowModalOpen(true)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
              >
                + Record Borrowed Item
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 border-b border-border text-xs uppercase font-semibold text-muted-foreground">
                  <tr>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Component</th>
                    <th className="py-3 px-4">Person / Contact</th>
                    <th className="py-3 px-4">Quantity</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {combinedRecords.map((r) => {
                    const isOverdue =
                      r.status === 'Active' &&
                      r.expectedReturnDate &&
                      new Date(r.expectedReturnDate) < new Date();

                    return (
                      <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          {r.type === 'lend' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-violet-500/15 text-violet-400 border border-violet-500/30">
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              Lent to Friend
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                              Borrowed
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-semibold text-foreground">
                          <Link href={`/components/${r.component.id}`} className="hover:text-primary">
                            {r.component.name}
                          </Link>
                          {r.notes && <p className="text-xs font-normal text-muted-foreground">{r.notes}</p>}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-foreground font-medium">
                            {r.type === 'lend' ? 'To: ' : 'From: '}
                            <span className="font-bold">{r.contactName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-bold">{r.quantity} pcs</td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {r.recordDate ? new Date(r.recordDate).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {r.expectedReturnDate ? (
                            <span className={isOverdue ? 'text-rose-500 font-bold flex items-center gap-1' : 'text-muted-foreground'}>
                              {isOverdue && <AlertTriangle className="w-3 h-3" />}
                              {new Date(r.expectedReturnDate).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">No due date</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={r.status === 'Active' ? (isOverdue ? 'destructive' : 'primary') : 'success'} size="sm">
                            {isOverdue ? 'Overdue' : r.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {r.status === 'Active' && (
                            <button
                              onClick={() => {
                                setReturningRecord({ id: r.id, type: r.type, name: r.component.name });
                                setIsReturnModalOpen(true);
                              }}
                              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                                r.type === 'lend'
                                  ? 'bg-violet-600 hover:bg-violet-700 text-white'
                                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                              }`}
                            >
                              {r.type === 'lend' ? 'Mark Returned ↺' : 'Return to Owner ↺'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : activeTab === 'borrowed' ? (
        /* BORROWED LIST */
        borrowRecords.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-xl p-8 space-y-3">
            <ArrowDownLeft className="w-10 h-10 text-muted-foreground/40 mx-auto" />
            <h3 className="text-base font-semibold text-foreground">No borrowed components</h3>
            <p className="text-xs text-muted-foreground">
              You currently do not have any components borrowed from peers.
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 border-b border-border text-xs uppercase font-semibold text-muted-foreground">
                  <tr>
                    <th className="py-3 px-4">Component</th>
                    <th className="py-3 px-4">Borrowed From</th>
                    <th className="py-3 px-4">Quantity</th>
                    <th className="py-3 px-4">Date Borrowed</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {borrowRecords.map((r) => {
                    const isOverdue =
                      r.status === 'Active' &&
                      r.expectedReturnDate &&
                      new Date(r.expectedReturnDate) < new Date();

                    return (
                      <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-semibold text-foreground">
                          <Link href={`/components/${r.component.id}`} className="hover:text-primary">
                            {r.component.name}
                          </Link>
                          {r.notes && <p className="text-xs font-normal text-muted-foreground">{r.notes}</p>}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-foreground font-medium">{getPersonName(r.borrowedFrom)}</div>
                        </td>
                        <td className="py-3 px-4 font-bold">{r.quantity} pcs</td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {r.dateBorrowed ? new Date(r.dateBorrowed).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {r.expectedReturnDate ? (
                            <span className={isOverdue ? 'text-rose-500 font-bold flex items-center gap-1' : 'text-muted-foreground'}>
                              {isOverdue && <AlertTriangle className="w-3 h-3" />}
                              {new Date(r.expectedReturnDate).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">No due date</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={r.status === 'Active' ? (isOverdue ? 'destructive' : 'primary') : 'success'} size="sm">
                            {isOverdue ? 'Overdue' : r.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {r.status === 'Active' && (
                            <button
                              onClick={() => {
                                setReturningRecord({ id: r.id, type: 'borrow', name: r.component.name });
                                setIsReturnModalOpen(true);
                              }}
                              className="px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90"
                            >
                              Return to Owner
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* LENT LIST */
        lendRecords.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-xl p-8 space-y-3">
            <ArrowUpRight className="w-10 h-10 text-muted-foreground/40 mx-auto" />
            <h3 className="text-base font-semibold text-foreground">No lent components</h3>
            <p className="text-xs text-muted-foreground">
              You haven&apos;t lent out any hardware components to anyone.
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 border-b border-border text-xs uppercase font-semibold text-muted-foreground">
                  <tr>
                    <th className="py-3 px-4">Component</th>
                    <th className="py-3 px-4">Lent To</th>
                    <th className="py-3 px-4">Quantity</th>
                    <th className="py-3 px-4">Date Lent</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {lendRecords.map((r) => {
                    const isOverdue =
                      r.status === 'Active' &&
                      r.expectedReturnDate &&
                      new Date(r.expectedReturnDate) < new Date();

                    return (
                      <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-semibold text-foreground">
                          <Link href={`/components/${r.component.id}`} className="hover:text-primary">
                            {r.component.name}
                          </Link>
                          {r.notes && <p className="text-xs font-normal text-muted-foreground">{r.notes}</p>}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-foreground font-medium">{getPersonName(r.lentTo)}</div>
                        </td>
                        <td className="py-3 px-4 font-bold">{r.quantity} pcs</td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {r.dateLent ? new Date(r.dateLent).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {r.expectedReturnDate ? (
                            <span className={isOverdue ? 'text-rose-500 font-bold flex items-center gap-1' : 'text-muted-foreground'}>
                              {isOverdue && <AlertTriangle className="w-3 h-3" />}
                              {new Date(r.expectedReturnDate).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">No due date</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={r.status === 'Active' ? (isOverdue ? 'destructive' : 'primary') : 'success'} size="sm">
                            {isOverdue ? 'Overdue' : r.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {r.status === 'Active' && (
                            <button
                              onClick={() => {
                                setReturningRecord({ id: r.id, type: 'lend', name: r.component.name });
                                setIsReturnModalOpen(true);
                              }}
                              className="px-3 py-1 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700"
                            >
                              Mark Returned
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* RECORD BORROW MODAL */}
      <Modal
        isOpen={isBorrowModalOpen}
        onClose={() => setIsBorrowModalOpen(false)}
        title="Record Hardware Borrowed From Someone"
        description="Add a component you currently hold on loan from a peer or lab."
      >
        <form onSubmit={handleRecordBorrow} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-foreground mb-1">Component *</label>
            <select
              required
              value={borrowForm.componentId}
              onChange={(e) => setBorrowForm({ ...borrowForm, componentId: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
            >
              <option value="">Select Existing Component</option>
              {components.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-foreground mb-1">Borrowed From (Owner / Lender Name) *</label>
            <input
              type="text"
              required
              placeholder="e.g. Electronics Lab, Prof. Sharma, Rahul..."
              value={borrowForm.borrowedFrom}
              onChange={(e) => setBorrowForm({ ...borrowForm, borrowedFrom: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:border-indigo-500"
            />
            {persons.length > 0 && (
              <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[11px] text-muted-foreground">
                <span>Recent contacts:</span>
                {persons.slice(0, 5).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setBorrowForm({ ...borrowForm, borrowedFrom: p.name })}
                    className="px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block font-medium text-foreground mb-1">Quantity Borrowed *</label>
            <input
              type="number"
              min="1"
              required
              value={borrowForm.quantity}
              onChange={(e) => setBorrowForm({ ...borrowForm, quantity: parseInt(e.target.value, 10) || 1 })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
            />
          </div>

          <div>
            <label className="block font-medium text-foreground mb-1">Expected Return Date</label>
            <input
              type="date"
              value={borrowForm.expectedReturnDate}
              onChange={(e) => setBorrowForm({ ...borrowForm, expectedReturnDate: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
            />
          </div>

          <div>
            <label className="block font-medium text-foreground mb-1">Notes / Terms</label>
            <input
              type="text"
              placeholder="e.g. Borrowed oscilloscope probe for week 3 testing"
              value={borrowForm.notes}
              onChange={(e) => setBorrowForm({ ...borrowForm, notes: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setIsBorrowModalOpen(false)}
              className="px-4 py-2 border border-border rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700"
            >
              Record Borrow
            </button>
          </div>
        </form>
      </Modal>

      {/* RECORD LEND MODAL */}
      <Modal
        isOpen={isLendModalOpen}
        onClose={() => setIsLendModalOpen(false)}
        title="Lend Hardware to Someone"
        description="Lend an available component to a colleague or student."
      >
        <form onSubmit={handleRecordLend} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-foreground mb-1">Component (from available stock) *</label>
            <select
              required
              value={lendForm.componentId}
              onChange={(e) => setLendForm({ ...lendForm, componentId: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
            >
              <option value="">Select Component</option>
              {components.map((c) => (
                <option key={c.id} value={c.id} disabled={c.quantityAvailable <= 0}>
                  {c.name} ({c.quantityAvailable} available)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-foreground mb-1">
              Lent To (Recipient / Friend Name) *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Guhan, Alex, Robot Team..."
              value={lendForm.lentTo}
              onChange={(e) => setLendForm({ ...lendForm, lentTo: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:border-violet-500"
            />
            {persons.length > 0 && (
              <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[11px] text-muted-foreground">
                <span>Recent contacts:</span>
                {persons.slice(0, 5).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setLendForm({ ...lendForm, lentTo: p.name })}
                    className="px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block font-medium text-foreground mb-1">Quantity to Lend *</label>
            <input
              type="number"
              min="1"
              required
              value={lendForm.quantity}
              onChange={(e) => setLendForm({ ...lendForm, quantity: parseInt(e.target.value, 10) || 1 })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
            />
          </div>

          <div>
            <label className="block font-medium text-foreground mb-1">Expected Return Date</label>
            <input
              type="date"
              value={lendForm.expectedReturnDate}
              onChange={(e) => setLendForm({ ...lendForm, expectedReturnDate: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
            />
          </div>

          <div>
            <label className="block font-medium text-foreground mb-1">Notes / Purpose</label>
            <input
              type="text"
              placeholder="e.g. Capstone project breadboard testing"
              value={lendForm.notes}
              onChange={(e) => setLendForm({ ...lendForm, notes: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setIsLendModalOpen(false)}
              className="px-4 py-2 border border-border rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-violet-600 text-white font-semibold rounded-lg hover:bg-violet-700"
            >
              Confirm Loan
            </button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM RETURN MODAL */}
      <Modal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        title={`Process Return: ${returningRecord?.name || ''}`}
        description="Mark this component returned and update inventory balances."
        maxWidth="sm"
      >
        <form onSubmit={handleConfirmReturn} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-foreground mb-1">Return Notes / Condition (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Returned in good working condition, pins straight"
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setIsReturnModalOpen(false)}
              className="px-4 py-2 border border-border rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90"
            >
              Complete Return
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function LoansPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground text-sm">Loading loan records...</div>}>
      <LoansContent />
    </Suspense>
  );
}
