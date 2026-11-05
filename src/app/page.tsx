'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Boxes,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Clock,
  MapPin,
  TrendingUp,
  Activity,
  Plus,
  ArrowRight,
  FileText,
  Package,
  FolderKanban,
  ShoppingCart,
  FileSpreadsheet,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import ChartTooltip from '@/components/chart-tooltip';

interface StatsSummary {
  totalOwnedQuantity: number;
  uniqueComponents: number;
  availableQuantity: number;
  reservedQuantity: number;
  borrowedCount: number;
  lentCount: number;
  attentionCount: number;
  purchaseItemsCount: number;
  totalValuation: number;
  storageLocationsCount: number;
}

interface CategoryStat {
  category: string;
  count: number;
  totalQty: number;
  percentage: number;
}

interface StorageStat {
  location: string;
  componentCount: number;
  totalQuantity: number;
}

interface AttentionItem {
  id: string;
  componentId?: string;
  name: string;
  sku?: string | null;
  reason: string;
  type: 'critical' | 'warning' | 'info';
  dateOrQty?: string;
}

interface TransactionItem {
  id: string;
  transactionType: string;
  quantity: number;
  createdAt: string;
  notes?: string | null;
  component?: {
    id: string;
    name: string;
    sku?: string | null;
    category?: string;
  } | null;
}

interface HistoryPoint {
  date: string;
  fullDate: string;
  stockCount: number;
  activityCount: number;
}

const CATEGORY_COLORS = [
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#3b82f6', // Blue
  '#eab308', // Yellow
  '#14b8a6', // Teal
];

export default function OverviewDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [categories, setCategories] = useState<CategoryStat[]>([]);
  const [storageList, setStorageList] = useState<StorageStat[]>([]);
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<TransactionItem[]>([]);
  const [historySeries, setHistorySeries] = useState<HistoryPoint[]>([]);
  const [timeRange, setTimeRange] = useState<'7' | '30' | '90'>('30');

  useEffect(() => {
    fetch('/api/stats')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load stats');
        return res.json();
      })
      .then((data) => {
        setSummary(data.summary || null);
        setCategories(data.categoryBreakdown || []);
        setStorageList(data.storageDistribution || []);
        setAttentionItems(data.attentionItems || []);
        setRecentTransactions(data.recentTransactions || []);
        setHistorySeries(data.historySeries || []);
      })
      .catch((err) => {
        console.error('Overview dashboard stats fetch error:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Filter history series based on chosen timeRange
  const displayedHistory = React.useMemo(() => {
    if (!historySeries.length) return [];
    const days = parseInt(timeRange, 10);
    return historySeries.slice(-days);
  }, [historySeries, timeRange]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {/* Header skeleton */}
        <div className="h-8 bg-[var(--panel)] rounded w-64 border border-[var(--line)]" />
        {/* KPI skeletons */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-[var(--panel)] rounded-xl border border-[var(--line)]" />
          ))}
        </div>
        {/* Main chart skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 h-80 bg-[var(--panel)] rounded-xl border border-[var(--line)]" />
          <div className="h-80 bg-[var(--panel)] rounded-xl border border-[var(--line)]" />
        </div>
      </div>
    );
  }

  const totalComponents = summary?.totalOwnedQuantity || 0;
  const uniqueSKUs = summary?.uniqueComponents || 0;
  const availableQty = summary?.availableQuantity || 0;
  const attentionCount = summary?.attentionCount || 0;

  return (
    <div className="space-y-4 max-w-[1780px] mx-auto text-xs">
      {/* 1. MOVEON-INSPIRED PAGE SUB-HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-[var(--line)]">
        <div>
          <div className="brand flex items-center gap-1.5">
            <span>TERMINAL OVERVIEW</span>
            <span className="text-[var(--line)]">/</span>
            <span className="text-[var(--text)]">LAB WAREHOUSE #1</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[var(--text)] uppercase mt-0.5">
            Overview
          </h1>
          <p className="text-xs text-[var(--muted)]">
            Your component inventory, custody allocations, and warehouse telemetry at a glance.
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/components?action=new"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold bg-[var(--amber)] text-[#17120a] hover:bg-amber-400 active:scale-95 transition-all text-xs shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Component</span>
          </Link>

          <Link
            href="/components"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] hover:border-[var(--amber)] text-[var(--text)] font-semibold text-xs transition-colors"
          >
            <Boxes className="w-3.5 h-3.5 text-[var(--muted)]" />
            <span>Open Inventory</span>
          </Link>
        </div>
      </div>

      {/* 2. TOP 4 KPI CARDS (MOVEON INDUSTRIAL ARCHITECTURE) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* CARD 1: Total Components (Owned physical quantity) */}
        <div className="p-3.5 rounded-xl bg-[var(--panel)] border border-[var(--line)] hover:border-[var(--line-strong)] transition-all">
          <div className="flex items-center justify-between text-[var(--muted)]">
            <span className="font-mono text-[10px] uppercase tracking-wider font-semibold">
              Total Units Owned
            </span>
            <div className="w-6 h-6 rounded-md bg-[var(--amber)]/10 border border-[var(--amber)]/20 flex items-center justify-center text-[var(--amber)]">
              <Package className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl lg:text-3xl font-black text-[var(--text)] tracking-tight">
              {totalComponents.toLocaleString()}
            </span>
            <span className="text-[10px] text-[var(--muted)] font-mono">physical units</span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
            <span className="text-emerald-400 font-bold font-mono">
              ₹{(summary?.totalValuation || 0).toLocaleString()}
            </span>
            <span>valuation</span>
          </div>
        </div>

        {/* CARD 2: Unique Components / SKUs */}
        <div className="p-3.5 rounded-xl bg-[var(--panel)] border border-[var(--line)] hover:border-[var(--line-strong)] transition-all">
          <div className="flex items-center justify-between text-[var(--muted)]">
            <span className="font-mono text-[10px] uppercase tracking-wider font-semibold">
              Unique SKUs / Models
            </span>
            <div className="w-6 h-6 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Boxes className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl lg:text-3xl font-black text-[var(--text)] tracking-tight">
              {uniqueSKUs.toLocaleString()}
            </span>
            <span className="text-[10px] text-[var(--muted)] font-mono">distinct records</span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
            <span className="text-[var(--text)] font-semibold font-mono">
              {categories.length}
            </span>
            <span>active categories</span>
          </div>
        </div>

        {/* CARD 3: Available Components */}
        <div className="p-3.5 rounded-xl bg-[var(--panel)] border border-[var(--line)] hover:border-[var(--line-strong)] transition-all">
          <div className="flex items-center justify-between text-[var(--muted)]">
            <span className="font-mono text-[10px] uppercase tracking-wider font-semibold">
              Available in Lab
            </span>
            <div className="w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl lg:text-3xl font-black text-emerald-400 tracking-tight">
              {availableQty.toLocaleString()}
            </span>
            <span className="text-[10px] text-[var(--muted)] font-mono">unallocated units</span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
            <span className="text-[var(--amber)] font-bold font-mono">
              {summary?.reservedQuantity || 0}
            </span>
            <span>reserved in active BOMs</span>
          </div>
        </div>

        {/* CARD 4: Inventory Attention */}
        <div className="p-3.5 rounded-xl bg-[var(--panel)] border border-[var(--line)] hover:border-[var(--line-strong)] transition-all">
          <div className="flex items-center justify-between text-[var(--muted)]">
            <span className="font-mono text-[10px] uppercase tracking-wider font-semibold">
              Inventory Attention
            </span>
            <div className="w-6 h-6 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`font-mono text-2xl lg:text-3xl font-black tracking-tight ${
                attentionCount > 0 ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {attentionCount}
            </span>
            <span className="text-[10px] text-[var(--muted)] font-mono">
              {attentionCount === 0 ? 'all healthy' : 'require review'}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
            <span className="text-[var(--text)] font-semibold font-mono">
              {summary?.borrowedCount || 0} borrowed
            </span>
            <span className="text-[var(--line)]">·</span>
            <span className="text-[var(--text)] font-semibold font-mono">
              {summary?.lentCount || 0} lent
            </span>
          </div>
        </div>
      </div>

      {/* 3. MAIN DASHBOARD CONTENT (2 COLUMN GRID: CHARTS + PANELS) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* LEFT 2 COLUMNS: Main Inventory Overview Chart */}
        <div className="lg:col-span-2 p-4 rounded-xl bg-[var(--panel)] border border-[var(--line)] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[var(--line)]">
            <div>
              <div className="brand flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-[var(--amber)]" />
                <span>STOCK &amp; ACTIVITY TELEMETRY</span>
              </div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text)] mt-0.5">
                Inventory Overview
              </h2>
            </div>

            {/* Time range selector */}
            <div className="flex items-center gap-1 rounded-lg bg-[var(--bg)] p-1 border border-[var(--line)] shrink-0">
              {(['7', '30', '90'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setTimeRange(r)}
                  className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold transition-all ${
                    timeRange === r
                      ? 'bg-[var(--panel)] text-[var(--amber)] shadow-xs border border-[var(--line)]'
                      : 'text-[var(--muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {r}D
                </button>
              ))}
            </div>
          </div>

          {/* Area Chart: Real transaction and stock volume over time */}
          <div className="h-64 sm:h-72 w-full pt-2">
            {displayedHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={displayedHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="stockGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#222736' }}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#222736' }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ stroke: '#f59e0b', strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="stockCount"
                    name="Owned Stock Volume"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#stockGradient)"
                  />
                  <Area
                    type="monotone"
                    dataKey="activityCount"
                    name="Daily Events"
                    stroke="#10b981"
                    strokeWidth={1.5}
                    fillOpacity={1}
                    fill="url(#activityGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-[var(--muted)] text-xs">
                <Boxes className="w-8 h-8 text-[var(--muted)] opacity-40 mb-2" />
                <span>No historical transaction points recorded yet.</span>
                <span className="text-[10px] mt-1">Actions performed on inventory will trace here.</span>
              </div>
            )}
          </div>

          {/* Chart footer indicators */}
          <div className="flex flex-wrap items-center justify-between pt-2 border-t border-[var(--line)] text-[10px] font-mono text-[var(--muted)]">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--amber)]" />
                Owned Units Volume
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Daily Transactions
              </span>
            </div>
            <span>Showing verified activity timeline</span>
          </div>
        </div>

        {/* RIGHT 1 COLUMN: Component Categories Breakdown */}
        <div className="p-4 rounded-xl bg-[var(--panel)] border border-[var(--line)] space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
              <div>
                <div className="brand flex items-center gap-1">
                  <Layers className="w-3 h-3 text-[var(--amber)]" />
                  <span>TAXONOMY</span>
                </div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text)] mt-0.5">
                  Component Categories
                </h2>
              </div>
              <span className="font-mono text-[10px] text-[var(--muted)]">
                {categories.length} total
              </span>
            </div>

            {/* Doughnut Chart / Progress List */}
            {categories.length > 0 ? (
              <div className="pt-2 space-y-3">
                <div className="h-40 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categories}
                        dataKey="count"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        innerRadius={38}
                        outerRadius={65}
                        paddingAngle={3}
                      >
                        {categories.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                            stroke="var(--panel)"
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Top 4 Categories with percentages */}
                <div className="space-y-1.5 pt-1">
                  {categories.slice(0, 5).map((cat, idx) => (
                    <div key={cat.category} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                        />
                        <span className="text-[var(--text)] truncate">{cat.category}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 font-mono text-[10px]">
                        <span className="text-[var(--muted)]">{cat.count} SKUs</span>
                        <span className="text-[var(--text)] font-bold">{cat.percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-[var(--muted)] text-xs">
                No component records registered yet.
              </div>
            )}
          </div>

          <Link
            href="/components"
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[var(--panel2)] hover:border-[var(--amber)] border border-[var(--line)] text-xs font-semibold text-[var(--text)] transition-colors mt-2"
          >
            <span>View All Categories</span>
            <ArrowRight className="w-3.5 h-3.5 text-[var(--amber)]" />
          </Link>
        </div>
      </div>

      {/* 4. SECONDARY ROW: INVENTORY ATTENTION + RECENT ACTIVITY + STORAGE OVERVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* PANEL A: INVENTORY ATTENTION */}
        <div className="p-4 rounded-xl bg-[var(--panel)] border border-[var(--line)] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-3 h-3" />
              </div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text)]">
                Inventory Attention
              </h3>
            </div>
            <span className="font-mono text-[10px] text-[var(--amber)] font-bold">
              {attentionItems.length} records
            </span>
          </div>

          <div className="space-y-2">
            {attentionItems.length === 0 ? (
              <div className="p-6 text-center text-[var(--muted)] text-xs">
                <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-emerald-400 opacity-80" />
                All inventory records are currently healthy. No zero-stock or overdue borrow warnings.
              </div>
            ) : (
              attentionItems.slice(0, 5).map((item) => (
                <Link
                  key={item.id}
                  href={item.componentId ? `/components/${item.componentId}` : '/components'}
                  className="block p-2.5 rounded-lg bg-[var(--panel2)] border border-[var(--line)] hover:border-[var(--amber)] transition-all group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-[var(--text)] group-hover:text-[var(--amber)] transition-colors truncate">
                      {item.name}
                    </div>
                    {item.sku && (
                      <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--muted)] shrink-0">
                        {item.sku}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--muted)] mt-1 flex items-center justify-between">
                    <span>{item.reason}</span>
                    {item.dateOrQty && (
                      <span className="font-mono text-[10px] text-amber-400 font-semibold">
                        {item.dateOrQty}
                      </span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* PANEL B: RECENT ACTIVITY */}
        <div className="p-4 rounded-xl bg-[var(--panel)] border border-[var(--line)] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Clock className="w-3 h-3" />
              </div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text)]">
                Recent Activity
              </h3>
            </div>
            <span className="font-mono text-[10px] text-[var(--muted)]">Last 10 events</span>
          </div>

          <div className="space-y-2">
            {recentTransactions.length === 0 ? (
              <div className="p-6 text-center text-[var(--muted)] text-xs">
                No recent activity records. Log transactions to view event history.
              </div>
            ) : (
              recentTransactions.slice(0, 5).map((tx) => (
                <div
                  key={tx.id}
                  className="p-2.5 rounded-lg bg-[var(--panel2)] border border-[var(--line)] flex items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[9px] font-bold px-1.5 py-0.2 rounded uppercase border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                        {tx.transactionType}
                      </span>
                      <span className="font-semibold text-[var(--text)] truncate">
                        {tx.component?.name || 'Component'}
                      </span>
                    </div>
                    <div className="text-[10px] text-[var(--muted)] mt-0.5 truncate">
                      {tx.notes || `Quantity delta: ${tx.quantity}`}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--muted)] shrink-0">
                    {new Date(tx.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* PANEL C: STORAGE OVERVIEW */}
        <div className="p-4 rounded-xl bg-[var(--panel)] border border-[var(--line)] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-[var(--amber)]/10 border border-[var(--amber)]/30 flex items-center justify-center text-[var(--amber)]">
                <MapPin className="w-3 h-3" />
              </div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text)]">
                Storage Overview
              </h3>
            </div>
            <span className="font-mono text-[10px] text-[var(--muted)]">
              {storageList.length} lab locations
            </span>
          </div>

          <div className="space-y-2.5">
            {storageList.length === 0 ? (
              <div className="p-6 text-center text-[var(--muted)] text-xs">
                No storage locations assigned yet. Assign drawers or bins on components to view distribution.
              </div>
            ) : (
              storageList.slice(0, 5).map((st) => {
                const totalOwned = summary?.totalOwnedQuantity || 1;
                const pct = Math.min(100, Math.round((st.totalQuantity / totalOwned) * 100));

                return (
                  <div key={st.location} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono font-semibold text-[var(--text)] truncate">
                        {st.location}
                      </span>
                      <span className="font-mono text-[10px] text-[var(--muted)]">
                        {st.totalQuantity} units ({st.componentCount} SKUs)
                      </span>
                    </div>
                    {/* Distribution Progress Bar */}
                    <div className="h-1.5 w-full bg-[var(--bg)] rounded-full overflow-hidden border border-[var(--line)]">
                      <div
                        className="h-full bg-gradient-to-r from-[var(--amber)] to-emerald-400 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between text-[10px] text-[var(--muted)] font-mono">
            <span>Location tracking enabled</span>
            <Link href="/components" className="text-[var(--amber)] hover:underline flex items-center gap-0.5">
              <span>Filter by location</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
