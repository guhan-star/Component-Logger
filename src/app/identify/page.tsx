'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ScanLine, Search, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

export default function ComponentIdentifyPage() {
  const [marking, setMarking] = useState('');
  const [packageType, setPackageType] = useState('');
  const [notes, setNotes] = useState('');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [allItems, setAllItems] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/components?pageSize=200')
      .then((res) => res.json())
      .then((data) => setAllItems(data.components || data.data || []))
      .catch(console.error);
  }, []);

  const handleMatch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearched(true);
    const q = marking.toLowerCase().trim();
    if (!q) {
      setCandidates([]);
      return;
    }

    const matches = allItems.filter((item) => {
      const text = `${item.name} ${item.mpn || ''} ${item.genericPartNumber || ''} ${item.description || ''}`.toLowerCase();
      return text.includes(q);
    });

    setCandidates(matches.slice(0, 8));
  };

  return (
    <div className="space-y-4 text-xs">
      <div>
        <div className="brand">ASSISTED IDENTIFICATION</div>
        <h1 className="text-xl font-bold tracking-tight text-[var(--text)] mt-0.5">
          Component & IC identification
        </h1>
        <p className="text-xs text-[var(--muted)] mt-0.5">
          Capture visible markings and cross-reference against warehouse stock without auto-committing.
        </p>
      </div>

      <div className="p-4 rounded bg-[var(--panel)] border border-[var(--line)] space-y-4">
        <form onSubmit={handleMatch} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1">
                Visible IC / Silicon Marking *
              </label>
              <input
                required
                placeholder="e.g. ESP32, BME280, LM358, IRFZ44N, ATmega328P"
                value={marking}
                onChange={(e) => setMarking(e.target.value)}
                className="w-full px-2.5 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1">
                Package / Pin Count
              </label>
              <input
                placeholder="e.g. TO-220, SOIC-8, DIP-16, QFN-32"
                value={packageType}
                onChange={(e) => setPackageType(e.target.value)}
                className="w-full px-2.5 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] text-sm"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold mb-1">
                Notes & Recommended Verification Steps
              </label>
              <textarea
                rows={2}
                placeholder="Observed manufacturer logo, orientation dot, pin 1 notch, or test pin voltages..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)]"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="px-4 py-2 rounded font-bold bg-[var(--amber)] text-[#17120a] hover:bg-[#d97706] transition-colors"
            >
              Match Inventory
            </button>
          </div>
        </form>

        {searched && (
          <div className="pt-3 border-t border-[var(--line)] space-y-2">
            <div className="brand">CANDIDATE INVENTORY MATCHES</div>

            {candidates.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {candidates.map((c) => (
                  <div key={c.id} className="p-3 rounded bg-[var(--panel2)] border border-[var(--line)] flex justify-between items-start gap-2">
                    <div>
                      <strong className="mono text-[var(--amber)] text-xs block">{c.mpn || c.genericPartNumber}</strong>
                      <div className="font-semibold text-[var(--text)] text-xs mt-0.5">{c.name}</div>
                      <div className="text-[11px] text-[var(--muted)] mt-1">
                        Stock: <span className="text-[var(--green)] font-semibold">{c.quantityAvailable} {c.unitOfMeasurement || 'pcs'}</span>
                        {c.storageLocation && ` · Loc: ${c.storageLocation}`}
                      </div>
                    </div>
                    <Link
                      href={`/components/${c.id}`}
                      className="px-2 py-1 rounded bg-[var(--panel)] border border-[var(--line)] text-[var(--text)] hover:border-[var(--amber)] text-[11px] flex items-center gap-1 shrink-0"
                    >
                      Inspect <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded bg-[var(--panel2)] border border-[var(--line)] text-[var(--muted)]">
                No direct inventory match found for &quot;{marking}&quot;. You can register it using{' '}
                <Link href="/components?action=new" className="text-[var(--amber)] hover:underline font-semibold">
                  + Add Component
                </Link>.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
