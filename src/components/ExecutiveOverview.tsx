import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import {
  DatasetSummary,
  ScenarioResult,
} from '../types/analytics';
import {
  formatFxRate,
  formatNgnCompact,
  formatPct,
} from '../utils/formatters';
import { DashboardPage } from './TopBar';

interface ExecutiveOverviewProps {
  summary: DatasetSummary;
  currentScenario: ScenarioResult;
  baseScenario: ScenarioResult;
  onNavigate?: (page: DashboardPage) => void;
}

export const ExecutiveOverview: React.FC<ExecutiveOverviewProps> = ({
  summary,
  currentScenario,
  baseScenario,
  onNavigate,
}) => {
  const cur = currentScenario.summary;
  const base = baseScenario.summary;
  const isCustomOrAlt = currentScenario.params.presetId !== 'base';

  const fxDeltaVsHistPct =
    ((cur.endFxRateSep2031 - summary.latestFxRate) / summary.latestFxRate) * 100;
  const fxDeltaVsBase = cur.endFxRateSep2031 - base.endFxRateSep2031;

  const opEndDeltaVsHistPct =
    summary.latestOperatingProfit !== 0
      ? ((cur.endMonthlyOperatingProfitSep2031 - summary.latestOperatingProfit) /
          Math.abs(summary.latestOperatingProfit)) *
        100
      : 0;
  const opCumDeltaVsBase =
    cur.cumulative5YrOperatingProfit - base.cumulative5YrOperatingProfit;
  const revDeltaVsBase = cur.total5YrRevenue - base.total5YrRevenue;
  const marginDeltaVsBase =
    cur.overall5YrOperatingMarginPct - base.overall5YrOperatingMarginPct;

  const kpis = [
    {
      label: 'Latest Historical USD/NGN',
      sublabel: summary.endDateLabel,
      value: formatFxRate(summary.latestFxRate),
      footnote: `YoY inflation ${formatPct(summary.latestInflationPct, 2)}`,
      accent: 'text-sky-700 dark:text-sky-300',
    },
    {
      label: 'Forecast USD/NGN',
      sublabel: 'Sep 2031',
      value: formatFxRate(cur.endFxRateSep2031),
      footnote: isCustomOrAlt
        ? `${fxDeltaVsBase >= 0 ? '+' : ''}${formatFxRate(fxDeltaVsBase)} vs Base`
        : `${formatPct(fxDeltaVsHistPct, 1, true)} over 5 yrs`,
      accent: 'text-emerald-600 dark:text-emerald-300',
    },
    {
      label: 'Latest Monthly Operating Profit',
      sublabel: summary.endDateLabel,
      value: formatNgnCompact(summary.latestOperatingProfit),
      footnote: `Margin ${formatPct(summary.latestOperatingMarginPct, 1)}`,
      accent: 'text-sky-700 dark:text-sky-300',
    },
    {
      label: 'Forecast Monthly Operating Profit',
      sublabel: 'Sep 2031',
      value: formatNgnCompact(cur.endMonthlyOperatingProfitSep2031),
      footnote: `${formatPct(opEndDeltaVsHistPct, 1, true)} vs ${summary.endDateLabel}`,
      accent:
        cur.endMonthlyOperatingProfitSep2031 < 0
          ? 'text-rose-600 dark:text-rose-400'
          : 'text-emerald-600 dark:text-emerald-300',
    },
    {
      label: '5-Year Forecast Revenue',
      sublabel: 'Oct 2026 – Sep 2031',
      value: formatNgnCompact(cur.total5YrRevenue),
      footnote: isCustomOrAlt
        ? `${formatNgnCompact(revDeltaVsBase, true)} vs Base`
        : '60-month cumulative',
      accent: 'text-slate-900 dark:text-slate-50',
    },
    {
      label: '5-Year Cumulative Operating Profit',
      sublabel: 'Oct 2026 – Sep 2031',
      value: formatNgnCompact(cur.cumulative5YrOperatingProfit),
      footnote: isCustomOrAlt
        ? `${formatNgnCompact(opCumDeltaVsBase, true)} vs Base`
        : `Gross profit ${formatNgnCompact(cur.total5YrGrossProfit)}`,
      accent:
        cur.cumulative5YrOperatingProfit < 0
          ? 'text-rose-600 dark:text-rose-400'
          : 'text-slate-900 dark:text-slate-50',
    },
    {
      label: 'Forecast Operating Margin',
      sublabel: '5-Year Weighted Avg',
      value: formatPct(cur.overall5YrOperatingMarginPct, 2),
      footnote: isCustomOrAlt
        ? `${formatPct(marginDeltaVsBase, 2, true)} vs Base (${formatPct(base.overall5YrOperatingMarginPct, 1)})`
        : `Gross margin ${formatPct(cur.overall5YrGrossMarginPct, 1)}`,
      accent:
        cur.overall5YrOperatingMarginPct < 20
          ? 'text-amber-600 dark:text-amber-300'
          : 'text-emerald-600 dark:text-emerald-300',
    },
  ];

  return (
    <section id="overview" aria-labelledby="overview-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="overview-heading"
            className="font-display text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            Executive Overview
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Historical anchor: {summary.endDateLabel} · Horizon: 60 months (Oct 2026 – Sep 2031)
          </p>
        </div>

        {onNavigate && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('usd-forecast')}
              className="inline-flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-500/8 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-500/15 dark:text-sky-300 dark:hover:bg-sky-500/20 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Open USD/NGN Chart Page</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('profit-forecast')}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/8 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/20 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Open Operating Profit Page</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white/85 p-4 transition-colors hover:border-sky-300 dark:border-slate-800/90 dark:bg-[#0B1426]/90 dark:hover:border-slate-700"
          >
            <div>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-snug">
                {kpi.label}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-500">
                {kpi.sublabel}
              </p>
            </div>
            <div className="mt-3">
              <p
                className={`font-mono text-xl font-semibold tracking-tight tabular-nums ${kpi.accent}`}
              >
                {kpi.value}
              </p>
              <p className="mt-1 font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums truncate">
                {kpi.footnote}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
