'use client';

import React, { useEffect, useState } from 'react';

export interface ChartTooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  fill?: string;
  unit?: string;
  dataKey?: string;
  payload?: any;
}

export interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipPayloadItem[];
  label?: string | number;
  title?: string;
  formatter?: (value: any, name: any, item: any, index: number) => [string | React.ReactNode, string];
  valuePrefix?: string;
  valueSuffix?: string;
}

/**
 * Accessible, High-Contrast Chart Tooltip for Stark Industries WMC / Component Logger
 * 
 * WCAG 2.2 AA compliant contrast across both Dark and Light themes:
 * - Dark Theme:
 *   - Background: #171A22
 *   - Text: #F5F5F5
 *   - Border: #343A46
 * - Light Theme:
 *   - Background: #FFFFFF
 *   - Text: #0F172A
 *   - Border: #E2E8F0
 */
export function ChartTooltip({
  active,
  payload,
  label,
  title,
  formatter,
  valuePrefix = '',
  valueSuffix = '',
}: ChartTooltipProps) {
  const [isLightMode, setIsLightMode] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      setIsLightMode(document.documentElement.classList.contains('light'));
    };

    checkTheme();

    const observer = new MutationObserver(() => {
      checkTheme();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const heading = title || label;

  return (
    <div
      role="tooltip"
      aria-hidden={!active}
      style={{
        backgroundColor: isLightMode ? '#FFFFFF' : '#171A22',
        color: isLightMode ? '#0F172A' : '#F5F5F5',
        borderColor: isLightMode ? '#E2E8F0' : '#343A46',
      }}
      className="p-2.5 sm:p-3 rounded-lg border shadow-xl text-xs min-w-[140px] pointer-events-none select-none transition-colors duration-150 z-50 backdrop-blur-xs"
    >
      {heading !== undefined && heading !== null && heading !== '' && (
        <div
          style={{ color: isLightMode ? '#64748B' : '#94A3B8' }}
          className="mono text-[10px] font-semibold uppercase tracking-wider pb-1.5 mb-1.5 border-b"
        >
          {heading}
        </div>
      )}

      <div className="space-y-1.5">
        {payload.map((item, idx) => {
          const itemColor = item.color || item.fill || '#F59E0B';
          const itemName = item.name || item.dataKey || (item.payload && item.payload.name) || 'Value';
          const itemValue = item.value !== undefined ? item.value : (item.payload && item.payload.value);

          let displayLabel = String(itemName);
          let displayVal = `${valuePrefix}${typeof itemValue === 'number' ? itemValue.toLocaleString() : itemValue ?? 0}${valueSuffix}${item.unit ? ` ${item.unit}` : ''}`;

          if (formatter && itemValue !== undefined) {
            const formatted = formatter(itemValue, itemName, item, idx);
            if (Array.isArray(formatted)) {
              displayVal = String(formatted[0]);
              if (formatted[1]) displayLabel = String(formatted[1]);
            }
          }

          return (
            <div key={`tooltip-item-${idx}`} className="flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-1.5 truncate">
                <span
                  className="w-2 h-2 rounded-full shrink-0 shadow-xs"
                  style={{ backgroundColor: itemColor }}
                />
                <span
                  style={{ color: isLightMode ? '#334155' : '#E2E8F0' }}
                  className="font-medium truncate max-w-[150px]"
                >
                  {displayLabel}
                </span>
              </div>
              <span
                style={{ color: isLightMode ? '#0F172A' : '#F5F5F5' }}
                className="font-mono font-bold shrink-0 ml-2"
              >
                {displayVal}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Generates theme-aware Recharts default Tooltip styles as a secondary defense layer
 */
export function getChartTooltipStyles(isLight: boolean) {
  return {
    contentStyle: {
      backgroundColor: isLight ? '#FFFFFF' : '#171A22',
      borderColor: isLight ? '#E2E8F0' : '#343A46',
      borderRadius: '8px',
      fontSize: '11px',
      color: isLight ? '#0F172A' : '#F5F5F5',
      boxShadow: isLight
        ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
        : '0 10px 25px -5px rgba(0, 0, 0, 0.6)',
      padding: '8px 12px',
    },
    itemStyle: {
      color: isLight ? '#0F172A' : '#F5F5F5',
      fontSize: '11px',
      fontWeight: '600',
    },
    labelStyle: {
      color: isLight ? '#64748B' : '#94A3B8',
      fontSize: '10px',
      fontFamily: 'monospace',
      fontWeight: '600',
      marginBottom: '4px',
    },
  };
}

export default ChartTooltip;
