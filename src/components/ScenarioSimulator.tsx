import React, { useState } from 'react';
import { Info, RotateCcw, SlidersHorizontal } from 'lucide-react';
import {
  ScenarioParams,
  ScenarioPresetId,
} from '../types/analytics';

interface ScenarioSimulatorProps {
  params: ScenarioParams;
  latestInflationPct: number;
  onChangeParams: (next: ScenarioParams) => void;
  onSelectPreset: (presetId: Exclude<ScenarioPresetId, 'custom'>) => void;
  onResetBaseline: () => void;
  variant?: 'full' | 'compact';
  relevantNote?: string;
}

interface SliderConfig {
  key: keyof Omit<ScenarioParams, 'presetId'>;
  code: string;
  label: string;
  shortLabel: string;
  description: string;
  min: number;
  max: number;
  step: number;
  formatValue: (v: number) => string;
  minLabel: string;
  maxLabel: string;
}

export const ScenarioSimulator: React.FC<ScenarioSimulatorProps> = ({
  params,
  latestInflationPct,
  onChangeParams,
  onSelectPreset,
  onResetBaseline,
  variant = 'full',
  relevantNote,
}) => {
  const [expandedInfoKey, setExpandedInfoKey] = useState<string | null>(null);

  const sliders: SliderConfig[] = [
    {
      key: 'annualInflationPct',
      code: 'A',
      label: 'Annual Inflation Rate',
      shortLabel: 'Annual Inflation',
      description: `Default ${latestInflationPct.toFixed(2)}% (latest historical). Drives local costs, price pressure & FX scenario sensitivity.`,
      min: 0,
      max: 50,
      step: 0.1,
      formatValue: (v) => `${v.toFixed(2)}%`,
      minLabel: '0%',
      maxLabel: '50%',
    },
    {
      key: 'annualUnitSalesGrowthPct',
      code: 'B',
      label: 'Annual Unit Sales Growth',
      shortLabel: 'Unit Sales Growth',
      description: 'Compounded annual change in unit demand layered onto learned monthly seasonality.',
      min: -20,
      max: 40,
      step: 0.5,
      formatValue: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
      minLabel: '-20%',
      maxLabel: '+40%',
    },
    {
      key: 'priceInflationPassThroughPct',
      code: 'C',
      label: 'Selling Price Inflation Pass-Through',
      shortLabel: 'Price Inflation Pass-Through',
      description: 'Share of domestic inflation pressure reflected in customer selling prices.',
      min: 0,
      max: 100,
      step: 1,
      formatValue: (v) => `${v.toFixed(0)}%`,
      minLabel: '0%',
      maxLabel: '100%',
    },
    {
      key: 'fxCostPassThroughPct',
      code: 'D',
      label: 'FX Cost Pass-Through',
      shortLabel: 'FX Cost Pass-Through',
      description: 'Share of exchange-rate import cost pressure passed into customer prices.',
      min: 0,
      max: 100,
      step: 1,
      formatValue: (v) => `${v.toFixed(0)}%`,
      minLabel: '0%',
      maxLabel: '100%',
    },
    {
      key: 'annualUsdImportCostGrowthPct',
      code: 'E',
      label: 'Annual USD Import Cost Growth',
      shortLabel: 'USD Import Cost Growth',
      description: 'Supplier unit cost inflation in US dollars, kept strictly separate from Naira inflation.',
      min: -10,
      max: 25,
      step: 0.5,
      formatValue: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
      minLabel: '-10%',
      maxLabel: '+25%',
    },
    {
      key: 'opExInflationSensitivityPct',
      code: 'F',
      label: 'Operating Cost Inflation Sensitivity',
      shortLabel: 'OpEx Inflation Sensitivity',
      description: 'Multiplier controlling how strongly inflation raises marketing and local overhead expenses.',
      min: 0,
      max: 200,
      step: 5,
      formatValue: (v) => `${v.toFixed(0)}%`,
      minLabel: '0%',
      maxLabel: '200%',
    },
    {
      key: 'fxInflationSensitivityMult',
      code: 'G',
      label: 'Exchange-Rate Inflation Sensitivity',
      shortLabel: 'FX Inflation Sensitivity',
      description: 'Scenario sensitivity multiplier around estimated inflation-to-FX relationship — not a proven economic law.',
      min: 0,
      max: 2.5,
      step: 0.1,
      formatValue: (v) => `${v.toFixed(1)}x`,
      minLabel: '0.0x',
      maxLabel: '2.5x',
    },
  ];

  const handleSliderChange = (
    key: keyof Omit<ScenarioParams, 'presetId'>,
    rawVal: string
  ) => {
    const val = Number(rawVal);
    if (!Number.isFinite(val)) return;
    onChangeParams({
      ...params,
      presetId: 'custom',
      [key]: val,
    });
  };

  const presets: Array<{ id: ScenarioPresetId; label: string; short: string }> = [
    { id: 'base', label: 'Base Case', short: 'Base' },
    { id: 'optimistic', label: 'Optimistic', short: 'Opt' },
    { id: 'stress', label: 'Stress Case', short: 'Stress' },
    { id: 'custom', label: 'Custom', short: 'Custom' },
  ];

  if (variant === 'compact') {
    return (
      <aside
        aria-labelledby="compact-simulator-heading"
        className="rounded-xl border border-slate-200/90 bg-white/85 p-4 dark:border-slate-800/90 dark:bg-[#0B1426]/85 backdrop-blur-sm space-y-3.5"
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 pb-3 dark:border-slate-800/80">
          <div className="flex items-center gap-2 min-w-0">
            <SlidersHorizontal
              className="h-3.5 w-3.5 text-sky-600 dark:text-emerald-400 shrink-0"
              aria-hidden="true"
            />
            <h2
              id="compact-simulator-heading"
              className="font-display text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200 truncate"
            >
              Live Scenario Controls
            </h2>
          </div>
          <button
            type="button"
            onClick={onResetBaseline}
            title="Reset all controls to Baseline"
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-sky-400 hover:text-slate-950 dark:border-slate-700/80 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-emerald-400/50 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="h-3 w-3 text-sky-600 dark:text-emerald-400" aria-hidden="true" />
            <span>Reset</span>
          </button>
        </div>

        {/* Compact Preset Tabs */}
        <div
          role="group"
          aria-label="Scenario presets"
          className="grid grid-cols-4 gap-1 rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 dark:border-slate-800 dark:bg-[#060C18]"
        >
          {presets.map((p) => {
            const active = params.presetId === p.id;
            const disabled = p.id === 'custom' && params.presetId !== 'custom';
            return (
              <button
                key={p.id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (p.id !== 'custom') onSelectPreset(p.id);
                }}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition-all whitespace-nowrap ${
                  active
                    ? 'bg-gradient-to-r from-sky-600 to-emerald-500 text-white font-semibold'
                    : disabled
                    ? 'text-slate-400 dark:text-slate-600 cursor-default'
                    : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white cursor-pointer'
                }`}
              >
                {p.short}
              </button>
            );
          })}
        </div>

        {relevantNote && (
          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {relevantNote}
          </p>
        )}

        {/* Subtle Vertical Stack of All 7 Precision Equalizer Faders */}
        <div className="space-y-2.5">
          {sliders.map((s) => {
            const val = params[s.key];
            const pct = Math.max(
              0,
              Math.min(100, ((val - s.min) / (s.max - s.min)) * 100)
            );
            const infoOpen = expandedInfoKey === s.key;

            return (
              <div
                key={s.key}
                className="rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-100/70 dark:hover:bg-slate-800/35"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <label
                      htmlFor={`compact-slider-${s.key}`}
                      className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate"
                      title={s.description}
                    >
                      <span className="font-mono text-[11px] text-sky-600 dark:text-emerald-400 mr-1">
                        {s.code}.
                      </span>
                      {s.shortLabel}
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedInfoKey(infoOpen ? null : s.key)
                      }
                      aria-label={`Details for ${s.label}`}
                      aria-expanded={infoOpen}
                      className="text-slate-400 hover:text-sky-600 dark:hover:text-emerald-300 shrink-0 cursor-pointer"
                    >
                      <Info className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                  <span className="font-mono text-xs font-semibold text-sky-700 dark:text-emerald-300 tabular-nums shrink-0">
                    {s.formatValue(val)}
                  </span>
                </div>

                <div className="relative mt-0.5 flex h-5 items-center">
                  <div className="pointer-events-none absolute inset-x-0 h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-500 to-emerald-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <input
                    id={`compact-slider-${s.key}`}
                    type="range"
                    min={s.min}
                    max={s.max}
                    step={s.step}
                    value={val}
                    onChange={(e) => handleSliderChange(s.key, e.target.value)}
                    className="eq-slider relative z-10"
                  />
                </div>

                <div className="flex items-center justify-between font-mono text-[10px] text-slate-400 dark:text-slate-500">
                  <span>{s.minLabel}</span>
                  <span>{s.maxLabel}</span>
                </div>

                {infoOpen && (
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                    {s.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </aside>
    );
  }

  return (
    <section
      aria-labelledby="simulator-heading"
      className="rounded-xl border border-slate-200/90 bg-white/85 p-5 dark:border-slate-800/90 dark:bg-[#0B1426]/90"
    >
      <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-4 dark:border-slate-800/80 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <SlidersHorizontal
              className="h-4 w-4 text-sky-600 dark:text-emerald-400"
              aria-hidden="true"
            />
            <h2
              id="simulator-heading"
              className="font-display text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Interactive Scenario Simulator
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Adjust macro and pricing faders below; all 60-month forecast lines, margins, risks, and insights recalculate instantaneously.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div
            role="group"
            aria-label="Scenario presets"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-[#060C18]"
          >
            {presets.map((p) => {
              const active = params.presetId === p.id;
              const disabled = p.id === 'custom' && params.presetId !== 'custom';
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (p.id !== 'custom') onSelectPreset(p.id);
                  }}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-gradient-to-r from-sky-600 to-emerald-500 text-white font-semibold'
                      : disabled
                      ? 'text-slate-400 dark:text-slate-600 cursor-default'
                      : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white cursor-pointer'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onResetBaseline}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-sky-400 hover:text-slate-950 dark:border-slate-700/80 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-emerald-400/50 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5 text-sky-600 dark:text-emerald-400" aria-hidden="true" />
            <span>Reset to Baseline</span>
          </button>
        </div>
      </div>

      {/* Equalizer Console Grid */}
      <div className="mt-5 grid grid-cols-1 gap-x-7 gap-y-5 md:grid-cols-2 xl:grid-cols-4">
        {sliders.map((s) => {
          const val = params[s.key];
          const pct = Math.max(
            0,
            Math.min(100, ((val - s.min) / (s.max - s.min)) * 100)
          );

          return (
            <div key={s.key} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <label
                  htmlFor={`slider-${s.key}`}
                  className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate"
                >
                  <span className="font-mono text-sky-600 dark:text-emerald-400 mr-1.5">
                    {s.code}.
                  </span>
                  {s.label}
                </label>
                <span className="font-mono text-sm font-semibold text-sky-700 dark:text-emerald-300 tabular-nums shrink-0">
                  {s.formatValue(val)}
                </span>
              </div>

              <div className="relative flex h-5 items-center">
                <div className="pointer-events-none absolute inset-x-0 h-1 rounded-full bg-slate-200 dark:bg-slate-800/90 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 to-emerald-400"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 flex justify-between px-0.5"
                >
                  {[0, 1, 2, 3, 4].map((tick) => (
                    <span
                      key={tick}
                      className="h-2 w-px bg-slate-300 dark:bg-slate-600/60"
                    />
                  ))}
                </div>
                <input
                  id={`slider-${s.key}`}
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={val}
                  onChange={(e) => handleSliderChange(s.key, e.target.value)}
                  className="eq-slider relative z-10"
                />
              </div>

              <div className="flex items-center justify-between font-mono text-[10px] text-slate-400 dark:text-slate-500">
                <span>{s.minLabel}</span>
                <span>{s.maxLabel}</span>
              </div>

              <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                {s.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
};
