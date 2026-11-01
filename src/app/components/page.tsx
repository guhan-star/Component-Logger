'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Boxes,
  Search,
  Plus,
  Download,
  QrCode,
  FileSpreadsheet,
  AlertCircle,
  ExternalLink,
  Trash2,
  X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import QRCode from 'qrcode';

interface ComponentRecord {
  id: string;
  sku: string;
  name: string;
  category: string;
  componentType?: string;
  manufacturer?: string;
  mpn?: string;
  protocols?: string[];
  quantityTotal: number;
  quantityHere: number;
  quantityReserved?: number;
  quantityLent?: number;
  unit: string;
  unitPrice: number;
  totalPrice?: number;
  ownership: 'Mine' | 'Borrowed' | 'Lent';
  currentStatus: string;
  borrowedFrom?: string;
  borrowingDate?: string;
  lentTo?: string;
  lendingDate?: string;
  expectedReturnDate?: string;
  storageDescription?: string;
  purchaseDate?: string;
  supplier?: string;
  generalNotes?: string;
  lendRecords?: Array<{ id: string; lentTo: string; quantity: number; expectedReturnDate?: string | null }>;
  borrowRecords?: Array<{ id: string; borrowedFrom: string; quantity: number; expectedReturnDate?: string | null }>;
}

const DEFAULT_TYPES = [
  'Microcontroller',
  'Module',
  'Communication',
  'Sensor',
  'Power',
  'Passive',
  'Connector',
  'Semiconductor',
  'Display',
  'Electromechanical',
  'Development Board',
  'Tool',
  'General',
];

const DEFAULT_UNITS = [
  'Piece',
  'Board',
  'Module',
  'Pack',
  'Set',
  'Pair',
  'Meter',
  'Centimeter',
  'Roll',
  'Box',
];

const DEFAULT_STATUSES = [
  'In Storage',
  'In Use',
  'Lent Out',
  'Borrowed and In Use',
  'Returned',
  'Lost',
  'Damaged',
];

function StarkInventoryContent() {
  const searchParams = useSearchParams();
  const initialAction = searchParams.get('action');

  const [items, setItems] = useState<ComponentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [customDropdowns, setCustomDropdowns] = useState<Record<string, string[]>>({
    category: DEFAULT_TYPES,
    unit: DEFAULT_UNITS,
    currentStatus: DEFAULT_STATUSES,
  });

  // Filters
  const [search, setSearch] = useState('');
  const [ownershipFilter, setOwnershipFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortField, setSortField] = useState('name');

  // Modal editing
  const [editing, setEditing] = useState<ComponentRecord | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [qrModalItem, setQrModalItem] = useState<ComponentRecord | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Form State
  const [formData, setFormData] = useState<Partial<ComponentRecord>>({
    sku: '',
    name: '',
    category: 'Microcontroller',
    componentType: '',
    manufacturer: '',
    mpn: '',
    quantityTotal: 1,
    quantityHere: 1,
    quantityReserved: 0,
    unit: 'Piece',
    unitPrice: 0,
    totalPrice: 0,
    ownership: 'Mine',
    currentStatus: 'In Storage',
    borrowedFrom: '',
    lentTo: '',
    lendingDate: '',
    storageDescription: '',
    generalNotes: '',
  });

  // Custom input toggles & Guest mode state
  const [customCategory, setCustomCategory] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const [isGuestMode, setIsGuestMode] = useState(false);

  // Quick Lend & Custody Modal State
  const [quickLendOpen, setQuickLendOpen] = useState(false);
  const [quickLendItem, setQuickLendItem] = useState<ComponentRecord | null>(null);
  const [quickLendSelectedId, setQuickLendSelectedId] = useState('');
  const [quickLendForm, setQuickLendForm] = useState({
    recipient: '',
    quantity: 1,
    returnDate: '',
    notes: '',
  });
  const [quickLendLoading, setQuickLendLoading] = useState(false);

  const openQuickLendModal = (item?: ComponentRecord) => {
    if (item) {
      setQuickLendItem(item);
      setQuickLendSelectedId(item.id);
      setQuickLendForm({
        recipient: '',
        quantity: Math.min(1, item.quantityHere),
        returnDate: '',
        notes: '',
      });
    } else {
      const firstAvail = items.find((x) => x.quantityHere > 0) || items[0] || null;
      setQuickLendItem(firstAvail);
      setQuickLendSelectedId(firstAvail?.id || '');
      setQuickLendForm({
        recipient: '',
        quantity: firstAvail ? Math.min(1, firstAvail.quantityHere) : 1,
        returnDate: '',
        notes: '',
      });
    }
    setQuickLendOpen(true);
  };

  const handleQuickLendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetComp = items.find((x) => x.id === quickLendSelectedId) || quickLendItem;
    if (!targetComp) {
      alert('Please select a component to lend.');
      return;
    }
    const lendQty = Number(quickLendForm.quantity) || 1;
    if (lendQty <= 0) {
      alert('Quantity must be at least 1.');
      return;
    }
    if (lendQty > targetComp.quantityHere) {
      alert(`Cannot lend ${lendQty}. Only ${targetComp.quantityHere} units are currently available in storage.`);
      return;
    }
    const recipient = quickLendForm.recipient.trim();
    if (!recipient) {
      alert('Recipient name is required.');
      return;
    }

    setQuickLendLoading(true);

    if (isGuestMode) {
      const nextItems = items.map((it) => {
        if (it.id === targetComp.id) {
          const newAvail = it.quantityHere - lendQty;
          const currentLent = it.quantityLent || 0;
          return {
            ...it,
            quantityHere: newAvail,
            quantityLent: currentLent + lendQty,
            currentStatus: 'Lent Out',
            lentTo: recipient,
            lendingDate: new Date().toISOString().split('T')[0],
            lendRecords: [
              ...(it.lendRecords || []),
              {
                id: `guest-lend-${Date.now()}`,
                lentTo: recipient,
                quantity: lendQty,
                expectedReturnDate: quickLendForm.returnDate || null,
              },
            ],
          };
        }
        return it;
      });
      setItems(nextItems);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('stark_guest_components', JSON.stringify(nextItems));
      }
      setQuickLendLoading(false);
      setQuickLendOpen(false);
      return;
    }

    try {
      const res = await fetch('/api/lend-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          componentId: targetComp.id,
          lentTo: recipient,
          quantity: lendQty,
          expectedReturnDate: quickLendForm.returnDate || null,
          notes: quickLendForm.notes || null,
        }),
      });

      if (res.ok) {
        setQuickLendOpen(false);
        loadData();
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed to record loan' }));
        alert(err.error || 'Failed to record loan');
      }
    } catch (err) {
      console.error(err);
      alert('An unexpected error occurred while recording loan.');
    } finally {
      setQuickLendLoading(false);
    }
  };

  const handleQuickReturn = async (item: ComponentRecord) => {
    const activeLend = item.lendRecords && item.lendRecords.length > 0 ? item.lendRecords[0] : null;
    const recipientName = item.lentTo || activeLend?.lentTo || 'recipient';
    if (!confirm(`Mark lent units to "${recipientName}" as returned to storage?`)) {
      return;
    }

    if (isGuestMode) {
      const nextItems = items.map((it) => {
        if (it.id === item.id) {
          return {
            ...it,
            quantityHere: it.quantityTotal,
            quantityLent: 0,
            currentStatus: 'In Storage',
            lentTo: '',
            lendingDate: '',
            lendRecords: [],
          };
        }
        return it;
      });
      setItems(nextItems);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('stark_guest_components', JSON.stringify(nextItems));
      }
      return;
    }

    try {
      if (activeLend) {
        await fetch(`/api/lend-records/${activeLend.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'Returned' }),
        });
      } else {
        await fetch(`/api/components/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quantityHere: item.quantityTotal,
            quantityOwned: item.quantityTotal,
            currentStatus: 'In Storage',
            lentTo: '',
            lendingDate: '',
          }),
        });
      }
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to return component to storage.');
    }
  };

  const handleQuickReturnBorrowed = async (item: ComponentRecord) => {
    const lenderName = item.borrowedFrom || 'owner';
    if (!confirm(`Return this borrowed component back to "${lenderName}"?`)) {
      return;
    }

    if (isGuestMode) {
      const nextItems = items.filter((it) => it.id !== item.id);
      setItems(nextItems);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('stark_guest_components', JSON.stringify(nextItems));
      }
      return;
    }

    try {
      const activeBorrow = item.borrowRecords && item.borrowRecords.length > 0 ? item.borrowRecords[0] : null;
      if (activeBorrow) {
        await fetch(`/api/borrow-records/${activeBorrow.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'Returned' }),
        });
      }
      await fetch(`/api/components/${item.id}`, { method: 'DELETE' });
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to return borrowed component.');
    }
  };

  const loadData = () => {
    setLoading(true);
    fetch('/api/components?pageSize=200')
      .then((res) => {
        if (res.status === 401) {
          setIsGuestMode(true);
          try {
            const saved = typeof window !== 'undefined' ? sessionStorage.getItem('stark_guest_components') : null;
            if (saved) {
              setItems(JSON.parse(saved));
            } else {
              const starter: ComponentRecord[] = [
                {
                  id: 'guest-1',
                  sku: 'COMP-001',
                  name: 'ESP32 DevKit V1',
                  category: 'Microcontroller',
                  componentType: 'Development Board',
                  manufacturer: 'Espressif',
                  mpn: 'ESP32-WROOM-32D',
                  protocols: ['I2C', 'SPI', 'UART', 'WiFi', 'BLE'],
                  quantityTotal: 5,
                  quantityHere: 5,
                  quantityReserved: 0,
                  quantityLent: 0,
                  unit: 'Piece',
                  unitPrice: 380,
                  totalPrice: 1900,
                  ownership: 'Mine',
                  currentStatus: 'In Storage',
                  borrowedFrom: '',
                  lentTo: '',
                  lendingDate: '',
                  storageDescription: 'Bin A-1',
                  purchaseDate: '2026-11-01',
                  supplier: 'Robu.in',
                  generalNotes: 'Dual core 240MHz microcontroller with WiFi and Bluetooth',
                },
                {
                  id: 'guest-2',
                  sku: 'COMP-002',
                  name: '10kΩ Resistor (0805 SMD)',
                  category: 'Passive',
                  componentType: 'Resistor',
                  manufacturer: 'Yageo',
                  mpn: 'RC0805FR-0710KL',
                  protocols: [],
                  quantityTotal: 100,
                  quantityHere: 100,
                  quantityReserved: 0,
                  quantityLent: 0,
                  unit: 'Piece',
                  unitPrice: 0.5,
                  totalPrice: 50,
                  ownership: 'Mine',
                  currentStatus: 'In Storage',
                  borrowedFrom: '',
                  lentTo: '',
                  lendingDate: '',
                  storageDescription: 'Drawer R-10K',
                  purchaseDate: '2026-11-01',
                  supplier: 'Mouser',
                  generalNotes: '1% precision SMD resistor tape',
                },
              ];
              setItems(starter);
              if (typeof window !== 'undefined') {
                sessionStorage.setItem('stark_guest_components', JSON.stringify(starter));
              }
            }
          } catch {
            setItems([]);
          }
          setLoading(false);
          return null;
        }
        setIsGuestMode(false);
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        const rawList = data.components || data.data || [];
        const mapped: ComponentRecord[] = rawList.map((c: any, index: number) => {
          const compCategory =
            typeof c.category === 'string' && c.category.trim()
              ? c.category.trim()
              : (c.category?.name || c.subcategory || c.componentType || 'General');
          const compSubcategory =
            typeof c.subcategory === 'string' && c.subcategory.trim()
              ? c.subcategory.trim()
              : (c.componentType || compCategory);

          return {
            id: c.id,
            sku: c.sku || c.mpn || `COMP-${String(index + 1).padStart(3, '0')}`,
            name: c.name,
            category: compCategory,
            componentType: compSubcategory,
            manufacturer: typeof c.manufacturer === 'string' ? c.manufacturer : (c.manufacturer?.name || ''),
            mpn: c.mpn || '',
            protocols: c.specifications
              ? c.specifications
                  .filter((s: any) => s.fieldName.toLowerCase().includes('interface') || s.fieldName.toLowerCase().includes('protocol'))
                  .map((s: any) => s.textValue || s.fieldName)
              : [],
            quantityTotal: c.quantityOwned ?? c.quantityAvailable ?? 0,
            quantityHere: c.quantityAvailable ?? 0,
            quantityReserved: c.quantityReserved ?? 0,
            quantityLent: (c.quantityLentOut > 0)
              ? c.quantityLentOut
              : (c.lendRecords && c.lendRecords.length > 0)
              ? c.lendRecords.reduce((sum: number, l: any) => sum + (l.quantity || 0), 0)
              : Math.max(0, (c.quantityOwned || 0) - (c.quantityAvailable || 0)),
            unit: c.unitOfMeasurement || 'Piece',
            unitPrice: c.unitCost ?? 0,
            totalPrice: (c.quantityOwned ?? c.quantityAvailable ?? 0) * (c.unitCost ?? 0),
            ownership: (c.ownershipType === 'Borrowed' ? 'Borrowed' : 'Mine') as any,
            currentStatus: (c.quantityLentOut > 0 || c.lentTo || (c.lendRecords && c.lendRecords.length > 0)) ? 'Lent Out' : 'In Storage',
            borrowedFrom: c.borrowedFrom || (c.borrowRecords && c.borrowRecords.length > 0 ? c.borrowRecords[0].borrowedFrom : (c.notes?.includes('from ') ? c.notes.split('from ')[1] : '')),
            lentTo: c.lentTo || (c.lendRecords && c.lendRecords.length > 0 ? c.lendRecords[0].lentTo : ''),
            lendingDate: c.lendingDate ? c.lendingDate.split('T')[0] : (c.lendRecords && c.lendRecords.length > 0 && c.lendRecords[0].createdAt ? c.lendRecords[0].createdAt.split('T')[0] : ''),
            storageDescription: c.storageLocation || 'Lab Rack',
            purchaseDate: c.acquisitionDate ? c.acquisitionDate.split('T')[0] : '',
            supplier: typeof c.supplier === 'string' ? c.supplier : (c.supplier?.name || ''),
            generalNotes: c.notes || '',
            lendRecords: c.lendRecords || [],
            borrowRecords: c.borrowRecords || [],
          };
        });

        setItems(mapped);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (initialAction === 'new') {
      openNewComponentModal();
    }
  }, [initialAction]);

  useEffect(() => {
    if (qrModalItem) {
      QRCode.toDataURL(
        JSON.stringify({
          sku: qrModalItem.sku,
          name: qrModalItem.name,
          mpn: qrModalItem.mpn,
        }),
        { width: 250, margin: 2 }
      )
        .then(setQrDataUrl)
        .catch(console.error);
    }
  }, [qrModalItem]);

  // Filtered & Sorted components
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items
      .filter((x) => {
        const text = `${x.sku} ${x.name} ${x.mpn} ${x.category} ${x.componentType} ${x.manufacturer} ${x.storageDescription} ${x.generalNotes} ${x.protocols?.join(' ')}`.toLowerCase();
        const matchesQ = !q || text.includes(q);
        const matchesOwnership = !ownershipFilter || x.ownership === ownershipFilter;
        const matchesCategory = !categoryFilter || x.category === categoryFilter;
        const isLentOut = x.currentStatus === 'Lent Out' || (x.quantityLent && x.quantityLent > 0) || Boolean(x.lentTo) || (x.quantityTotal > x.quantityHere && x.ownership !== 'Borrowed');
        const matchesStatus =
          !statusFilter
            ? true
            : statusFilter === 'Lent Out'
            ? isLentOut
            : statusFilter === 'In Storage'
            ? (!isLentOut && x.currentStatus === 'In Storage')
            : x.currentStatus === statusFilter;
        return matchesQ && matchesOwnership && matchesCategory && matchesStatus;
      })
      .sort((a, b) => {
        if (sortField === 'sku') return a.sku.localeCompare(b.sku);
        if (sortField === 'unitPrice') return b.unitPrice - a.unitPrice;
        if (sortField === 'quantityTotal') return b.quantityTotal - a.quantityTotal;
        if (sortField === 'quantityHere') return b.quantityHere - a.quantityHere;
        return a.name.localeCompare(b.name);
      });
  }, [items, search, ownershipFilter, categoryFilter, statusFilter, sortField]);

  // Summary KPIs
  const totalQty = useMemo(() => items.reduce((sum, x) => sum + (x.quantityTotal || 0), 0), [items]);
  const availQty = useMemo(() => items.reduce((sum, x) => sum + (x.quantityHere || 0), 0), [items]);
  const ownedVal = useMemo(
    () =>
      items
        .filter((x) => x.ownership !== 'Borrowed')
        .reduce((sum, x) => sum + (x.totalPrice || x.quantityTotal * x.unitPrice || 0), 0),
    [items]
  );
  const borrowedVal = useMemo(
    () =>
      items
        .filter((x) => x.ownership === 'Borrowed')
        .reduce((sum, x) => sum + (x.totalPrice || x.quantityTotal * x.unitPrice || 0), 0),
    [items]
  );
  const lentUnits = useMemo(() => items.reduce((sum, x) => sum + (x.quantityLent || 0), 0), [items]);

  const money = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  const openNewComponentModal = () => {
    setIsNew(true);
    setFormData({
      sku: `COMP-${String(items.length + 1).padStart(3, '0')}`,
      name: '',
      category: 'Microcontroller',
      componentType: 'Development Board',
      manufacturer: '',
      mpn: '',
      quantityTotal: 1,
      quantityHere: 1,
      quantityReserved: 0,
      unit: 'Piece',
      unitPrice: 0,
      totalPrice: 0,
      ownership: 'Mine',
      currentStatus: 'In Storage',
      borrowedFrom: '',
      lentTo: '',
      lendingDate: '',
      storageDescription: '',
      generalNotes: '',
    });
    setCustomCategory('');
    setCustomUnit('');
    setEditing({} as ComponentRecord);
  };

  const openEditModal = (item: ComponentRecord) => {
    setIsNew(false);
    setFormData({ ...item });
    setCustomCategory('');
    setCustomUnit('');
    setEditing(item);

    // Ensure item's category and unit exist in the select dropdown options
    setCustomDropdowns((prev) => ({
      ...prev,
      category: item.category && !prev.category.includes(item.category)
        ? [...prev.category, item.category]
        : prev.category,
      unit: item.unit && !prev.unit.includes(item.unit)
        ? [...prev.unit, item.unit]
        : prev.unit,
    }));
  };

  const handleSaveComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalQty = Number(formData.quantityTotal) || 0;
    const hereQty = Number(formData.quantityHere) || 0;

    if (totalQty < hereQty) {
      alert(`Quantity Number (${totalQty}) cannot be lower than Quantity Here (${hereQty}). Please adjust your quantities.`);
      return;
    }

    if (!formData.name?.trim() || !formData.sku?.trim()) {
      alert('Component ID and Component Name are required');
      return;
    }

    if (formData.ownership === 'Borrowed' && !formData.borrowedFrom?.trim()) {
      alert('Borrowed items require "Borrowed from".');
      return;
    }
    if ((formData.currentStatus === 'Lent Out' || totalQty > hereQty) && !formData.lentTo?.trim()) {
      alert(`Please enter who you lent the ${Math.max(1, totalQty - hereQty)} out-of-storage unit(s) to in "Lent to".`);
      return;
    }

    const finalLendingDate = formData.lendingDate || (totalQty > hereQty ? new Date().toISOString().split('T')[0] : '');

    // Resolve custom values
    let finalCategory = formData.category;
    if (formData.category === '__custom__' && customCategory.trim()) {
      finalCategory = customCategory.trim();
      setCustomDropdowns((prev) => ({
        ...prev,
        category: [...new Set([...prev.category, finalCategory!])],
      }));
    }

    let finalUnit = formData.unit;
    if (formData.unit === '__custom__' && customUnit.trim()) {
      finalUnit = customUnit.trim();
      setCustomDropdowns((prev) => ({
        ...prev,
        unit: [...new Set([...prev.unit, finalUnit!])],
      }));
    }

    const newLentOut = Math.max(0, totalQty - hereQty);
    const resolvedStatus = (newLentOut > 0 || formData.currentStatus === 'Lent Out') ? 'Lent Out' : formData.currentStatus;

    const payload = {
      name: formData.name.trim(),
      sku: formData.sku.trim(),
      mpn: formData.mpn ? formData.mpn.trim() : formData.sku.trim(),
      category: finalCategory || 'General',
      subcategory: finalCategory || 'General',
      componentType: finalCategory || 'General',
      manufacturer: formData.manufacturer ? formData.manufacturer.trim() : null,
      quantityOwned: totalQty,
      quantityTotal: totalQty,
      quantityAvailable: hereQty,
      quantityHere: hereQty,
      quantityLentOut: newLentOut,
      quantityReserved: Number(formData.quantityReserved) || 0,
      unit: finalUnit || 'Piece',
      unitOfMeasurement: finalUnit || 'Piece',
      unitCost: Number(formData.unitPrice) || 0,
      unitPrice: Number(formData.unitPrice) || 0,
      ownership: formData.ownership,
      ownershipType: formData.ownership === 'Borrowed' ? 'Borrowed' : 'Mine',
      currentStatus: resolvedStatus,
      condition: 'New',
      storageLocation: formData.storageDescription || null,
      borrowedFrom: formData.borrowedFrom || null,
      lentTo: formData.lentTo || null,
      lendingDate: finalLendingDate || null,
      notes: `${formData.generalNotes || ''} ${formData.borrowedFrom ? `[Borrowed from ${formData.borrowedFrom}]` : ''}`.trim(),
    };

    // If in Guest Sandbox Mode, handle purely client-side in temporary session
    if (isGuestMode) {
      if (isNew) {
        const newGuestItem: ComponentRecord = {
          id: `guest-${Date.now()}`,
          sku: formData.sku.trim(),
          name: formData.name.trim(),
          category: finalCategory || 'General',
          componentType: formData.componentType || '',
          manufacturer: formData.manufacturer ? formData.manufacturer.trim() : '',
          mpn: formData.mpn ? formData.mpn.trim() : formData.sku.trim(),
          protocols: [],
          quantityTotal: totalQty,
          quantityHere: hereQty,
          quantityReserved: Number(formData.quantityReserved) || 0,
          quantityLent: newLentOut,
          unit: finalUnit || 'Piece',
          unitPrice: Number(formData.unitPrice) || 0,
          totalPrice: totalQty * (Number(formData.unitPrice) || 0),
          ownership: formData.ownership as any,
          currentStatus: resolvedStatus as any,
          borrowedFrom: formData.borrowedFrom || '',
          lentTo: formData.lentTo || '',
          lendingDate: finalLendingDate || '',
          storageDescription: formData.storageDescription || 'Lab Rack',
          purchaseDate: new Date().toISOString().split('T')[0],
          supplier: '',
          generalNotes: formData.generalNotes || '',
          lendRecords: newLentOut > 0 && formData.lentTo ? [{
            id: `guest-lend-${Date.now()}`,
            lentTo: formData.lentTo,
            quantity: newLentOut,
            expectedReturnDate: finalLendingDate,
          }] : [],
        };
        const nextItems = [newGuestItem, ...items];
        setItems(nextItems);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('stark_guest_components', JSON.stringify(nextItems));
        }
      } else {
        const nextItems = items.map((item) =>
          item.id === editing?.id
            ? {
                ...item,
                name: (formData.name || item.name).trim(),
                sku: (formData.sku || item.sku).trim(),
                category: finalCategory || item.category,
                componentType: finalCategory || item.componentType,
                manufacturer: formData.manufacturer ? formData.manufacturer.trim() : item.manufacturer,
                mpn: formData.mpn ? formData.mpn.trim() : item.mpn,
                quantityTotal: totalQty,
                quantityHere: hereQty,
                quantityLent: newLentOut,
                unit: finalUnit || item.unit,
                unitPrice: Number(formData.unitPrice) || 0,
                totalPrice: totalQty * (Number(formData.unitPrice) || 0),
                ownership: formData.ownership as any,
                currentStatus: resolvedStatus as any,
                borrowedFrom: formData.borrowedFrom || '',
                lentTo: formData.lentTo || '',
                lendingDate: finalLendingDate || '',
                storageDescription: formData.storageDescription || item.storageDescription,
                generalNotes: formData.generalNotes || '',
                lendRecords: newLentOut > 0 && formData.lentTo ? [{
                  id: `guest-lend-${Date.now()}`,
                  lentTo: formData.lentTo,
                  quantity: newLentOut,
                  expectedReturnDate: finalLendingDate,
                }] : [],
              }
            : item
        );
        setItems(nextItems);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('stark_guest_components', JSON.stringify(nextItems));
        }
      }
      setEditing(null);
      return;
    }

    try {
      const url = isNew ? '/api/components' : `/api/components/${editing?.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setEditing(null);
        loadData();
      } else {
        const err = await res.json().catch(() => ({ error: 'Failed to save component' }));
        alert(err.error || 'Failed to save component');
      }
    } catch (err) {
      console.error(err);
      alert('An unexpected error occurred while saving the component.');
    }
  };

  const handleDelete = async () => {
    if (!editing?.id) return;
    if (!confirm(`Delete component "${editing.name}"?`)) return;

    if (isGuestMode) {
      const nextItems = items.filter((x) => x.id !== editing.id);
      setItems(nextItems);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('stark_guest_components', JSON.stringify(nextItems));
      }
      setEditing(null);
      return;
    }

    try {
      const res = await fetch(`/api/components/${editing.id}`, { method: 'DELETE' });
      if (res.ok) {
        setEditing(null);
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    const headers = [
      'Component ID',
      'Component Name',
      'Quantity Number',
      'Quantity Unit',
      'Price Per Unit',
      'Total Value',
      'Type',
      'Ownership',
      'Borrowed From',
      'Lent To',
      'Date Lent',
      'Note',
      'Current Status',
    ];

    const rows = filtered.map((x) => [
      x.sku,
      x.name,
      x.quantityTotal,
      x.unit,
      x.unitPrice,
      x.totalPrice || x.quantityTotal * x.unitPrice,
      x.category,
      x.ownership,
      x.borrowedFrom || '',
      x.lentTo || '',
      x.lendingDate || '',
      x.generalNotes || '',
      x.currentStatus || 'In Storage',
    ]);

    const csvContent = [headers, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stark_warehouse_inventory_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // XLSX Export via SheetJS
  const handleExportXlsx = () => {
    const wb = XLSX.utils.book_new();
    const inventory = filtered.map((x) => ({
      'Component ID': x.sku,
      'Component Name': x.name,
      Type: x.category,
      'Quantity Number': x.quantityTotal,
      'Quantity Unit': x.unit,
      'Price Per Unit': x.unitPrice,
      'Total Value': x.totalPrice || x.quantityTotal * x.unitPrice,
      Ownership: x.ownership,
      'Borrowed From': x.borrowedFrom || '',
      'Lent To': x.lentTo || '',
      'Date Lent': x.lendingDate || '',
      Note: x.generalNotes || '',
      'Current Status': x.currentStatus || 'In Storage',
      Storage: x.storageDescription || '',
    }));

    const ws = XLSX.utils.json_to_sheet(inventory);
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, `stark_industries_warehouse_export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-4 text-[13px]">
      {/* Guest Mode Discovery Banner */}
      {isGuestMode && (
        <div className="p-3.5 rounded-lg border border-[var(--amber)]/40 bg-[var(--amber)]/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider bg-[var(--amber)] text-black px-1.5 py-0.5 rounded">
                GUEST SANDBOX
              </span>
              <span className="font-semibold text-[var(--amber)]">Login is optional!</span>
            </div>
            <p className="text-[var(--text)]">
              You can test, add, edit, and save components temporarily in this browser session. To claim a unique username, add friends, and collaborate on project teams (up to 6 members), create a free permanent account.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/register"
              className="px-3 py-1.5 font-bold rounded bg-[var(--amber)] text-[#17120a] hover:bg-[#d97706] transition-colors"
            >
              Create Account
            </Link>
            <Link
              href="/login"
              className="px-3 py-1.5 font-medium rounded border border-[var(--line)] bg-[var(--panel2)] text-[var(--text)] hover:border-[var(--amber)] transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      )}

      {/* Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="brand">OPERATIONS / INVENTORY</div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text)] mt-0.5">
            Unified inventory workspace
          </h1>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            Search, custody, quantities, prices, dates and hardware type in one view.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={openNewComponentModal}
            className="px-3.5 py-1.5 rounded font-bold text-xs bg-[var(--amber)] text-[#17120a] hover:bg-[#d97706] transition-colors"
          >
            + Add component
          </button>
          <button
            onClick={() => openQuickLendModal()}
            className="px-3 py-1.5 rounded font-bold text-xs border border-[var(--amber)]/60 text-[var(--amber)] hover:bg-[var(--amber)]/10 transition-colors flex items-center gap-1.5"
          >
            <span>📤 Lend hardware</span>
          </button>
          <Link
            href="/loans"
            className="px-3 py-1.5 rounded text-xs border border-[var(--line)] bg-[var(--panel2)] hover:border-[var(--cyan)] text-[var(--text)] transition-colors flex items-center gap-1.5"
          >
            <span>📋 Custody log</span>
          </Link>
          <button
            onClick={handleExportCsv}
            className="px-3 py-1.5 rounded text-xs border border-[var(--line)] bg-[var(--panel2)] hover:border-[var(--amber)] text-[var(--text)]"
          >
            Export CSV
          </button>
          <button
            onClick={handleExportXlsx}
            className="px-3 py-1.5 rounded text-xs border border-[var(--line)] bg-[var(--panel2)] hover:border-[var(--amber)] text-[var(--text)]"
          >
            Export XLSX
          </button>
        </div>
      </div>

      {/* Stark Industries Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <div className="p-3 rounded bg-[var(--panel)] border border-[var(--line)]">
          <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold">Records</div>
          <div className="text-xl font-bold font-mono text-[var(--text)] mt-1">{filtered.length}</div>
        </div>
        <div className="p-3 rounded bg-[var(--panel)] border border-[var(--line)]">
          <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold">Quantity total</div>
          <div className="text-xl font-bold font-mono text-[var(--text)] mt-1">{totalQty}</div>
        </div>
        <div className="p-3 rounded bg-[var(--panel)] border border-[var(--line)]">
          <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold">Quantity available</div>
          <div className="text-xl font-bold font-mono text-[var(--green)] mt-1">{availQty}</div>
        </div>
        <div className="p-3 rounded bg-[var(--panel)] border border-[var(--line)]">
          <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold">Owned value</div>
          <div className="text-xl font-bold font-mono text-[var(--text)] mt-1">{money(ownedVal)}</div>
        </div>
        <div className="p-3 rounded bg-[var(--panel)] border border-[var(--line)]">
          <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold">Borrowed reference</div>
          <div className="text-xl font-bold font-mono text-[var(--cyan)] mt-1">{money(borrowedVal)}</div>
        </div>
        <div className="p-3 rounded bg-[var(--panel)] border border-[var(--line)]">
          <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold">Lent units</div>
          <div className="text-xl font-bold font-mono text-[var(--amber)] mt-1">{lentUnits}</div>
        </div>
      </div>

      {/* Industrial Toolbar & Filter Strip */}
      <div className="p-3 rounded bg-[var(--panel)] border border-[var(--line)] space-y-2.5">
        {/* Quick View Filter Strip */}
        <div className="flex items-center gap-1.5 flex-wrap pb-2 border-b border-[var(--line)]/50 text-xs">
          <span className="text-[10px] uppercase font-bold text-[var(--muted)] mr-1">Quick view:</span>
          <button
            onClick={() => { setOwnershipFilter(''); setStatusFilter(''); }}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
              !ownershipFilter && !statusFilter
                ? 'bg-[var(--amber)] text-black'
                : 'bg-[var(--panel2)] text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            All Items ({items.length})
          </button>
          <button
            onClick={() => { setOwnershipFilter(''); setStatusFilter('Lent Out'); }}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors flex items-center gap-1 ${
              statusFilter === 'Lent Out'
                ? 'bg-[var(--amber)] text-black font-bold'
                : 'bg-[var(--panel2)] text-[var(--amber)] hover:bg-[var(--amber)]/10'
            }`}
          >
            <span>📤 Lent Out ({items.filter(x => (x.quantityLent && x.quantityLent > 0) || x.lentTo || (x.quantityTotal > x.quantityHere && x.ownership !== 'Borrowed')).length})</span>
          </button>
          <button
            onClick={() => { setOwnershipFilter('Borrowed'); setStatusFilter(''); }}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors flex items-center gap-1 ${
              ownershipFilter === 'Borrowed'
                ? 'bg-[var(--cyan)] text-black font-bold'
                : 'bg-[var(--panel2)] text-[var(--cyan)] hover:bg-[var(--cyan)]/10'
            }`}
          >
            <span>📥 Borrowed ({items.filter(x => x.ownership === 'Borrowed' || x.borrowedFrom).length})</span>
          </button>
          <button
            onClick={() => { setOwnershipFilter(''); setStatusFilter('In Storage'); }}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
              statusFilter === 'In Storage'
                ? 'bg-emerald-600 text-white font-bold'
                : 'bg-[var(--panel2)] text-emerald-400 hover:bg-emerald-500/10'
            }`}
          >
            📦 In Storage
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
          {/* Search bar */}
          <div className="md:col-span-2">
            <input
              type="text"
              placeholder="Search name, SKU, type, MPN, manufacturer, tags, dates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] focus:border-[var(--amber)] focus:outline-hidden"
            />
          </div>

          {/* Ownership Filter */}
          <div>
            <select
              value={ownershipFilter}
              onChange={(e) => setOwnershipFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)]"
            >
              <option value="">All ownership</option>
              <option value="Mine">Mine</option>
              <option value="Borrowed">Borrowed</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)]"
            >
              <option value="">All types</option>
              {customDropdowns.category.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)]"
            >
              <option value="">All statuses</option>
              {DEFAULT_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div className="flex gap-2">
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value)}
              className="flex-1 px-2.5 py-1.5 text-xs bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)]"
            >
              <option value="name">Name A-Z</option>
              <option value="sku">SKU A-Z</option>
              <option value="unitPrice">Price high-low</option>
              <option value="quantityTotal">Quantity high-low</option>
              <option value="quantityHere">Quantity here high-low</option>
            </select>

            <button
              onClick={() => {
                setSearch('');
                setOwnershipFilter('');
                setCategoryFilter('');
                setStatusFilter('');
                setSortField('name');
              }}
              className="px-2.5 py-1.5 text-xs border border-[var(--line)] bg-[var(--panel2)] rounded text-[var(--muted)] hover:text-[var(--text)]"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="border border-[var(--line)] rounded bg-[var(--panel)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[var(--panel2)] border-b border-[var(--line)] text-[10px] uppercase font-semibold text-[var(--muted)] tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Component</th>
                <th className="py-2.5 px-3">Type / Manufacturer</th>
                <th className="py-2.5 px-3">Ownership / Status</th>
                <th className="py-2.5 px-3">Quantities</th>
                <th className="py-2.5 px-3">Price</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[var(--muted)]">
                    Loading inventory records...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[var(--muted)]">
                    No records match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((x) => (
                  <tr key={x.id} className="hover:bg-[var(--panel2)] transition-colors">
                    {/* Component */}
                    <td className="py-2.5 px-3">
                      <strong className="mono text-[var(--amber)] text-[11px] font-bold block">{x.sku}</strong>
                      <span className="font-semibold text-[var(--text)] text-[13px]">{x.name}</span>
                      <div className="text-[11px] text-[var(--muted)] mt-0.5">
                        {x.mpn || 'No MPN'} · {x.unit}
                      </div>
                    </td>

                    {/* Type / Manufacturer */}
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-[var(--text)]">{x.category}</div>
                      <div className="text-[11px] text-[var(--muted)] mt-0.5">
                        {x.componentType && `${x.componentType} · `}
                        {x.manufacturer || 'Generic'}
                      </div>
                      {x.protocols && x.protocols.length > 0 && (
                        <div className="text-[10px] text-[var(--amber)] mt-0.5">{x.protocols.join(', ')}</div>
                      )}
                    </td>

                    {/* Ownership / Status */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            x.ownership === 'Mine'
                              ? 'pill-mine'
                              : x.ownership === 'Borrowed'
                              ? 'pill-borrowed'
                              : 'pill-lent'
                          }`}
                        >
                          {x.ownership}
                        </span>
                        <span className="text-[10px] text-[var(--muted)]">{x.currentStatus}</span>
                      </div>

                      {/* Active Lent Custody Badge */}
                      {((x.quantityLent && x.quantityLent > 0) || x.lentTo || (x.quantityTotal > x.quantityHere && x.ownership !== 'Borrowed')) && (
                        <div className="mt-1.5 p-1.5 rounded bg-[var(--amber)]/10 border border-[var(--amber)]/40 text-[11px]">
                          <div className="font-bold text-[var(--amber)] flex items-center justify-between gap-1">
                            <span>📤 Lent: {x.quantityLent || (x.quantityTotal - x.quantityHere)} {x.unit}</span>
                            <button
                              type="button"
                              onClick={() => handleQuickReturn(x)}
                              title="Mark as returned to storage"
                              className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--amber)] text-black font-bold hover:bg-amber-400 transition-colors"
                            >
                              Return ↺
                            </button>
                          </div>
                          <div className="text-[10px] text-[var(--text)] mt-0.5">
                            To: <span className="font-bold text-[var(--amber)]">{x.lentTo || x.lendRecords?.[0]?.lentTo || 'Borrower'}</span>
                          </div>
                        </div>
                      )}

                      {/* Active Borrowed Custody Badge */}
                      {(x.ownership === 'Borrowed' || x.borrowedFrom) && (
                        <div className="mt-1.5 p-1.5 rounded bg-[var(--cyan)]/10 border border-[var(--cyan)]/40 text-[11px]">
                          <div className="font-bold text-[var(--cyan)] flex items-center justify-between gap-1">
                            <span>📥 Borrowed: {x.quantityTotal} {x.unit}</span>
                            <button
                              type="button"
                              onClick={() => handleQuickReturnBorrowed(x)}
                              title="Return borrowed item to owner"
                              className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--cyan)] text-black font-bold hover:bg-cyan-300 transition-colors"
                            >
                              Return ↺
                            </button>
                          </div>
                          <div className="text-[10px] text-[var(--text)] mt-0.5">
                            From: <span className="font-bold text-[var(--cyan)]">{x.borrowedFrom || 'Owner'}</span>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Quantities */}
                    <td className="py-2.5 px-3 mono">
                      <div>total: <span className="font-bold text-[var(--text)]">{x.quantityTotal}</span></div>
                      <div className="text-[var(--green)] font-semibold">here: {x.quantityHere}</div>
                      {((x.quantityLent && x.quantityLent > 0) || x.lentTo) ? (
                        <div className="text-[10px] text-[var(--amber)] font-medium">
                          ({x.quantityLent || (x.quantityTotal - x.quantityHere)} lent to {x.lentTo || x.lendRecords?.[0]?.lentTo || 'friend'})
                        </div>
                      ) : (x.quantityTotal > x.quantityHere && x.ownership !== 'Borrowed') ? (
                        <div className="text-[10px] text-[var(--amber)] font-medium">
                          ({x.quantityTotal - x.quantityHere} out of storage)
                        </div>
                      ) : (
                        <div className="text-[10px] text-[var(--muted)]">
                          {x.quantityHere} avail
                        </div>
                      )}
                    </td>

                    {/* Price */}
                    <td className="py-2.5 px-3 mono">
                      <div>{money(x.unitPrice)}/unit</div>
                      <strong className="text-[var(--text)]">
                        {money(x.totalPrice || x.quantityTotal * x.unitPrice)}
                      </strong>
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openQuickLendModal(x)}
                          disabled={x.quantityHere <= 0}
                          title={x.quantityHere <= 0 ? 'No available stock to lend' : `Lend 1 or more units of ${x.name}`}
                          className="px-2 py-1 rounded border border-[var(--amber)]/40 bg-[var(--amber)]/10 hover:bg-[var(--amber)]/20 text-xs text-[var(--amber)] font-medium disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          Lend
                        </button>
                        <button
                          title="Generate QR Label"
                          onClick={() => setQrModalItem(x)}
                          className="p-1 rounded border border-[var(--line)] bg-[var(--bg)] hover:border-[var(--amber)] text-[var(--muted)] hover:text-[var(--text)]"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(x)}
                          className="px-2.5 py-1 rounded border border-[var(--line)] bg-[var(--panel2)] hover:border-[var(--amber)] text-xs text-[var(--text)] font-medium"
                        >
                          Inspect
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* INSPECT / EDIT COMPONENT MODAL */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-[var(--panel)] border border-[var(--line)] rounded-lg p-5 shadow-2xl text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <h3 className="text-base font-bold text-[var(--text)]">
                {isNew ? 'Add component' : 'Edit component'}
              </h3>
              <button
                onClick={() => setEditing(null)}
                className="p-1 text-[var(--muted)] hover:text-[var(--text)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveComponent} className="space-y-4">
              {/* SECTION: Core component fields */}
              <div>
                <div className="brand mb-2 border-b border-[var(--line)] pb-1">
                  CORE COMPONENT FIELDS
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1 font-semibold">
                      Component ID (SKU) *
                    </label>
                    <input
                      required
                      value={formData.sku || ''}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      placeholder="e.g. COMP-001"
                      className="w-full px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1 font-semibold">
                      Component Name *
                    </label>
                    <input
                      required
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. ESP32 DevKit V1"
                      className="w-full px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1 font-semibold">
                      Type *
                    </label>
                    <select
                      value={formData.category || 'Microcontroller'}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)]"
                    >
                      {customDropdowns.category.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value="__custom__">Custom…</option>
                    </select>
                    {formData.category === '__custom__' && (
                      <input
                        placeholder="Type custom category"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        className="w-full mt-1.5 px-2 py-1 bg-[var(--bg)] border border-[var(--amber)] rounded text-xs"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1 font-semibold">
                      Quantity Number *
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={formData.quantityTotal ?? 1}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        const currentHere = formData.quantityHere ?? 0;
                        setFormData({
                          ...formData,
                          quantityTotal: val,
                          quantityHere: isNew ? val : (currentHere > val ? val : currentHere),
                          totalPrice: val * (formData.unitPrice || 0),
                        });
                      }}
                      className="w-full px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)]"
                    />
                    {Number(formData.quantityTotal || 0) < Number(formData.quantityHere || 0) && (
                      <p className="text-[10px] text-amber-500 mt-1">Must be ≥ Quantity Here</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1 font-semibold">
                      Quantity Unit *
                    </label>
                    <select
                      value={formData.unit || 'Piece'}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)]"
                    >
                      {customDropdowns.unit.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                      <option value="__custom__">Custom…</option>
                    </select>
                    {formData.unit === '__custom__' && (
                      <input
                        placeholder="Type custom unit"
                        value={customUnit}
                        onChange={(e) => setCustomUnit(e.target.value)}
                        className="w-full mt-1.5 px-2 py-1 bg-[var(--bg)] border border-[var(--amber)] rounded text-xs"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1 font-semibold">
                      Price Per Unit (₹) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={formData.unitPrice ?? 0}
                      onChange={(e) => {
                        const price = Number(e.target.value) || 0;
                        setFormData({
                          ...formData,
                          unitPrice: price,
                          totalPrice: (formData.quantityTotal || 0) * price,
                        });
                      }}
                      className="w-full px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1 font-semibold">
                      Total Value (₹)
                    </label>
                    <input
                      type="number"
                      step="any"
                      readOnly
                      value={formData.totalPrice || (formData.quantityTotal || 0) * (formData.unitPrice || 0)}
                      className="w-full px-2.5 py-1.5 bg-[var(--panel2)] border border-[var(--line)] rounded text-[var(--text)] cursor-not-allowed font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1 font-semibold">
                      Quantity Here *
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={formData.quantityTotal ?? 0}
                      value={formData.quantityHere ?? 0}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        const maxTotal = Number(formData.quantityTotal) || 0;
                        if (val > maxTotal) {
                          alert(`Quantity Here cannot exceed Quantity Number (${maxTotal}).`);
                          setFormData({ ...formData, quantityHere: maxTotal });
                        } else {
                          setFormData({ ...formData, quantityHere: val });
                        }
                      }}
                      className="w-full px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)]"
                    />
                    <p className="text-[10px] text-[var(--muted)] mt-1">Max available: {formData.quantityTotal ?? 0}</p>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1 font-semibold">
                      MPN
                    </label>
                    <input
                      value={formData.mpn || ''}
                      onChange={(e) => setFormData({ ...formData, mpn: e.target.value })}
                      placeholder="e.g. ESP32-WROOM-32"
                      className="w-full px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1 font-semibold">
                      Manufacturer
                    </label>
                    <input
                      value={formData.manufacturer || ''}
                      onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                      placeholder="e.g. Espressif, Bosch, TI"
                      className="w-full px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)]"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1 font-semibold">
                      Note
                    </label>
                    <input
                      value={formData.generalNotes || ''}
                      onChange={(e) => setFormData({ ...formData, generalNotes: e.target.value })}
                      placeholder="Hardware specs, package type, or special considerations"
                      className="w-full px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)]"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: Ownership and current status */}
              <div>
                <div className="brand mb-2 border-b border-[var(--line)] pb-1">
                  OWNERSHIP AND CURRENT STATUS
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1 font-semibold">
                      Ownership *
                    </label>
                    <select
                      value={formData.ownership || 'Mine'}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setFormData({
                          ...formData,
                          ownership: val,
                          borrowedFrom: val === 'Borrowed' ? formData.borrowedFrom : '',
                        });
                      }}
                      className="w-full px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)]"
                    >
                      <option value="Mine">Mine</option>
                      <option value="Borrowed">Borrowed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1 font-semibold">
                      Current Status *
                    </label>
                    <select
                      value={formData.currentStatus || 'In Storage'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({
                          ...formData,
                          currentStatus: val,
                          lentTo: val === 'Lent Out' ? formData.lentTo : '',
                          lendingDate: val === 'Lent Out' ? formData.lendingDate : '',
                        });
                      }}
                      className="w-full px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)]"
                    >
                      {DEFAULT_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* CONDITIONAL: Borrowed From */}
                  {formData.ownership === 'Borrowed' && (
                    <div className="sm:col-span-2 p-3 rounded bg-[var(--panel2)] border border-[var(--cyan)]/40 space-y-1">
                      <label className="block text-[10px] uppercase tracking-wider text-[var(--cyan)] font-bold">
                        Borrowed From (Required) *
                      </label>
                      <input
                        required
                        value={formData.borrowedFrom || ''}
                        onChange={(e) => setFormData({ ...formData, borrowedFrom: e.target.value })}
                        placeholder="Name of person or laboratory owner"
                        className="w-full px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)]"
                      />
                    </div>
                  )}

                  {/* CONDITIONAL: Lent To & Date Lent */}
                  {(formData.currentStatus === 'Lent Out' || (Number(formData.quantityTotal || 0) > Number(formData.quantityHere || 0) && formData.ownership !== 'Borrowed')) && (
                    <div className="sm:col-span-2 p-3 rounded bg-[var(--panel2)] border border-[var(--amber)]/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[var(--amber)] flex items-center gap-1.5">
                          <span>📤 Active Custody Loan:</span>
                          <span className="underline">{Math.max(1, (Number(formData.quantityTotal) || 0) - (Number(formData.quantityHere) || 0))} unit(s) out of storage</span>
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-[var(--amber)] font-bold mb-1">
                            Lent To (Recipient Name) *
                          </label>
                          <input
                            required
                            value={formData.lentTo || ''}
                            onChange={(e) => setFormData({ ...formData, lentTo: e.target.value })}
                            placeholder="e.g. John Doe, Teammate, Capstone Group"
                            className="w-full px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider text-[var(--amber)] font-bold mb-1">
                            Date Lent
                          </label>
                          <input
                            type="date"
                            value={formData.lendingDate || ''}
                            onChange={(e) => setFormData({ ...formData, lendingDate: e.target.value })}
                            className="w-full px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)]"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-[var(--muted)] border-l-2 border-[var(--amber)] pl-2 mt-3">
                  Borrowed from appears for Borrowed ownership. Lent to details appear automatically whenever units are lent out or quantity total exceeds quantity here.
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isNew}
                  className="px-3 py-1.5 rounded border border-[var(--red)]/40 text-[var(--red)] hover:bg-[var(--red)]/10 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Delete
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="px-3 py-1.5 rounded border border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded font-bold bg-[var(--amber)] text-[#17120a] hover:bg-[#d97706]"
                  >
                    {isNew ? 'Add component' : 'Save changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR MODAL */}
      {qrModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-[var(--panel)] border border-[var(--line)] rounded-lg p-5 shadow-2xl text-center space-y-3">
            <h4 className="text-sm font-bold text-[var(--text)]">Component Storage QR Label</h4>
            {qrDataUrl && (
              <div className="p-3 bg-white rounded-lg inline-block border border-slate-300">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="QR Code" className="w-44 h-44 mx-auto" />
                <div className="text-slate-900 font-bold text-xs mt-1">{qrModalItem.sku}</div>
                <div className="text-slate-700 text-[11px] truncate max-w-[180px] mx-auto">
                  {qrModalItem.name}
                </div>
              </div>
            )}
            <div className="flex justify-center gap-2 pt-2">
              <button
                onClick={() => setQrModalItem(null)}
                className="px-3 py-1 text-xs border border-[var(--line)] rounded text-[var(--text)]"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-3.5 py-1 text-xs font-bold bg-[var(--amber)] text-[#17120a] rounded hover:bg-[#d97706]"
              >
                Print Label
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK LEND HARDWARE MODAL */}
      {quickLendOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[var(--panel)] border border-[var(--line)] rounded-lg p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div>
                <h3 className="text-base font-bold text-[var(--text)] flex items-center gap-2">
                  <span>📤 Lend Hardware to Someone</span>
                </h3>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  Record custody loan to a teammate, friend, or student.
                </p>
              </div>
              <button
                onClick={() => setQuickLendOpen(false)}
                className="p-1 text-[var(--muted)] hover:text-[var(--text)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickLendSubmit} className="space-y-3.5 text-xs">
              {/* Select component */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1">
                  Component (from available stock) *
                </label>
                <select
                  required
                  value={quickLendSelectedId}
                  onChange={(e) => {
                    const selId = e.target.value;
                    setQuickLendSelectedId(selId);
                    const comp = items.find((x) => x.id === selId);
                    if (comp) {
                      setQuickLendItem(comp);
                      setQuickLendForm((prev) => ({
                        ...prev,
                        quantity: Math.min(prev.quantity || 1, comp.quantityHere),
                      }));
                    }
                  }}
                  className="w-full px-2.5 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] focus:border-[var(--amber)]"
                >
                  <option value="">-- Choose Component --</option>
                  {items.map((c) => (
                    <option key={c.id} value={c.id} disabled={c.quantityHere <= 0}>
                      {c.name} ({c.sku}) — {c.quantityHere} {c.unit} available
                    </option>
                  ))}
                </select>
              </div>

              {/* Recipient Name */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[var(--amber)] font-bold mb-1">
                  Lent To (Recipient / Friend Name) *
                </label>
                <input
                  required
                  value={quickLendForm.recipient}
                  onChange={(e) => setQuickLendForm({ ...quickLendForm, recipient: e.target.value })}
                  placeholder="e.g. Guhan, Alex, Robot Team"
                  className="w-full px-2.5 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] focus:border-[var(--amber)]"
                />
              </div>

              {/* Quantity to Lend */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold">
                    Quantity to Lend *
                  </label>
                  {quickLendItem && (
                    <span className="text-[10px] text-[var(--green)]">
                      Available: {quickLendItem.quantityHere} {quickLendItem.unit}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  min="1"
                  max={quickLendItem ? quickLendItem.quantityHere : 9999}
                  required
                  value={quickLendForm.quantity}
                  onChange={(e) =>
                    setQuickLendForm({ ...quickLendForm, quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })
                  }
                  className="w-full px-2.5 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] focus:border-[var(--amber)] font-mono"
                />
              </div>

              {/* Expected Return Date */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1">
                  Expected Return Date (Optional)
                </label>
                <input
                  type="date"
                  value={quickLendForm.returnDate}
                  onChange={(e) => setQuickLendForm({ ...quickLendForm, returnDate: e.target.value })}
                  className="w-full px-2.5 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] focus:border-[var(--amber)]"
                />
              </div>

              {/* Notes / Purpose */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1">
                  Notes / Purpose
                </label>
                <input
                  value={quickLendForm.notes}
                  onChange={(e) => setQuickLendForm({ ...quickLendForm, notes: e.target.value })}
                  placeholder="e.g. Capstone project breadboard testing"
                  className="w-full px-2.5 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] focus:border-[var(--amber)]"
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setQuickLendOpen(false)}
                  className="px-3.5 py-1.5 rounded border border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickLendLoading || !quickLendSelectedId || !quickLendForm.recipient.trim()}
                  className="px-4 py-1.5 rounded font-bold bg-[var(--amber)] text-[#17120a] hover:bg-[#d97706] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {quickLendLoading ? 'Recording...' : 'Confirm Loan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StarkInventoryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-[var(--muted)]">Loading workspace...</div>}>
      <StarkInventoryContent />
    </Suspense>
  );
}
