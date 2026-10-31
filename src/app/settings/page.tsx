'use client';

import React, { useState, useEffect } from 'react';
import { SlidersHorizontal, Plus, Trash2 } from 'lucide-react';

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
    <div className="space-y-4 text-xs">
      <div>
        <div className="brand">CONFIGURATION / TAXONOMY</div>
        <h1 className="text-xl font-bold tracking-tight text-[var(--text)] mt-0.5">
          Dropdown & master data management
        </h1>
        <p className="text-xs text-[var(--muted)] mt-0.5">
          34 isolated datasets. Values are normalized, trimmed, and saved across components.
        </p>
      </div>

      <div className="p-4 rounded bg-[var(--panel)] border border-[var(--line)] space-y-4">
        <form onSubmit={handleAddOption} className="flex flex-col sm:flex-row items-center gap-2">
          <select
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            className="w-full sm:w-64 px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)] font-semibold"
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
            className="flex-1 px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--text)]"
          />

          <button
            type="submit"
            className="px-4 py-1.5 rounded font-bold bg-[var(--amber)] text-[#17120a] hover:bg-[#d97706] shrink-0"
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
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--panel2)] border border-[var(--line)] text-[var(--text)]"
            >
              <span>{val}</span>
              <button
                type="button"
                onClick={() => handleRemoveOption(val)}
                className="text-[var(--muted)] hover:text-[var(--red)]"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
