import React from 'react';
import { BookOpenCheck } from 'lucide-react';
import { ForecastingModelOutput } from '../types/analytics';
import { formatFxRate, formatPct } from '../utils/formatters';

interface ModelTransparencySectionProps {
  modelOutput: ForecastingModelOutput;
}

export const ModelTransparencySection: React.FC<
  ModelTransparencySectionProps
> = ({ modelOutput }) => {
  return (
    <section
      id="methodology"
      aria-labelledby="transparency-heading"
      className="space-y-6"
    >
      <div className="flex items-start gap-2.5">
        <BookOpenCheck className="h-5 w-5 mt-0.5 text-sky-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
        <div>
          <h2
            id="transparency-heading"
            className="font-display text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            How the AI Prediction Works
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Complete statistical transparency separating learned historical patterns, user scenario assumptions, accounting identities, and empirical uncertainty.
          </p>
        </div>
      </div>

      {/* 4 Epistemic Pillars */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200/90 bg-white/85 p-4 dark:border-slate-800/90 dark:bg-[#0B1426]/90 space-y-2">
          <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">
            1. Learned Historical Patterns
          </h3>
          <ul className="space-y-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {modelOutput.learnedParamsSummary.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white/85 p-4 dark:border-slate-800/90 dark:bg-[#0B1426]/90 space-y-2">
          <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            2. User-Provided Assumptions
          </h3>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            Sliders A–G define scenario inputs for future annual inflation (0–50%), unit demand growth (-20% to +40%), customer price &amp; FX pass-through (0–100%), USD supplier cost inflation, OpEx sensitivity, and FX inflation sensitivity.
          </p>
          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {modelOutput.inflationSensitivity.explanation}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white/85 p-4 dark:border-slate-800/90 dark:bg-[#0B1426]/90 space-y-2">
          <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-slate-100">
            3. Calculated Business Outcomes
          </h3>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            Operating profit is never predicted independently. Every month enforces strict accounting equations:
          </p>
          <div className="font-mono text-[11px] leading-relaxed text-sky-700 dark:text-emerald-200/90 space-y-1">
            <p>Revenue = Units × Avg Price (NGN)</p>
            <p>COGS = Units × (USD Cost × FX Rate)</p>
            <p>Gross Profit = Revenue − COGS</p>
            <p>Op Profit = Gross − Mkt − Overhead</p>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            USD supplier costs, FX movements, and domestic OpEx inflation are compounded monthly without double-counting inflation.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white/85 p-4 dark:border-slate-800/90 dark:bg-[#0B1426]/90 space-y-2">
          <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-300">
            4. Why 5-Year Uncertainty Widens
          </h3>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            Exchange-rate residuals compound over time. Because historical data includes abrupt macro regime shifts (e.g., June 2023 and Q1 2024), forecast errors grow with horizon length.
          </p>
          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            The 80% uncertainty bands are calibrated directly from out-of-sample expanding-window log-residuals across 1-, 6-, and 12-month horizons and propagated through COGS into Operating Profit.
          </p>
        </div>
      </div>

      {/* 6-Point Methodology Walkthrough + Chronological Backtest Table */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="xl:col-span-2 rounded-xl border border-slate-200/90 bg-white/85 p-5 dark:border-slate-800/90 dark:bg-[#0B1426]/90 space-y-3">
          <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
            Pipeline Architecture (6 Steps)
          </h3>
          <ol className="space-y-2.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300 list-decimal pl-4">
            <li>
              <strong className="text-slate-900 dark:text-slate-100">Data Preparation:</strong>{' '}
              Parses the uploaded CSV chronologically, normalizes decimal inflation fractions (0.2067 → 20.67%), treats blank Month-1 FX change as expected, and verifies accounting totals.
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-100">Model Selection:</strong>{' '}
              Fits Log-Space Damped-Trend Exponential Smoothing, ARX-Ridge Inflation Regression, and Seasonal Lagged ARX alongside a Naive Persistence benchmark. Currently selected baseline:{' '}
              <span className="text-sky-700 dark:text-emerald-300 font-medium">{modelOutput.selectedModelName}</span>.
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-100">Inflation Slider Influence:</strong>{' '}
              Measures excess inflation above the final historical rate and shifts monthly FX drift via the disclosed sensitivity slope scaled by Slider G (1.0x default), never claiming sole causality.
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-100">Financial Compounding:</strong>{' '}
              Applies exact monthly 12th-root compounding and learned 12-month seasonal demand/marketing multipliers so Nov–Dec retail peaks appear naturally.
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-100">Chronological Backtesting:</strong>{' '}
              Uses expanding-window validation ({modelOutput.backtestStartLabel} – {modelOutput.backtestEndLabel}, {modelOutput.backtestWindowCount} rolling origins) with zero future data leakage.
            </li>
            <li>
              <strong className="text-slate-900 dark:text-slate-100">Uncertainty Propagation:</strong>{' '}
              Maps FX log-residual intervals onto unit import costs to quantify profit-at-risk across 60 months.
            </li>
          </ol>
        </div>

        {/* Backtest Comparison Table */}
        <div className="xl:col-span-3 rounded-xl border border-slate-200/90 bg-white/85 dark:border-slate-800/90 dark:bg-[#0B1426]/90 overflow-hidden">
          <div className="border-b border-slate-200/80 dark:border-slate-800/80 px-5 py-3.5 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Chronological Expanding-Window Backtest Results
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {modelOutput.backtestWindowCount} origins · {modelOutput.backtestStartLabel} – {modelOutput.backtestEndLabel}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200/80 bg-slate-50/90 text-slate-500 dark:border-slate-800/80 dark:bg-[#081020] dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-3 py-3 font-medium text-right">1m MAE</th>
                  <th className="px-3 py-3 font-medium text-right">1m RMSE</th>
                  <th className="px-3 py-3 font-medium text-right">1m MAPE</th>
                  <th className="px-3 py-3 font-medium text-right">6m RMSE</th>
                  <th className="px-3 py-3 font-medium text-right">6m MAPE</th>
                  <th className="px-3 py-3 font-medium text-right">12m RMSE</th>
                  <th className="px-4 py-3 font-medium text-right">12m MAPE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/60 font-mono tabular-nums">
                {modelOutput.modelComparison.map((m) => (
                  <tr
                    key={m.modelId}
                    className={
                      m.isSelectedBaseline
                        ? 'bg-sky-50/80 dark:bg-emerald-950/25'
                        : 'hover:bg-slate-100/60 dark:hover:bg-slate-800/30'
                    }
                  >
                    <td className="px-4 py-3 font-sans">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {m.shortName}
                        {m.isSelectedBaseline && (
                          <span className="ml-2 text-[11px] font-normal text-sky-700 dark:text-emerald-300">
                            · Selected
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-[230px]">
                        {m.description}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700 dark:text-slate-200">
                      {formatFxRate(m.mae1Step)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700 dark:text-slate-200">
                      {formatFxRate(m.rmse1Step)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-600 dark:text-slate-300">
                      {formatPct(m.mape1Step, 2)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700 dark:text-slate-200">
                      {formatFxRate(m.rmse6Step)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-600 dark:text-slate-300">
                      {formatPct(m.mape6Step, 2)}
                    </td>
                    <td className="px-3 py-3 text-right text-sky-700 dark:text-emerald-300 font-medium">
                      {formatFxRate(m.rmse12Step)}
                    </td>
                    <td className="px-4 py-3 text-right text-sky-700 dark:text-emerald-300 font-medium">
                      {formatPct(m.mape12Step, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-200/80 dark:border-slate-800/80 px-5 py-3 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Note: Backtesting spans the 2023–2024 discrete FX regime transition (including a +49.7% single-month jump in June 2023), which elevates multi-step RMSE across all statistical models—demonstrating why wide uncertainty bands are essential for 5-year planning.
          </div>
        </div>
      </div>
    </section>
  );
};
