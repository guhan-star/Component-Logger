// Unit conversion utilities for engineering values
// All values are stored in base SI units internally

export interface UnitDefinition {
  symbol: string;
  name: string;
  factor: number; // Multiply by this to convert TO base unit
  baseUnit: string;
}

export const UNIT_PREFIXES: Record<string, number> = {
  'p': 1e-12,  // pico
  'n': 1e-9,   // nano
  'µ': 1e-6,   // micro
  'u': 1e-6,   // micro (ascii)
  'm': 1e-3,   // milli
  '': 1,       // base
  'k': 1e3,    // kilo
  'K': 1e3,    // kilo (alt)
  'M': 1e6,    // mega
  'G': 1e9,    // giga
  'T': 1e12,   // tera
};

export const UNIT_FAMILIES: Record<string, { baseUnit: string; units: UnitDefinition[] }> = {
  resistance: {
    baseUnit: 'Ω',
    units: [
      { symbol: 'mΩ', name: 'milliohm', factor: 1e-3, baseUnit: 'Ω' },
      { symbol: 'Ω', name: 'ohm', factor: 1, baseUnit: 'Ω' },
      { symbol: 'kΩ', name: 'kilohm', factor: 1e3, baseUnit: 'Ω' },
      { symbol: 'MΩ', name: 'megaohm', factor: 1e6, baseUnit: 'Ω' },
      { symbol: 'GΩ', name: 'gigaohm', factor: 1e9, baseUnit: 'Ω' },
    ],
  },
  capacitance: {
    baseUnit: 'F',
    units: [
      { symbol: 'pF', name: 'picofarad', factor: 1e-12, baseUnit: 'F' },
      { symbol: 'nF', name: 'nanofarad', factor: 1e-9, baseUnit: 'F' },
      { symbol: 'µF', name: 'microfarad', factor: 1e-6, baseUnit: 'F' },
      { symbol: 'mF', name: 'millifarad', factor: 1e-3, baseUnit: 'F' },
      { symbol: 'F', name: 'farad', factor: 1, baseUnit: 'F' },
    ],
  },
  inductance: {
    baseUnit: 'H',
    units: [
      { symbol: 'nH', name: 'nanohenry', factor: 1e-9, baseUnit: 'H' },
      { symbol: 'µH', name: 'microhenry', factor: 1e-6, baseUnit: 'H' },
      { symbol: 'mH', name: 'millihenry', factor: 1e-3, baseUnit: 'H' },
      { symbol: 'H', name: 'henry', factor: 1, baseUnit: 'H' },
    ],
  },
  voltage: {
    baseUnit: 'V',
    units: [
      { symbol: 'µV', name: 'microvolt', factor: 1e-6, baseUnit: 'V' },
      { symbol: 'mV', name: 'millivolt', factor: 1e-3, baseUnit: 'V' },
      { symbol: 'V', name: 'volt', factor: 1, baseUnit: 'V' },
      { symbol: 'kV', name: 'kilovolt', factor: 1e3, baseUnit: 'V' },
    ],
  },
  current: {
    baseUnit: 'A',
    units: [
      { symbol: 'nA', name: 'nanoamp', factor: 1e-9, baseUnit: 'A' },
      { symbol: 'µA', name: 'microamp', factor: 1e-6, baseUnit: 'A' },
      { symbol: 'mA', name: 'milliamp', factor: 1e-3, baseUnit: 'A' },
      { symbol: 'A', name: 'amp', factor: 1, baseUnit: 'A' },
    ],
  },
  power: {
    baseUnit: 'W',
    units: [
      { symbol: 'µW', name: 'microwatt', factor: 1e-6, baseUnit: 'W' },
      { symbol: 'mW', name: 'milliwatt', factor: 1e-3, baseUnit: 'W' },
      { symbol: 'W', name: 'watt', factor: 1, baseUnit: 'W' },
      { symbol: 'kW', name: 'kilowatt', factor: 1e3, baseUnit: 'W' },
    ],
  },
  frequency: {
    baseUnit: 'Hz',
    units: [
      { symbol: 'Hz', name: 'hertz', factor: 1, baseUnit: 'Hz' },
      { symbol: 'kHz', name: 'kilohertz', factor: 1e3, baseUnit: 'Hz' },
      { symbol: 'MHz', name: 'megahertz', factor: 1e6, baseUnit: 'Hz' },
      { symbol: 'GHz', name: 'gigahertz', factor: 1e9, baseUnit: 'Hz' },
    ],
  },
  memory: {
    baseUnit: 'B',
    units: [
      { symbol: 'B', name: 'byte', factor: 1, baseUnit: 'B' },
      { symbol: 'KB', name: 'kilobyte', factor: 1024, baseUnit: 'B' },
      { symbol: 'MB', name: 'megabyte', factor: 1048576, baseUnit: 'B' },
      { symbol: 'GB', name: 'gigabyte', factor: 1073741824, baseUnit: 'B' },
    ],
  },
  length: {
    baseUnit: 'mm',
    units: [
      { symbol: 'mm', name: 'millimeter', factor: 1, baseUnit: 'mm' },
      { symbol: 'cm', name: 'centimeter', factor: 10, baseUnit: 'mm' },
      { symbol: 'm', name: 'meter', factor: 1000, baseUnit: 'mm' },
      { symbol: 'in', name: 'inch', factor: 25.4, baseUnit: 'mm' },
      { symbol: 'ft', name: 'foot', factor: 304.8, baseUnit: 'mm' },
    ],
  },
  temperature: {
    baseUnit: '°C',
    units: [
      { symbol: '°C', name: 'celsius', factor: 1, baseUnit: '°C' },
    ],
  },
};

/**
 * Convert a value from one unit to base unit
 */
export function toBaseUnit(value: number, unit: string): number {
  for (const family of Object.values(UNIT_FAMILIES)) {
    const unitDef = family.units.find(u => u.symbol === unit);
    if (unitDef) {
      return value * unitDef.factor;
    }
  }
  return value; // Unknown unit, return as-is
}

/**
 * Convert a value from base unit to display unit
 */
export function fromBaseUnit(value: number, unit: string): number {
  for (const family of Object.values(UNIT_FAMILIES)) {
    const unitDef = family.units.find(u => u.symbol === unit);
    if (unitDef) {
      return value / unitDef.factor;
    }
  }
  return value;
}

/**
 * Find the best engineering unit for display
 */
export function toBestUnit(value: number, unitFamily: string): { value: number; unit: string } {
  const family = UNIT_FAMILIES[unitFamily];
  if (!family) return { value, unit: '' };
  
  // Sort units by factor descending
  const sorted = [...family.units].sort((a, b) => b.factor - a.factor);
  
  for (const unitDef of sorted) {
    const converted = value / unitDef.factor;
    if (Math.abs(converted) >= 1 && Math.abs(converted) < 1000) {
      return { value: converted, unit: unitDef.symbol };
    }
  }
  
  // Fallback to base unit
  return { value, unit: family.baseUnit };
}

/**
 * Format a numeric value with appropriate precision
 */
export function formatEngValue(value: number, unit: string, unitFamily?: string): string {
  if (unitFamily) {
    const best = toBestUnit(value, unitFamily);
    const formatted = best.value % 1 === 0 
      ? best.value.toString() 
      : best.value.toPrecision(4).replace(/\.?0+$/, '');
    return `${formatted} ${best.unit}`;
  }
  
  const formatted = value % 1 === 0 
    ? value.toString() 
    : value.toPrecision(4).replace(/\.?0+$/, '');
  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Parse an engineering value string like "10kΩ" or "100 nF"
 */
export function parseEngValue(input: string): { value: number; unit: string } | null {
  const match = input.trim().match(/^([0-9]*\.?[0-9]+)\s*(.*)$/);
  if (!match) return null;
  
  const numValue = parseFloat(match[1]);
  const unitStr = match[2].trim();
  
  if (isNaN(numValue)) return null;
  
  return { value: numValue, unit: unitStr };
}

/**
 * Get units for a specific family
 */
export function getUnitsForFamily(family: string): UnitDefinition[] {
  return UNIT_FAMILIES[family]?.units ?? [];
}

/**
 * Find which unit family a unit belongs to
 */
export function findUnitFamily(unit: string): string | null {
  for (const [familyName, family] of Object.entries(UNIT_FAMILIES)) {
    if (family.units.some(u => u.symbol === unit)) {
      return familyName;
    }
  }
  return null;
}
