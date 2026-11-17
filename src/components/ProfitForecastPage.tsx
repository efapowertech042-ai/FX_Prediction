import React, { useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  DatasetSummary,
  HistoricalRow,
  ScenarioParams,
  ScenarioPresetId,
  ScenarioResult,
} from '../types/analytics';
import { formatNgnCompact, formatPct } from '../utils/formatters';
import { ScenarioSimulator } from './ScenarioSimulator';

interface ProfitForecastPageProps {
  historical: HistoricalRow[];
  summary: DatasetSummary;
  currentScenario: ScenarioResult;
  baseScenario: ScenarioResult;
  params: ScenarioParams;
  theme: 'light' | 'dark';
  onChangeParams: (next: ScenarioParams) => void;
  onSelectPreset: (presetId: Exclude<ScenarioPresetId, 'custom'>) => void;
  onResetBaseline: () => void;
}

interface ProfitChartPoint {
  dateKey: string;
  label: string;
  isForecast: boolean;
  isBridge?: boolean;
  histOp: number | null;
  baselineOp: number | null;
  scenarioOp: number | null;
  opBand: [number, number] | null;
  negativeOpPoint: number | null;
  opMarginPct: number | null;
}

export const ProfitForecastPage: React.FC<ProfitForecastPageProps> = ({
  historical,
  summary,
  currentScenario,
  baseScenario,
  params,
  theme,
  onChangeParams,
  onSelectPreset,
  onResetBaseline,
}) => {
  const [granularity, setGranularity] = useState<'monthly' | 'annual'>('monthly');

  const isDark = theme === 'dark';
  const tickColor = isDark ? '#94A3B8' : '#475569';
  const gridColor = isDark
    ? 'rgba(148, 163, 184, 0.12)'
    : 'rgba(15, 23, 42, 0.08)';
  const axisLineColor = isDark
    ? 'rgba(148, 163, 184, 0.22)'
    : 'rgba(15, 23, 42, 0.16)';

  const lastHist = historical[historical.length - 1];
  const boundaryLabel = lastHist.label;

  const monthlyData = useMemo<ProfitChartPoint[]>(() => {
    const pts: ProfitChartPoint[] = [];
    for (let i = 0; i < historical.length; i++) {
      const h = historical[i];
      const isLast = i === historical.length - 1;
      pts.push({
        dateKey: h.dateKey,
        label: h.label,
        isForecast: false,
        isBridge: isLast,
        histOp: h.operatingProfitNgn,
        baselineOp: isLast ? h.operatingProfitNgn : null,
        scenarioOp: isLast ? h.operatingProfitNgn : null,
        opBand: isLast ? [h.operatingProfitNgn, h.operatingProfitNgn] : null,
        negativeOpPoint: h.operatingProfitNgn < 0 ? h.operatingProfitNgn : null,
        opMarginPct: h.operatingMarginPct,
      });
    }
    for (let i = 0; i < currentScenario.monthly.length; i++) {
      const fc = currentScenario.monthly[i];
      const baseFc = baseScenario.monthly[i];
      pts.push({
        dateKey: fc.dateKey,
        label: fc.label,
        isForecast: true,
        histOp: null,
        baselineOp: baseFc.operatingProfitNgn,
        scenarioOp: fc.operatingProfitNgn,
        opBand: [fc.operatingProfitLow, fc.operatingProfitHigh],
        negativeOpPoint: fc.operatingProfitNgn < 0 ? fc.operatingProfitNgn : null,
        opMarginPct: fc.operatingMarginPct,
      });
    }
    return pts;
  }, [historical, currentScenario, baseScenario]);

  const annualData = useMemo<ProfitChartPoint[]>(() => {
    const histByYear = new Map<number, HistoricalRow[]>();
    for (const r of historical) {
      const arr = histByYear.get(r.year) ?? [];
      arr.push(r);
      histByYear.set(r.year, arr);
    }

    const pts: ProfitChartPoint[] = [];
    const sortedHistYears = Array.from(histByYear.entries()).sort(
      (a, b) => a[0] - b[0]
    );
    sortedHistYears.forEach(([yr, rows], idx) => {
      const sumOp = rows.reduce((s, r) => s + r.operatingProfitNgn, 0);
      const sumRev = rows.reduce((s, r) => s + r.salesRevenueNgn, 0);
      const isLastHistYear = idx === sortedHistYears.length - 1;
      pts.push({
        dateKey: String(yr),
        label: rows.length < 12 ? `${yr} (${rows.length}m)` : String(yr),
        isForecast: false,
        isBridge: isLastHistYear,
        histOp: sumOp,
        baselineOp: isLastHistYear ? sumOp : null,
        scenarioOp: isLastHistYear ? sumOp : null,
        opBand: isLastHistYear ? [sumOp, sumOp] : null,
        negativeOpPoint: sumOp < 0 ? sumOp : null,
        opMarginPct: sumRev > 0 ? (sumOp / sumRev) * 100 : 0,
      });
    });

    for (let i = 0; i < currentScenario.annual.length; i++) {
      const ann = currentScenario.annual[i];
      const baseAnn = baseScenario.annual[i];
      const fcPts = currentScenario.monthly.filter((m) =>
        ann.yearLabel.startsWith(String(m.year))
      );
      const sumOpLow = fcPts.reduce((s, p) => s + p.operatingProfitLow, 0);
      const sumOpHigh = fcPts.reduce((s, p) => s + p.operatingProfitHigh, 0);

      pts.push({
        dateKey: ann.yearLabel,
        label: ann.yearLabel,
        isForecast: true,
        histOp: null,
        baselineOp: baseAnn.totalOperatingProfitNgn,
        scenarioOp: ann.totalOperatingProfitNgn,
        opBand: [sumOpLow, sumOpHigh],
        negativeOpPoint:
          ann.totalOperatingProfitNgn < 0 ? ann.totalOperatingProfitNgn : null,
        opMarginPct: ann.operatingMarginPct,
      });
    }
    return pts;
  }, [historical, currentScenario, baseScenario]);

  const chartData = granularity === 'monthly' ? monthlyData : annualData;
  const separatorLabel =
    granularity === 'monthly'
      ? boundaryLabel
      : chartData.find((d) => d.isBridge)?.label ?? boundaryLabel;

  const hasNegativeOp = chartData.some(
    (d) =>
      (d.histOp !== null && d.histOp < 0) ||
      (d.scenarioOp !== null && d.scenarioOp < 0)
  );

  const minOpVal = useMemo(() => {
    let min = 0;
    for (const d of chartData) {
      if (d.histOp !== null && d.histOp < min) min = d.histOp;
      if (d.scenarioOp !== null && d.scenarioOp < min) min = d.scenarioOp;
      if (d.opBand && d.opBand[0] < min) min = d.opBand[0];
    }
    return min;
  }, [chartData]);

  const cur = currentScenario.summary;
  const base = baseScenario.summary;
  const cumOpDelta =
    cur.cumulative5YrOperatingProfit - base.cumulative5YrOperatingProfit;

  return (
    <section aria-labelledby="profit-page-heading" className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
        {/* Main Chart Column */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-4">
          {/* Live Operating Profit Strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200/90 bg-white/85 p-3.5 dark:border-slate-800/90 dark:bg-[#0B1426]/90">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Latest Monthly OP ({summary.endDateLabel})
              </p>
              <p className="mt-1 font-mono text-lg font-semibold text-sky-700 dark:text-sky-300 tabular-nums">
                {formatNgnCompact(summary.latestOperatingProfit)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/90 bg-white/85 p-3.5 dark:border-slate-800/90 dark:bg-[#0B1426]/90">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Forecast Monthly OP (Sep 2031)
              </p>
              <p
                className={`mt-1 font-mono text-lg font-semibold tabular-nums ${
                  cur.endMonthlyOperatingProfitSep2031 < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-600 dark:text-emerald-300'
                }`}
              >
                {formatNgnCompact(cur.endMonthlyOperatingProfitSep2031)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/90 bg-white/85 p-3.5 dark:border-slate-800/90 dark:bg-[#0B1426]/90">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                5-Yr Cumulative OP
              </p>
              <p
                className={`mt-1 font-mono text-base font-semibold tabular-nums ${
                  cur.cumulative5YrOperatingProfit < 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-900 dark:text-slate-100'
                }`}
              >
                {formatNgnCompact(cur.cumulative5YrOperatingProfit)}
                <span className="ml-1.5 text-xs font-normal text-slate-500 dark:text-slate-400">
                  ({formatNgnCompact(cumOpDelta, true)})
                </span>
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/90 bg-white/85 p-3.5 dark:border-slate-800/90 dark:bg-[#0B1426]/90">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                5-Yr Operating Margin
              </p>
              <p
                className={`mt-1 font-mono text-lg font-semibold tabular-nums ${
                  cur.overall5YrOperatingMarginPct < 20
                    ? 'text-amber-600 dark:text-amber-300'
                    : 'text-emerald-600 dark:text-emerald-300'
                }`}
              >
                {formatPct(cur.overall5YrOperatingMarginPct, 2)}
              </p>
            </div>
          </div>

          {/* Dedicated Operating Profit Chart Card */}
          <div className="rounded-xl border border-slate-200/90 bg-white/90 p-5 dark:border-slate-800/90 dark:bg-[#0B1426]/90">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2
                  id="profit-page-heading"
                  className="font-display text-base font-semibold text-slate-900 dark:text-slate-100"
                >
                  Business Operating Profit Forecast (Oct 2016 – Sep 2031)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Accounting-linked projection (Revenue − COGS − Marketing − Overhead) · Negative-profit periods highlighted below zero line
                </p>
              </div>

              <div
                role="group"
                aria-label="Operating profit chart granularity"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-[#060C18] self-start shrink-0"
              >
                <button
                  type="button"
                  onClick={() => setGranularity('monthly')}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    granularity === 'monthly'
                      ? 'bg-gradient-to-r from-sky-600 to-emerald-500 text-white font-semibold'
                      : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setGranularity('annual')}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    granularity === 'annual'
                      ? 'bg-gradient-to-r from-sky-600 to-emerald-500 text-white font-semibold'
                      : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  Annual
                </button>
              </div>
            </div>

            {/* Clean Legend */}
            <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-sky-500 inline-block" />
                Historical OP
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-4 border-t-2 border-dashed border-slate-400 inline-block" />
                Model Baseline
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-4 border-t-2 border-dotted border-emerald-500 dark:border-emerald-400 inline-block" />
                User-Adjusted Scenario
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-3.5 rounded-xs bg-gradient-to-r from-sky-400/25 to-emerald-400/25 border border-emerald-400/45 inline-block" />
                FX-Propagated 80% Band
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500 inline-block" />
                Negative Profit Period
              </span>
            </div>

            <div className="h-[440px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 12, right: 18, left: 8, bottom: 8 }}
                >
                  <defs>
                    <linearGradient id="opUncertaintyGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#0EA5E9" stopOpacity={isDark ? 0.2 : 0.16} />
                      <stop offset="100%" stopColor="#34D399" stopOpacity={isDark ? 0.24 : 0.2} />
                    </linearGradient>
                    <linearGradient id="opScenarioLineGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#0EA5E9" />
                      <stop offset="100%" stopColor="#10B981" />
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
                    minTickGap={granularity === 'monthly' ? 36 : 10}
                  />
                  <YAxis
                    tick={{ fill: tickColor, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={76}
                    tickFormatter={(v: number) => formatNgnCompact(v)}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const row = payload[0]?.payload as ProfitChartPoint;
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white/95 px-3.5 py-2.5 text-xs shadow-xl dark:border-slate-700 dark:bg-[#060C18]/95">
                          <p className="font-display font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
                            {label}{' '}
                            <span className="text-slate-500 dark:text-slate-400 font-normal">
                              · {row.isForecast ? 'Forecast' : 'Historical'}
                            </span>
                          </p>
                          <div className="space-y-1 font-mono tabular-nums">
                            {row.histOp !== null && (
                              <p
                                className={
                                  row.histOp < 0
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-sky-700 dark:text-sky-300'
                                }
                              >
                                Historical OP: {formatNgnCompact(row.histOp)}
                              </p>
                            )}
                            {row.isForecast && row.scenarioOp !== null && (
                              <p
                                className={
                                  row.scenarioOp < 0
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-emerald-700 dark:text-emerald-300'
                                }
                              >
                                Scenario OP: {formatNgnCompact(row.scenarioOp)}
                              </p>
                            )}
                            {row.isForecast && row.baselineOp !== null && (
                              <p className="text-slate-600 dark:text-slate-300">
                                Model Baseline: {formatNgnCompact(row.baselineOp)}
                              </p>
                            )}
                            {row.opMarginPct !== null && (
                              <p className="text-slate-600 dark:text-slate-300">
                                Operating Margin: {formatPct(row.opMarginPct, 2)}
                              </p>
                            )}
                            {row.isForecast && row.opBand && (
                              <p className="text-slate-500 dark:text-slate-400">
                                FX 80% Band: {formatNgnCompact(row.opBand[0])} to{' '}
                                {formatNgnCompact(row.opBand[1])}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    }}
                  />
                  {hasNegativeOp && minOpVal < 0 && (
                    <ReferenceArea
                      y1={minOpVal * 1.15}
                      y2={0}
                      fill="#F43F5E"
                      fillOpacity={isDark ? 0.09 : 0.08}
                    />
                  )}
                  <ReferenceLine
                    y={0}
                    stroke="#F43F5E"
                    strokeWidth={1.4}
                    strokeOpacity={0.85}
                    label={{
                      value: 'Break-Even (₦0)',
                      position: 'insideBottomLeft',
                      fill: isDark ? '#FDA4AF' : '#BE123C',
                      fontSize: 11,
                    }}
                  />
                  <ReferenceLine
                    x={separatorLabel}
                    stroke="#0EA5E9"
                    strokeDasharray="4 4"
                    strokeOpacity={0.7}
                  />
                  <Area
                    type="monotone"
                    dataKey="opBand"
                    stroke="none"
                    fill="url(#opUncertaintyGrad)"
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="histOp"
                    stroke="#0EA5E9"
                    strokeWidth={2.3}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="baselineOp"
                    stroke={isDark ? '#94A3B8' : '#64748B'}
                    strokeWidth={1.6}
                    strokeDasharray="5 5"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="scenarioOp"
                    stroke="url(#opScenarioLineGrad)"
                    strokeWidth={2.6}
                    strokeDasharray="3 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="negativeOpPoint"
                    stroke="none"
                    dot={{
                      r: 4,
                      fill: '#F43F5E',
                      stroke: isDark ? '#FFE4E6' : '#FFFFFF',
                      strokeWidth: 1,
                    }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Subtle Docked Equalizer Console */}
        <div className="lg:col-span-4 xl:col-span-3">
          <ScenarioSimulator
            variant="compact"
            params={params}
            latestInflationPct={summary.latestInflationPct}
            onChangeParams={onChangeParams}
            onSelectPreset={onSelectPreset}
            onResetBaseline={onResetBaseline}
            relevantNote="Adjust demand growth (B), pass-through levers (C, D), supplier USD cost (E), or OpEx sensitivity (F) to watch operating profit respond live."
          />
        </div>
      </div>
    </section>
  );
};
