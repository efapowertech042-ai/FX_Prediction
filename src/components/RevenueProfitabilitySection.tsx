import React, { useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { HistoricalRow, ScenarioResult } from '../types/analytics';
import { buildHistoricalAnnualSummaries } from '../engine/financialEngine';
import {
  formatFxRate,
  formatNgnCompact,
  formatPct,
  formatUnits,
} from '../utils/formatters';

interface RevenueProfitabilitySectionProps {
  historical: HistoricalRow[];
  currentScenario: ScenarioResult;
  theme: 'light' | 'dark';
}

export const RevenueProfitabilitySection: React.FC<
  RevenueProfitabilitySectionProps
> = ({ historical, currentScenario, theme }) => {
  const [viewMode, setViewMode] = useState<'annual' | 'monthly'>('annual');

  const isDark = theme === 'dark';
  const tickColor = isDark ? '#94A3B8' : '#475569';
  const gridColor = isDark
    ? 'rgba(148, 163, 184, 0.12)'
    : 'rgba(15, 23, 42, 0.08)';
  const axisLineColor = isDark
    ? 'rgba(148, 163, 184, 0.22)'
    : 'rgba(15, 23, 42, 0.16)';

  const historicalAnnual = useMemo(
    () => buildHistoricalAnnualSummaries(historical),
    [historical]
  );

  const lastHist = historical[historical.length - 1];

  const chartData = useMemo(() => {
    if (viewMode === 'annual') {
      return [
        ...historicalAnnual.map((a) => ({
          label: a.yearLabel,
          isForecast: false,
          revenue: a.totalRevenueNgn,
          operatingProfit: a.totalOperatingProfitNgn,
          grossMarginPct: a.grossMarginPct,
          operatingMarginPct: a.operatingMarginPct,
          isPartial: a.isPartial,
        })),
        ...currentScenario.annual.map((a) => ({
          label: a.yearLabel,
          isForecast: true,
          revenue: a.totalRevenueNgn,
          operatingProfit: a.totalOperatingProfitNgn,
          grossMarginPct: a.grossMarginPct,
          operatingMarginPct: a.operatingMarginPct,
          isPartial: a.isPartial,
        })),
      ];
    }

    return [
      ...historical.map((h) => ({
        label: h.label,
        isForecast: false,
        revenue: h.salesRevenueNgn,
        operatingProfit: h.operatingProfitNgn,
        grossMarginPct: h.grossMarginPct,
        operatingMarginPct: h.operatingMarginPct,
        isPartial: false,
      })),
      ...currentScenario.monthly.map((m) => ({
        label: m.label,
        isForecast: true,
        revenue: m.salesRevenueNgn,
        operatingProfit: m.operatingProfitNgn,
        grossMarginPct: m.grossMarginPct,
        operatingMarginPct: m.operatingMarginPct,
        isPartial: false,
      })),
    ];
  }, [viewMode, historicalAnnual, historical, currentScenario]);

  const boundaryLabel =
    viewMode === 'annual'
      ? currentScenario.annual[0]?.yearLabel ?? '2026'
      : currentScenario.monthly[0]?.label ?? 'Oct 2026';

  const fxImpact = currentScenario.summary.fxDrivenCostImpactNgn;

  return (
    <section id="revenue" className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            Revenue, Margins &amp; Currency Profitability Impact
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Historical vs. projected sales revenue, gross &amp; operating margins, and annualized summaries with partial boundary periods labelled.
          </p>
        </div>

        <div
          role="group"
          aria-label="Revenue view mode"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-[#060C18] shrink-0"
        >
          <button
            type="button"
            onClick={() => setViewMode('annual')}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'annual'
                ? 'bg-gradient-to-r from-sky-600 to-emerald-500 text-white font-semibold'
                : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            Annual Summary
          </button>
          <button
            type="button"
            onClick={() => setViewMode('monthly')}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'monthly'
                ? 'bg-gradient-to-r from-sky-600 to-emerald-500 text-white font-semibold'
                : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            Monthly Series
          </button>
        </div>
      </div>

      {/* Revenue + Margin Chart & FX Impact Strip */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-xl border border-slate-200/90 bg-white/85 p-5 dark:border-slate-800/90 dark:bg-[#0B1426]/90">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Historical vs. Forecast Revenue &amp; Margin Trajectory
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Bars show Sales Revenue (NGN) · Lines track Gross Margin % and Operating Margin %
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-gradient-to-t from-sky-500 to-emerald-400 inline-block" />
                Revenue
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-sky-500 inline-block" />
                Gross Margin %
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-amber-500 inline-block" />
                Op Margin %
              </span>
            </div>
          </div>

          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 6, bottom: 8 }}
              >
                <defs>
                  <linearGradient id="revBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34D399" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0.65} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={gridColor}
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: tickColor, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: axisLineColor }}
                  minTickGap={viewMode === 'monthly' ? 36 : 8}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: tickColor, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={72}
                  tickFormatter={(v: number) => formatNgnCompact(v)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[-20, 55]}
                  tick={{ fill: tickColor, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const row = payload[0]?.payload;
                    return (
                      <div className="rounded-lg border border-slate-200 bg-white/95 px-3.5 py-2.5 text-xs shadow-xl dark:border-slate-700 dark:bg-[#060C18]/95">
                        <p className="font-display font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
                          {label}{' '}
                          <span className="text-slate-500 dark:text-slate-400 font-normal">
                            · {row.isForecast ? 'Forecast' : 'Historical'}
                          </span>
                        </p>
                        <div className="space-y-1 font-mono tabular-nums">
                          <p className="text-emerald-700 dark:text-emerald-300">
                            Sales Revenue: {formatNgnCompact(row.revenue)}
                          </p>
                          <p className="text-slate-700 dark:text-slate-200">
                            Operating Profit: {formatNgnCompact(row.operatingProfit)}
                          </p>
                          <p className="text-sky-700 dark:text-sky-300">
                            Gross Margin: {formatPct(row.grossMarginPct, 2)}
                          </p>
                          <p className="text-amber-600 dark:text-amber-300">
                            Operating Margin: {formatPct(row.operatingMarginPct, 2)}
                          </p>
                        </div>
                      </div>
                    );
                  }}
                />
                <ReferenceLine
                  x={boundaryLabel}
                  yAxisId="left"
                  stroke="#0EA5E9"
                  strokeDasharray="4 4"
                  strokeOpacity={0.65}
                />
                <Bar
                  yAxisId="left"
                  dataKey="revenue"
                  fill="url(#revBarGrad)"
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="grossMarginPct"
                  stroke="#0EA5E9"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="operatingMarginPct"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Currency Profitability Impact Card */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white/85 p-5 dark:border-slate-800/90 dark:bg-[#0B1426]/90 space-y-5">
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Currency Impact on Import Profitability
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Measures cumulative additional COGS incurred over 5 years due to projected USD/NGN movement relative to holding the {lastHist.label} rate ({formatFxRate(lastHist.usdNgnRate)}) constant.
            </p>
          </div>

          <div className="space-y-4 border-y border-slate-200/80 dark:border-slate-800/80 py-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-slate-600 dark:text-slate-300">
                5-Yr FX-Driven Import Cost Delta
              </span>
              <span
                className={`font-mono text-lg font-semibold tabular-nums ${
                  fxImpact > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-600 dark:text-emerald-300'
                }`}
              >
                {formatNgnCompact(fxImpact, true)}
              </span>
            </div>

            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-slate-600 dark:text-slate-300">
                5-Yr Total Imported COGS
              </span>
              <span className="font-mono text-sm font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                {formatNgnCompact(currentScenario.summary.total5YrCogs)}
              </span>
            </div>

            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-slate-600 dark:text-slate-300">
                5-Yr Weighted Gross Margin
              </span>
              <span className="font-mono text-sm font-medium text-sky-700 dark:text-sky-300 tabular-nums">
                {formatPct(currentScenario.summary.overall5YrGrossMarginPct, 2)}
              </span>
            </div>

            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-slate-600 dark:text-slate-300">
                5-Yr Weighted Operating Margin
              </span>
              <span className="font-mono text-sm font-medium text-emerald-700 dark:text-emerald-300 tabular-nums">
                {formatPct(
                  currentScenario.summary.overall5YrOperatingMarginPct,
                  2
                )}
              </span>
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            At {currentScenario.params.fxCostPassThroughPct}% FX pass-through and{' '}
            {currentScenario.params.priceInflationPassThroughPct}% inflation pass-through, customer selling prices absorb part of supplier currency inflation while local operating costs compound strictly with domestic inflation.
          </p>
        </div>
      </div>

      {/* Annual Forecast Breakdown Table */}
      <div className="rounded-xl border border-slate-200/90 bg-white/85 dark:border-slate-800/90 dark:bg-[#0B1426]/90 overflow-hidden">
        <div className="border-b border-slate-200/80 dark:border-slate-800/80 px-5 py-3.5 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
            Forecast Annual Revenue &amp; Profitability Schedule (Oct 2026 – Sep 2031)
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Partial calendar periods (2026 Q4 and 2031 Jan–Sep) explicitly labelled
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200/80 bg-slate-50/90 text-slate-500 dark:border-slate-800/80 dark:bg-[#081020] dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium text-right">Avg USD/NGN</th>
                <th className="px-4 py-3 font-medium text-right">End USD/NGN</th>
                <th className="px-4 py-3 font-medium text-right">Units Sold</th>
                <th className="px-4 py-3 font-medium text-right">Sales Revenue</th>
                <th className="px-4 py-3 font-medium text-right">Gross Profit</th>
                <th className="px-4 py-3 font-medium text-right">Gross Margin</th>
                <th className="px-4 py-3 font-medium text-right">Operating Profit</th>
                <th className="px-4 py-3 font-medium text-right">Op Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/60 font-mono tabular-nums">
              {currentScenario.annual.map((row) => (
                <tr
                  key={row.yearLabel}
                  className="hover:bg-slate-100/60 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <td className="px-4 py-2.5 font-sans font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {row.yearLabel}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300">
                    {formatFxRate(row.avgFxRate)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-sky-700 dark:text-sky-300">
                    {formatFxRate(row.endFxRate)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-700 dark:text-slate-200">
                    {formatUnits(row.totalUnitsSold)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-900 dark:text-slate-100 font-medium">
                    {formatNgnCompact(row.totalRevenueNgn)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-emerald-700 dark:text-emerald-300">
                    {formatNgnCompact(row.totalGrossProfitNgn)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-700 dark:text-slate-200">
                    {formatPct(row.grossMarginPct, 1)}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-semibold ${
                      row.totalOperatingProfitNgn < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    {formatNgnCompact(row.totalOperatingProfitNgn)}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right ${
                      row.operatingMarginPct < 20
                        ? 'text-amber-600 dark:text-amber-300'
                        : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {formatPct(row.operatingMarginPct, 1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
