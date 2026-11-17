import React, { useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  DatasetSummary,
  ForecastingModelOutput,
  HistoricalRow,
  ScenarioParams,
  ScenarioPresetId,
  ScenarioResult,
} from '../types/analytics';
import { formatFxRate, formatPct } from '../utils/formatters';
import { ScenarioSimulator } from './ScenarioSimulator';

interface UsdForecastPageProps {
  historical: HistoricalRow[];
  summary: DatasetSummary;
  modelOutput: ForecastingModelOutput;
  currentScenario: ScenarioResult;
  baseScenario: ScenarioResult;
  params: ScenarioParams;
  theme: 'light' | 'dark';
  onChangeParams: (next: ScenarioParams) => void;
  onSelectPreset: (presetId: Exclude<ScenarioPresetId, 'custom'>) => void;
  onResetBaseline: () => void;
}

interface FxChartPoint {
  dateKey: string;
  label: string;
  isForecast: boolean;
  isBridge?: boolean;
  histFx: number | null;
  baselineFx: number | null;
  scenarioFx: number | null;
  fxBand: [number, number] | null;
}

export const UsdForecastPage: React.FC<UsdForecastPageProps> = ({
  historical,
  summary,
  modelOutput,
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

  const monthlyData = useMemo<FxChartPoint[]>(() => {
    const pts: FxChartPoint[] = [];
    for (let i = 0; i < historical.length; i++) {
      const h = historical[i];
      const isLast = i === historical.length - 1;
      pts.push({
        dateKey: h.dateKey,
        label: h.label,
        isForecast: false,
        isBridge: isLast,
        histFx: h.usdNgnRate,
        baselineFx: isLast ? h.usdNgnRate : null,
        scenarioFx: isLast ? h.usdNgnRate : null,
        fxBand: isLast ? [h.usdNgnRate, h.usdNgnRate] : null,
      });
    }
    for (let i = 0; i < currentScenario.monthly.length; i++) {
      const fc = currentScenario.monthly[i];
      const baseFc = baseScenario.monthly[i];
      pts.push({
        dateKey: fc.dateKey,
        label: fc.label,
        isForecast: true,
        histFx: null,
        baselineFx: baseFc.scenarioFx,
        scenarioFx: fc.scenarioFx,
        fxBand: [fc.fxLower80, fc.fxUpper80],
      });
    }
    return pts;
  }, [historical, currentScenario, baseScenario]);

  const annualData = useMemo<FxChartPoint[]>(() => {
    const histByYear = new Map<number, HistoricalRow[]>();
    for (const r of historical) {
      const arr = histByYear.get(r.year) ?? [];
      arr.push(r);
      histByYear.set(r.year, arr);
    }

    const pts: FxChartPoint[] = [];
    const sortedHistYears = Array.from(histByYear.entries()).sort(
      (a, b) => a[0] - b[0]
    );
    sortedHistYears.forEach(([yr, rows], idx) => {
      const avgFx = rows.reduce((s, r) => s + r.usdNgnRate, 0) / rows.length;
      const isLastHistYear = idx === sortedHistYears.length - 1;
      pts.push({
        dateKey: String(yr),
        label: rows.length < 12 ? `${yr} (${rows.length}m)` : String(yr),
        isForecast: false,
        isBridge: isLastHistYear,
        histFx: avgFx,
        baselineFx: isLastHistYear ? avgFx : null,
        scenarioFx: isLastHistYear ? avgFx : null,
        fxBand: isLastHistYear ? [avgFx, avgFx] : null,
      });
    });

    for (let i = 0; i < currentScenario.annual.length; i++) {
      const ann = currentScenario.annual[i];
      const baseAnn = baseScenario.annual[i];
      const fcPts = currentScenario.monthly.filter((m) =>
        ann.yearLabel.startsWith(String(m.year))
      );
      const avgLowFx =
        fcPts.reduce((s, p) => s + p.fxLower80, 0) / Math.max(1, fcPts.length);
      const avgHighFx =
        fcPts.reduce((s, p) => s + p.fxUpper80, 0) / Math.max(1, fcPts.length);

      pts.push({
        dateKey: ann.yearLabel,
        label: ann.yearLabel,
        isForecast: true,
        histFx: null,
        baselineFx: baseAnn.avgFxRate,
        scenarioFx: ann.avgFxRate,
        fxBand: [avgLowFx, avgHighFx],
      });
    }
    return pts;
  }, [historical, currentScenario, baseScenario]);

  const chartData = granularity === 'monthly' ? monthlyData : annualData;
  const separatorLabel =
    granularity === 'monthly'
      ? boundaryLabel
      : chartData.find((d) => d.isBridge)?.label ?? boundaryLabel;

  const endFx = currentScenario.summary.endFxRateSep2031;
  const baseEndFx = baseScenario.summary.endFxRateSep2031;
  const diffVsBase = endFx - baseEndFx;
  const pctChange5Yr =
    ((endFx - summary.latestFxRate) / summary.latestFxRate) * 100;
  const finalPoint =
    currentScenario.monthly[currentScenario.monthly.length - 1];

  return (
    <section aria-labelledby="usd-page-heading" className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
        {/* Main Chart Column */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-4">
          {/* Live FX Strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200/90 bg-white/85 p-3.5 dark:border-slate-800/90 dark:bg-[#0B1426]/90">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Latest Historical ({summary.endDateLabel})
              </p>
              <p className="mt-1 font-mono text-lg font-semibold text-sky-700 dark:text-sky-300 tabular-nums">
                {formatFxRate(summary.latestFxRate)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/90 bg-white/85 p-3.5 dark:border-slate-800/90 dark:bg-[#0B1426]/90">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Forecast Target (Sep 2031)
              </p>
              <p className="mt-1 font-mono text-lg font-semibold text-emerald-600 dark:text-emerald-300 tabular-nums">
                {formatFxRate(endFx)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/90 bg-white/85 p-3.5 dark:border-slate-800/90 dark:bg-[#0B1426]/90">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                5-Yr Change / vs. Base
              </p>
              <p className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                {formatPct(pctChange5Yr, 1, true)}
                <span className="ml-1.5 text-xs font-normal text-slate-500 dark:text-slate-400">
                  ({diffVsBase >= 0 ? '+' : ''}
                  {formatFxRate(diffVsBase)})
                </span>
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/90 bg-white/85 p-3.5 dark:border-slate-800/90 dark:bg-[#0B1426]/90">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Sep 2031 80% Uncertainty Band
              </p>
              <p className="mt-1 font-mono text-xs font-medium text-slate-700 dark:text-slate-200 tabular-nums">
                {formatFxRate(finalPoint.fxLower80)} – {formatFxRate(finalPoint.fxUpper80)}
              </p>
            </div>
          </div>

          {/* Dedicated USD/NGN Chart Card */}
          <div className="rounded-xl border border-slate-200/90 bg-white/90 p-5 dark:border-slate-800/90 dark:bg-[#0B1426]/90">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2
                  id="usd-page-heading"
                  className="font-display text-base font-semibold text-slate-900 dark:text-slate-100"
                >
                  USD/NGN Exchange Rate Forecast (Oct 2016 – Sep 2031)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Selected baseline model: {modelOutput.selectedModelName} · Adjust Inflation (A) or FX Sensitivity (G) on the right to see real-time divergence
                </p>
              </div>

              <div
                role="group"
                aria-label="FX chart granularity"
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
                Historical Data
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
                80% Forecast Uncertainty
              </span>
            </div>

            <div className="h-[440px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 12, right: 18, left: 8, bottom: 8 }}
                >
                  <defs>
                    <linearGradient id="fxUncertaintyGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#0EA5E9" stopOpacity={isDark ? 0.22 : 0.18} />
                      <stop offset="100%" stopColor="#34D399" stopOpacity={isDark ? 0.24 : 0.2} />
                    </linearGradient>
                    <linearGradient id="fxScenarioLineGrad" x1="0" y1="0" x2="1" y2="0">
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
                    width={70}
                    tickFormatter={(v: number) =>
                      `₦${Math.round(v).toLocaleString()}`
                    }
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const row = payload[0]?.payload as FxChartPoint;
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white/95 px-3.5 py-2.5 text-xs shadow-xl dark:border-slate-700 dark:bg-[#060C18]/95">
                          <p className="font-display font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
                            {label}{' '}
                            <span className="text-slate-500 dark:text-slate-400 font-normal">
                              · {row.isForecast ? 'Forecast' : 'Historical'}
                            </span>
                          </p>
                          <div className="space-y-1 font-mono tabular-nums">
                            {row.histFx !== null && (
                              <p className="text-sky-700 dark:text-sky-300">
                                Historical: {formatFxRate(row.histFx)} / $1
                              </p>
                            )}
                            {row.isForecast && row.scenarioFx !== null && (
                              <p className="text-emerald-700 dark:text-emerald-300">
                                Scenario: {formatFxRate(row.scenarioFx)} / $1
                              </p>
                            )}
                            {row.isForecast && row.baselineFx !== null && (
                              <p className="text-slate-600 dark:text-slate-300">
                                Model Baseline: {formatFxRate(row.baselineFx)} / $1
                              </p>
                            )}
                            {row.isForecast && row.fxBand && (
                              <p className="text-slate-500 dark:text-slate-400">
                                80% Interval: {formatFxRate(row.fxBand[0])} –{' '}
                                {formatFxRate(row.fxBand[1])}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine
                    x={separatorLabel}
                    stroke="#0EA5E9"
                    strokeDasharray="4 4"
                    strokeOpacity={0.7}
                    label={{
                      value: 'Forecast Start',
                      position: 'insideTopRight',
                      fill: isDark ? '#7DD3FC' : '#0369A1',
                      fontSize: 11,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="fxBand"
                    stroke="none"
                    fill="url(#fxUncertaintyGrad)"
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="histFx"
                    stroke="#0EA5E9"
                    strokeWidth={2.3}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="baselineFx"
                    stroke={isDark ? '#94A3B8' : '#64748B'}
                    strokeWidth={1.6}
                    strokeDasharray="5 5"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="scenarioFx"
                    stroke="url(#fxScenarioLineGrad)"
                    strokeWidth={2.6}
                    strokeDasharray="3 4"
                    dot={false}
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
            relevantNote="Sliders A (Annual Inflation) and G (FX Sensitivity) directly shift the USD/NGN trajectory above in real time."
          />
        </div>
      </div>
    </section>
  );
};
