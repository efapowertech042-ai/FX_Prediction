import React, { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ScenarioPresetId, ScenarioResult } from '../types/analytics';
import {
  formatFxRate,
  formatNgnCompact,
  formatPct,
} from '../utils/formatters';

interface ScenarioComparisonSectionProps {
  baseScenario: ScenarioResult;
  optimisticScenario: ScenarioResult;
  stressScenario: ScenarioResult;
  customScenario: ScenarioResult;
  activePresetId: ScenarioPresetId;
  theme: 'light' | 'dark';
}

type CompareMetric = 'fx' | 'operatingProfit' | 'revenue';

const SCENARIO_LABELS: Record<ScenarioPresetId, string> = {
  base: 'Base Case',
  optimistic: 'Optimistic Case',
  stress: 'Stress Case',
  custom: 'Custom Scenario',
};

export const ScenarioComparisonSection: React.FC<
  ScenarioComparisonSectionProps
> = ({
  baseScenario,
  optimisticScenario,
  stressScenario,
  customScenario,
  activePresetId,
  theme,
}) => {
  const [scenarioA, setScenarioA] = useState<ScenarioPresetId>('base');
  const [scenarioB, setScenarioB] = useState<ScenarioPresetId>('stress');
  const [metric, setMetric] = useState<CompareMetric>('operatingProfit');

  const isDark = theme === 'dark';
  const tickColor = isDark ? '#94A3B8' : '#475569';
  const gridColor = isDark
    ? 'rgba(148, 163, 184, 0.12)'
    : 'rgba(15, 23, 42, 0.08)';
  const axisLineColor = isDark
    ? 'rgba(148, 163, 184, 0.22)'
    : 'rgba(15, 23, 42, 0.16)';

  const scenarioMap: Record<ScenarioPresetId, ScenarioResult> = {
    base: baseScenario,
    optimistic: optimisticScenario,
    stress: stressScenario,
    custom: customScenario,
  };

  const rows: Array<{ id: ScenarioPresetId; res: ScenarioResult }> = [
    { id: 'base', res: baseScenario },
    { id: 'optimistic', res: optimisticScenario },
    { id: 'stress', res: stressScenario },
    { id: 'custom', res: customScenario },
  ];

  const comparisonChartData = useMemo(() => {
    const resA = scenarioMap[scenarioA];
    const resB = scenarioMap[scenarioB];
    return resA.monthly.map((ptA, idx) => {
      const ptB = resB.monthly[idx];
      const valA =
        metric === 'fx'
          ? ptA.scenarioFx
          : metric === 'operatingProfit'
          ? ptA.operatingProfitNgn
          : ptA.salesRevenueNgn;
      const valB =
        metric === 'fx'
          ? ptB.scenarioFx
          : metric === 'operatingProfit'
          ? ptB.operatingProfitNgn
          : ptB.salesRevenueNgn;
      return {
        label: ptA.label,
        valA,
        valB,
      };
    });
  }, [scenarioA, scenarioB, metric, baseScenario, optimisticScenario, stressScenario, customScenario]);

  const formatMetricVal = (v: number) =>
    metric === 'fx' ? formatFxRate(v) : formatNgnCompact(v);

  return (
    <section id="scenarios" className="space-y-6">
      <div>
        <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
          Scenario Comparison Matrix &amp; Dual-Trajectory Overlay
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Compare Base, Optimistic, Stress, and Custom scenarios side by side and overlay any two forecast curves simultaneously.
        </p>
      </div>

      {/* 4-Scenario Matrix */}
      <div className="rounded-xl border border-slate-200/90 bg-white/85 dark:border-slate-800/90 dark:bg-[#0B1426]/90 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200/80 bg-slate-50/90 text-slate-500 dark:border-slate-800/80 dark:bg-[#081020] dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Scenario</th>
                <th className="px-4 py-3 font-medium text-right">Inflation</th>
                <th className="px-4 py-3 font-medium text-right">Unit Growth</th>
                <th className="px-4 py-3 font-medium text-right">Sep 2031 USD/NGN</th>
                <th className="px-4 py-3 font-medium text-right">5-Yr Revenue</th>
                <th className="px-4 py-3 font-medium text-right">5-Yr Gross Profit</th>
                <th className="px-4 py-3 font-medium text-right">5-Yr Operating Profit</th>
                <th className="px-4 py-3 font-medium text-right">Operating Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/60 font-mono tabular-nums">
              {rows.map(({ id, res }) => {
                const isActive = activePresetId === id;
                return (
                  <tr
                    key={id}
                    className={`transition-colors ${
                      isActive
                        ? 'bg-sky-50/80 dark:bg-emerald-950/25'
                        : 'hover:bg-slate-100/60 dark:hover:bg-slate-800/30'
                    }`}
                  >
                    <td className="px-4 py-3 font-sans font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {SCENARIO_LABELS[id]}
                      {isActive && (
                        <span className="ml-2 text-[11px] font-normal text-sky-700 dark:text-emerald-300">
                          · Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                      {formatPct(res.params.annualInflationPct, 1)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                      {formatPct(res.params.annualUnitSalesGrowthPct, 1, true)}
                    </td>
                    <td className="px-4 py-3 text-right text-sky-700 dark:text-sky-300">
                      {formatFxRate(res.summary.endFxRateSep2031)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-100">
                      {formatNgnCompact(res.summary.total5YrRevenue)}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-700 dark:text-emerald-300">
                      {formatNgnCompact(res.summary.total5YrGrossProfit)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        res.summary.cumulative5YrOperatingProfit < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {formatNgnCompact(res.summary.cumulative5YrOperatingProfit)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right ${
                        res.summary.overall5YrOperatingMarginPct < 20
                          ? 'text-amber-600 dark:text-amber-300'
                          : 'text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      {formatPct(res.summary.overall5YrOperatingMarginPct, 2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dual-Line Simultaneous Comparator */}
      <div className="rounded-xl border border-slate-200/90 bg-white/85 p-5 dark:border-slate-800/90 dark:bg-[#0B1426]/90">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="h-0.5 w-4 bg-emerald-500 inline-block" />
              <label htmlFor="compare-a" className="text-xs text-slate-500 dark:text-slate-400">
                Line A
              </label>
              <select
                id="compare-a"
                value={scenarioA}
                onChange={(e) => setScenarioA(e.target.value as ScenarioPresetId)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-[#060C18] dark:text-slate-100 cursor-pointer"
              >
                {Object.entries(SCENARIO_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-xs text-slate-400">vs.</span>

            <div className="flex items-center gap-2">
              <span className="h-0.5 w-4 border-t-2 border-dashed border-sky-500 inline-block" />
              <label htmlFor="compare-b" className="text-xs text-slate-500 dark:text-slate-400">
                Line B
              </label>
              <select
                id="compare-b"
                value={scenarioB}
                onChange={(e) => setScenarioB(e.target.value as ScenarioPresetId)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-[#060C18] dark:text-slate-100 cursor-pointer"
              >
                {Object.entries(SCENARIO_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            role="group"
            aria-label="Comparison metric"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-[#060C18] self-start"
          >
            {(
              [
                ['operatingProfit', 'Operating Profit'],
                ['revenue', 'Sales Revenue'],
                ['fx', 'USD/NGN Rate'],
              ] as const
            ).map(([mKey, mLabel]) => (
              <button
                key={mKey}
                type="button"
                onClick={() => setMetric(mKey)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  metric === mKey
                    ? 'bg-gradient-to-r from-sky-600 to-emerald-500 text-white font-semibold'
                    : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                {mLabel}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[310px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={comparisonChartData}
              margin={{ top: 10, right: 16, left: 8, bottom: 8 }}
            >
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
                minTickGap={34}
              />
              <YAxis
                tick={{ fill: tickColor, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={74}
                tickFormatter={(v: number) => formatMetricVal(v)}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const row = payload[0]?.payload;
                  const diff = row.valA - row.valB;
                  return (
                    <div className="rounded-lg border border-slate-200 bg-white/95 px-3.5 py-2.5 text-xs shadow-xl dark:border-slate-700 dark:bg-[#060C18]/95">
                      <p className="font-display font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
                        {label}
                      </p>
                      <div className="space-y-1 font-mono tabular-nums">
                        <p className="text-emerald-700 dark:text-emerald-300">
                          {SCENARIO_LABELS[scenarioA]}: {formatMetricVal(row.valA)}
                        </p>
                        <p className="text-sky-700 dark:text-sky-300">
                          {SCENARIO_LABELS[scenarioB]}: {formatMetricVal(row.valB)}
                        </p>
                        <p className="text-slate-600 dark:text-slate-300 border-t border-slate-200 dark:border-slate-800 pt-1">
                          Spread (A − B): {diff >= 0 ? '+' : ''}
                          {formatMetricVal(diff)}
                        </p>
                      </div>
                    </div>
                  );
                }}
              />
              {metric === 'operatingProfit' && (
                <ReferenceLine
                  y={0}
                  stroke="#F43F5E"
                  strokeOpacity={0.65}
                  strokeDasharray="3 3"
                />
              )}
              <Line
                type="monotone"
                dataKey="valA"
                stroke="#10B981"
                strokeWidth={2.4}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="valB"
                stroke="#0EA5E9"
                strokeWidth={2.2}
                strokeDasharray="5 5"
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
};
