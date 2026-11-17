import React, { useState } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  BusinessInsight,
  RiskEvent,
  RiskIntelligenceReport,
} from '../types/analytics';
import { formatNgnCompact, formatPct } from '../utils/formatters';

interface RiskAndInsightsSectionProps {
  riskReport: RiskIntelligenceReport;
  insights: BusinessInsight[];
  showInsights?: boolean;
  showRisk?: boolean;
}

const FLAG_LABELS: Record<RiskEvent['flags'][number], string> = {
  fx_shock: 'FX MoM > 5%',
  negative_profit: 'Negative OP',
  low_margin: 'Margin < 20%',
  import_surge: 'Import Cost > 4% MoM',
};

export const RiskAndInsightsSection: React.FC<RiskAndInsightsSectionProps> = ({
  riskReport,
  insights,
  showInsights = true,
  showRisk = true,
}) => {
  const [periodFilter, setPeriodFilter] = useState<'all' | 'forecast' | 'historical'>('all');

  const filteredEvents = riskReport.events.filter((ev) =>
    periodFilter === 'all' ? true : ev.period === periodFilter
  );

  const ruleRows = [
    {
      rule: 'Monthly FX Surge (> 5.0% MoM)',
      historical: riskReport.historicalCounts.fxShockMonths,
      projected: riskReport.projectedCounts.fxShockMonths,
    },
    {
      rule: 'Negative Operating Profit (< ₦0)',
      historical: riskReport.historicalCounts.negativeProfitMonths,
      projected: riskReport.projectedCounts.negativeProfitMonths,
    },
    {
      rule: 'Operating Margin Compression (< 20%)',
      historical: riskReport.historicalCounts.lowMarginMonths,
      projected: riskReport.projectedCounts.lowMarginMonths,
    },
    {
      rule: 'Rapid Import Cost Increase (> 4.0% MoM)',
      historical: riskReport.historicalCounts.importSurgeMonths,
      projected: riskReport.projectedCounts.importSurgeMonths,
    },
  ];

  return (
    <section id="risk-insights" className="space-y-8">
      {/* Section G: Data-Grounded Business Insights */}
      {showInsights && (
        <div className="space-y-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Data-Grounded Business Insights
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Every numerical figure below is computed directly by running counterfactual simulations on your uploaded CSV and active slider values.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {insights.map((ins) => (
              <article
                key={ins.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white/85 p-5 dark:border-slate-800/90 dark:bg-[#0B1426]/90 space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {ins.title}
                  </h3>
                  <span className="font-mono text-sm font-semibold text-sky-700 dark:text-emerald-300 tabular-nums shrink-0">
                    {ins.headlineValue}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                  {ins.summary}
                </p>
                <p className="border-t border-slate-200/80 dark:border-slate-800/70 pt-2.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  {ins.detail}
                </p>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* Section F: Risk Intelligence */}
      {showRisk && (
        <div className="space-y-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              Risk Intelligence &amp; Stress Flag Audit
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {riskReport.classificationFeasible
                ? 'Cross-validated risk classification model active.'
                : 'Rule-based threshold monitor (no invented ML probabilities).'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            {/* Left: Rule Threshold Summary + Feasibility Disclosure */}
            <div className="lg:col-span-2 rounded-xl border border-slate-200/90 bg-white/85 p-5 dark:border-slate-800/90 dark:bg-[#0B1426]/90 space-y-4">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden="true" />
                <div className="space-y-1">
                  <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {riskReport.classificationFeasible
                      ? 'Classification Model Status'
                      : 'Rule-Based Risk Method Disclosure'}
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {riskReport.feasibilityReason}
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-200/80 dark:border-slate-800/80 pt-3">
                <p className="text-xs font-medium text-slate-800 dark:text-slate-200 mb-2">
                  Active Scenario Risk Outlook
                </p>
                <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-200/90">
                  {riskReport.peakRiskPeriodSummary}
                </p>
              </div>

              <div className="border-t border-slate-200/80 dark:border-slate-800/80 pt-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800/70">
                      <th className="pb-2 text-left font-medium">Risk Condition</th>
                      <th className="pb-2 text-right font-medium">Hist.</th>
                      <th className="pb-2 text-right font-medium">Proj.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/50 font-mono tabular-nums">
                    {ruleRows.map((r) => (
                      <tr key={r.rule}>
                        <td className="py-2 font-sans text-slate-700 dark:text-slate-200 pr-2">
                          {r.rule}
                        </td>
                        <td className="py-2 text-right text-slate-600 dark:text-slate-300">
                          {r.historical}m
                        </td>
                        <td
                          className={`py-2 text-right font-semibold ${
                            r.projected > 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-300'
                          }`}
                        >
                          {r.projected}m
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Flagged Months Table */}
            <div className="lg:col-span-3 rounded-xl border border-slate-200/90 bg-white/85 dark:border-slate-800/90 dark:bg-[#0B1426]/90 overflow-hidden flex flex-col">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 dark:border-slate-800/80 px-5 py-3.5">
                <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Flagged Risk Periods ({filteredEvents.length})
                </h3>
                <div
                  role="group"
                  aria-label="Filter risk periods"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-[#060C18]"
                >
                  {(
                    [
                      ['all', 'All'],
                      ['forecast', 'Forecast'],
                      ['historical', 'Historical'],
                    ] as const
                  ).map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setPeriodFilter(k)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                        periodFilter === k
                          ? 'bg-gradient-to-r from-sky-600 to-emerald-500 text-white font-semibold'
                          : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredEvents.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
                  <TrendingUp className="h-6 w-6 text-emerald-500 dark:text-emerald-400 mb-2" aria-hidden="true" />
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    No risk thresholds breached in this selection
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md">
                    Try switching to the Stress Case preset or lowering pricing pass-through to observe margin compression and negative-profit risk periods.
                  </p>
                </div>
              ) : (
                <div className="max-h-[340px] overflow-y-auto overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 border-b border-slate-200/80 bg-slate-50/95 text-slate-500 dark:border-slate-800/80 dark:bg-[#081020] dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">Month</th>
                        <th className="px-4 py-2.5 font-medium">Horizon</th>
                        <th className="px-4 py-2.5 font-medium text-right">FX MoM</th>
                        <th className="px-4 py-2.5 font-medium text-right">Op Profit</th>
                        <th className="px-4 py-2.5 font-medium text-right">Op Margin</th>
                        <th className="px-4 py-2.5 font-medium">Triggered Indicators</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/60 font-mono tabular-nums">
                      {filteredEvents.map((ev) => (
                        <tr
                          key={`${ev.period}-${ev.dateKey}`}
                          className="hover:bg-slate-100/60 dark:hover:bg-slate-800/30"
                        >
                          <td className="px-4 py-2.5 font-sans font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {ev.label}
                          </td>
                          <td className="px-4 py-2.5 font-sans text-slate-600 dark:text-slate-300 capitalize">
                            {ev.period}
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right ${
                              ev.fxMoMPct > 5
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {formatPct(ev.fxMoMPct, 2, true)}
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right ${
                              ev.operatingProfitNgn < 0
                                ? 'text-rose-600 dark:text-rose-400 font-semibold'
                                : 'text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            {formatNgnCompact(ev.operatingProfitNgn)}
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right ${
                              ev.operatingMarginPct < 20
                                ? 'text-amber-600 dark:text-amber-300'
                                : 'text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {formatPct(ev.operatingMarginPct, 1)}
                          </td>
                          <td className="px-4 py-2.5 font-sans text-slate-700 dark:text-slate-200">
                            <span className="inline-flex items-center gap-1.5">
                              {ev.severity === 'critical' ? (
                                <TrendingDown
                                  className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400 shrink-0"
                                  aria-hidden="true"
                                />
                              ) : (
                                <AlertTriangle
                                  className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400 shrink-0"
                                  aria-hidden="true"
                                />
                              )}
                              <span>
                                {ev.flags.map((f) => FLAG_LABELS[f]).join(' · ')}
                              </span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
