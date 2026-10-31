'use client';

import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Database,
  ArrowRight,
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function StarkImportExportPage() {
  const [stagedRows, setStagedRows] = useState<any[]>([]);
  const [statusMessage, setStatusMessage] = useState('Choose a CSV or XLSX. Rows are staged locally and are not written until you confirm.');
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<string | null>(null);

  const handleLoadSample = () => {
    const sample = [
      {
        sku: 'COMP-004',
        name: 'Arduino Nano Every (ATmega4809)',
        category: 'Microcontroller',
        componentType: 'Development Board',
        quantityTotal: 4,
        unit: 'Board',
        unitPrice: 850,
        totalPrice: 3400,
        ownership: 'Mine',
        currentStatus: 'In Storage',
        storageDescription: 'Main Lab · Rack R-02',
        generalNotes: '5V 20MHz AVR with 48KB flash',
      },
      {
        sku: 'COMP-005',
        name: 'DHT22 Digital Temperature & Humidity Sensor AM2302',
        category: 'Sensor',
        componentType: 'Environmental',
        quantityTotal: 6,
        unit: 'Module',
        unitPrice: 220,
        totalPrice: 1320,
        ownership: 'Mine',
        currentStatus: 'In Storage',
        storageDescription: 'Box S - Bin 2',
        generalNotes: '1-wire bus output',
      },
    ];

    setStagedRows(sample);
    setStatusMessage('2 valid staged rows from sample data. Review complete; ready to commit.');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    const isXlsx = /\.xlsx?$/i.test(file.name);

    reader.onload = (evt) => {
      try {
        let rows: any[] = [];
        if (isXlsx) {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
        } else {
          const text = evt.target?.result as string;
          const lines = text.split(/\r?\n/).filter(Boolean);
          const headers = lines.shift()?.split(',').map((h) => h.replace(/(^"|"$)/g, '').trim()) || [];
          rows = lines.map((line) => {
            const cells = line.split(',').map((c) => c.replace(/(^"|"$)/g, '').trim());
            const obj: Record<string, string> = {};
            headers.forEach((h, i) => {
              obj[h] = cells[i] || '';
            });
            return obj;
          });
        }

        const normalized = rows.map((o: any, idx: number) => {
          const getVal = (...keys: string[]) => {
            const matchedKey = Object.keys(o).find((k) =>
              keys.includes(k.toLowerCase().trim())
            );
            return matchedKey ? o[matchedKey] : '';
          };

          const total = Number(getVal('quantity number', 'quantity total', 'quantity', 'qty') || 1);
          const price = Number(getVal('price per unit', 'unit price', 'price') || 0);

          return {
            sku: getVal('component id', 'sku', 'mpn') || `IMP-${String(idx + 1).padStart(3, '0')}`,
            name: getVal('component name', 'name', 'title') || 'Imported Component',
            category: getVal('type', 'category') || 'General',
            quantityTotal: total,
            quantityHere: total,
            unit: getVal('quantity unit', 'unit') || 'Piece',
            unitPrice: price,
            totalPrice: Number(getVal('total value', 'total price') || total * price),
            ownership: getVal('ownership') || 'Mine',
            currentStatus: getVal('current status', 'status') || 'In Storage',
            borrowedFrom: getVal('borrowed from'),
            lentTo: getVal('lent to'),
            lendingDate: getVal('date lent'),
            storageDescription: getVal('storage', 'storage location', 'location'),
            generalNotes: getVal('note', 'notes'),
          };
        });

        setStagedRows(normalized);
        setStatusMessage(`${normalized.length} row(s) staged from ${file.name}. Review below before committing.`);
      } catch (err) {
        console.error(err);
        setStatusMessage('Error parsing file. Please check file format.');
      }
    };

    if (isXlsx) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleCommit = async () => {
    if (stagedRows.length === 0) return;
    setIsCommitting(true);

    try {
      let added = 0;
      for (const row of stagedRows) {
        const res = await fetch('/api/components', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: row.name,
            mpn: row.sku,
            genericPartNumber: row.sku,
            quantityOwned: Number(row.quantityTotal) || 0,
            quantityAvailable: Number(row.quantityHere) || Number(row.quantityTotal) || 0,
            unitCost: Number(row.unitPrice) || 0,
            unitOfMeasurement: row.unit || 'Piece',
            condition: 'New',
            ownershipType: row.ownership === 'Borrowed' ? 'Borrowed' : 'Personal',
            storageLocation: row.storageDescription || null,
            notes: row.generalNotes || null,
          }),
        });
        if (res.ok) added++;
      }

      setCommitResult(`Successfully committed ${added} component(s) to live database!`);
      setStagedRows([]);
      setStatusMessage('Batch import completed.');
    } catch (err) {
      console.error(err);
      setCommitResult('Error occurred while committing components.');
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="space-y-4 text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="brand">DATA / TRANSFER</div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text)] mt-0.5">
            Import and export
          </h1>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            Import component fields from CSV or XLSX with local review-before-commit staging.
          </p>
        </div>

        <button
          onClick={handleLoadSample}
          className="px-3.5 py-1.5 rounded border border-[var(--line)] bg-[var(--panel2)] hover:border-[var(--amber)] text-[var(--text)] font-medium"
        >
          Load sample data
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* IMPORT WIZARD */}
        <div className="p-4 rounded bg-[var(--panel)] border border-[var(--line)] space-y-3">
          <div className="brand border-b border-[var(--line)] pb-1">IMPORT WIZARD</div>

          <label className="block cursor-pointer">
            <div className="border border-dashed border-[var(--line)] hover:border-[var(--amber)] rounded p-4 text-center bg-[var(--bg)] transition-colors">
              <Upload className="w-5 h-5 mx-auto mb-1 text-[var(--amber)]" />
              <div className="font-semibold text-[var(--text)]">Choose a CSV or XLSX spreadsheet</div>
              <div className="text-[11px] text-[var(--muted)]">Click to browse your files</div>
              <input
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </label>

          <div className="p-2.5 rounded bg-[var(--panel2)] border border-[var(--line)] text-[11px] text-[var(--muted)] font-mono">
            {statusMessage}
          </div>

          {stagedRows.length > 0 && (
            <button
              onClick={handleCommit}
              disabled={isCommitting}
              className="w-full py-2 rounded font-bold bg-[var(--amber)] text-[#17120a] hover:bg-[#d97706] disabled:opacity-50"
            >
              {isCommitting ? 'Committing to database...' : `Commit ${stagedRows.length} valid rows`}
            </button>
          )}

          {commitResult && (
            <div className="p-2.5 rounded bg-[var(--green)]/10 border border-[var(--green)]/30 text-[var(--green)] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{commitResult}</span>
            </div>
          )}
        </div>

        {/* SUPPORTED FIELDS PANEL */}
        <div className="p-4 rounded bg-[var(--panel)] border border-[var(--line)] space-y-3">
          <div className="brand border-b border-[var(--line)] pb-1">SUPPORTED SPREADSHEET HEADERS</div>

          <div className="p-3 rounded bg-[var(--bg)] border border-[var(--line)] font-mono text-[11px] text-[var(--text)] leading-relaxed">
            Component ID, Component Name, Quantity Number, Quantity Unit, Price Per Unit, Total Value, Type, Ownership, Borrowed From, Lent To, Date Lent, Note, Current Status
          </div>

          <p className="text-[11px] text-[var(--muted)] leading-relaxed">
            Custom dropdown values in imported spreadsheets are automatically added to that field&apos;s options for all future components.
          </p>

          <div className="pt-2 border-t border-[var(--line)] flex gap-2">
            <a
              href="/api/export?format=csv"
              className="px-3 py-1.5 rounded border border-[var(--line)] bg-[var(--panel2)] hover:border-[var(--amber)] text-[var(--text)]"
            >
              Export CSV
            </a>
            <a
              href="/api/export?format=json"
              className="px-3 py-1.5 rounded border border-[var(--line)] bg-[var(--panel2)] hover:border-[var(--amber)] text-[var(--text)]"
            >
              Export JSON Backup
            </a>
          </div>
        </div>
      </div>

      {/* STAGED ROWS PREVIEW TABLE */}
      {stagedRows.length > 0 && (
        <div className="p-4 rounded bg-[var(--panel)] border border-[var(--line)] space-y-2">
          <div className="brand">STAGED ROWS REVIEW (NOT YET COMMITTED)</div>
          <div className="overflow-x-auto border border-[var(--line)] rounded">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--panel2)] text-[10px] uppercase font-semibold text-[var(--muted)] border-b border-[var(--line)]">
                <tr>
                  <th className="p-2">SKU</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Qty</th>
                  <th className="p-2">Price</th>
                  <th className="p-2">Ownership</th>
                  <th className="p-2">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {stagedRows.map((r, i) => (
                  <tr key={i} className="hover:bg-[var(--panel2)] font-mono text-[11px]">
                    <td className="p-2 text-[var(--amber)] font-bold">{r.sku}</td>
                    <td className="p-2 text-[var(--text)]">{r.name}</td>
                    <td className="p-2 text-[var(--muted)]">{r.category}</td>
                    <td className="p-2 text-[var(--green)]">{r.quantityTotal} {r.unit}</td>
                    <td className="p-2">₹{r.unitPrice}</td>
                    <td className="p-2">{r.ownership}</td>
                    <td className="p-2 text-[var(--muted)]">{r.storageDescription || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
