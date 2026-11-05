'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { SlidersHorizontal, Plus, Trash2, Palette, ArrowRight } from 'lucide-react';

const DROPDOWN_DATASETS: Record<string, string[]> = {
  category: ['Microcontroller', 'Sensor', 'Power', 'Passive', 'Connector', 'Semiconductor', 'Display', 'Communication', 'Tool', 'Module'],
  componentType: ['Development Board', 'Sensor Module', 'Power Module', 'Breakout', 'Through-Hole IC', 'SMD IC', 'Discrete'],
  unit: ['Piece', 'Board', 'Module', 'Pack', 'Set', 'Pair', 'Meter', 'Centimeter', 'Roll', 'Box'],
  currency: ['INR', 'USD', 'EUR'],
  protocol: ['I2C', 'SPI', 'UART', 'USB-C', 'Wi-Fi', 'BLE', 'CAN', 'GPIO', 'PWM', 'ADC', '1-Wire'],
  connectorType: ['USB-C', 'Micro-USB', 'Header Pins 2.54mm', 'JST-XH', 'Screw Terminal', 'SMA', 'DC Barrel 5.5x2.1mm'],
  cableType: ['Dupont Jumper M-M', 'Dupont Jumper M-F', 'Dupont Jumper F-F', 'Ribbon Cable', 'USB-A to USB-C', 'RG316 Coaxial'],
  condition: ['New', 'Good', 'Used', 'Salvaged', 'Needs Repair'],
  status: ['In Storage', 'In Use', 'Lent Out', 'Borrowed and In Use', 'Returned', 'Lost', 'Damaged'],
  ownership: ['Mine', 'Borrowed', 'Lent'],
  manufacturer: ['Espressif Systems', 'Texas Instruments', 'STMicroelectronics', 'Bosch Sensortec', 'Microchip', 'Vishay', 'Adafruit'],
  supplier: ['Robu.in', 'Mouser Electronics', 'DigiKey', 'Element14'],
  borrower: [],
  lender: [],
};

export default function StarkDropdownManagementPage() {
  const [datasets, setDatasets] = useState<Record<string, string[]>>(DROPDOWN_DATASETS);
  const [selectedKey, setSelectedKey] = useState<string>('category');
  const [newOption, setNewOption] = useState<string>('');

  useEffect(() => {
    // Load persisted custom dropdowns from localStorage if available
    const saved = localStorage.getItem('stark_custom_dropdowns');
    if (saved) {
      try {
        setDatasets((prev) => ({ ...prev, ...JSON.parse(saved) }));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleAddOption = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newOption.trim();
    if (!trimmed) return;

    setDatasets((prev) => {
      const currentList = prev[selectedKey] || [];
      if (currentList.some((x) => x.toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }
      const updated = {
        ...prev,
        [selectedKey]: [...currentList, trimmed],
      };
      localStorage.setItem('stark_custom_dropdowns', JSON.stringify(updated));
      return updated;
    });

    setNewOption('');
  };

  const handleRemoveOption = (valToRemove: string) => {
    setDatasets((prev) => {
      const updated = {
        ...prev,
        [selectedKey]: (prev[selectedKey] || []).filter((x) => x !== valToRemove),
      };
      localStorage.setItem('stark_custom_dropdowns', JSON.stringify(updated));
      return updated;
    });
  };

  const currentValues = datasets[selectedKey] || [];

  return (
    <div className="space-y-4 text-xs max-w-[1500px] mx-auto">
      {/* Header */}
      <div>
        <div className="brand">CONFIGURATION / TAXONOMY &amp; SETTINGS</div>
        <h1 className="text-xl font-bold tracking-tight text-[var(--text)] mt-0.5">
          System Settings &amp; Dropdown Taxonomy
        </h1>
        <p className="text-xs text-[var(--muted)] mt-0.5">
          Manage system categorization, component taxonomies, and view appearance routing.
        </p>
      </div>

      {/* Theme Settings Consolidation Notice Banner */}
      <div className="p-4 rounded-xl bg-[var(--panel)] border border-[var(--line)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[var(--amber)]/10 border border-[var(--amber)]/30 flex items-center justify-center shrink-0">
            <Palette className="w-5 h-5 text-[var(--amber)]" />
          </div>
          <div>
            <div className="font-bold text-xs text-[var(--text)]">Appearance &amp; Theme Mode</div>
            <div className="text-[11px] text-[var(--muted)]">
              Light and Dark theme settings are consolidated exclusively in Profile → Settings → Appearance.
            </div>
          </div>
        </div>
        <Link
          href="/profile?tab=preferences"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--panel2)] hover:bg-[var(--line)] border border-[var(--line)] hover:border-[var(--amber)] text-xs font-semibold text-[var(--text)] transition-colors shrink-0"
        >
          <span>Open Appearance Settings</span>
          <ArrowRight className="w-3.5 h-3.5 text-[var(--amber)]" />
        </Link>
      </div>

      {/* Master Data Management */}
      <div className="p-4 rounded-xl bg-[var(--panel)] border border-[var(--line)] space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
          <div className="font-bold text-xs uppercase tracking-wider text-[var(--text)] flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[var(--amber)]" />
            Master Dataset Values
          </div>
          <span className="text-[10px] font-mono text-[var(--muted)]">
            {Object.keys(datasets).length} Active Categories
          </span>
        </div>

        <form onSubmit={handleAddOption} className="flex flex-col sm:flex-row items-center gap-2">
          <select
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            className="w-full sm:w-64 px-2.5 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-[var(--text)] font-semibold text-xs"
          >
            {Object.keys(datasets).map((k) => (
              <option key={k} value={k}>
                {k} ({datasets[k]?.length || 0})
              </option>
            ))}
          </select>

          <input
            placeholder={`Add new option to ${selectedKey}...`}
            value={newOption}
            onChange={(e) => setNewOption(e.target.value)}
            className="flex-1 px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-[var(--text)] text-xs"
          />

          <button
            type="submit"
            className="px-4 py-2 rounded-lg font-bold bg-[var(--amber)] text-[#17120a] hover:bg-[#d97706] shrink-0 text-xs transition-colors"
          >
            Add Option
          </button>
        </form>

        <div className="brand border-b border-[var(--line)] pb-1 pt-2">
          ACTIVE DATASET VALUES FOR: <span className="text-[var(--text)]">{selectedKey}</span>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {currentValues.map((val) => (
            <span
              key={val}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--panel2)] border border-[var(--line)] text-xs text-[var(--text)]"
            >
              <span>{val}</span>
              <button
                type="button"
                onClick={() => handleRemoveOption(val)}
                className="text-[var(--muted)] hover:text-[var(--red)] transition-colors"
                title={`Remove ${val}`}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          ))}
          {currentValues.length === 0 && (
            <span className="text-xs text-[var(--muted)] italic">
              No custom entries recorded. Add values above to populate dropdowns.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
