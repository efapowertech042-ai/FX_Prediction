import {
  BusinessInsight,
  ForecastingModelOutput,
  HistoricalRow,
  RiskEvent,
  RiskIntelligenceReport,
  ScenarioResult,
} from '../types/analytics';
import {
  formatFxRate,
  formatNgnCompact,
  formatPct,
} from '../utils/formatters';
import { runFinancialForecast } from './financialEngine';

export function evaluateRiskIntelligence(
  historical: HistoricalRow[],
  activeScenario: ScenarioResult
): RiskIntelligenceReport {
  const events: RiskEvent[] = [];

  let histFxShock = 0;
  let histNegProfit = 0;
  let histLowMargin = 0;
  let histImportSurge = 0;

  for (let i = 0; i < historical.length; i++) {
    const r = historical[i];
    const fxMoM = r.fxChangeMoMPct ?? 0;
    const importMoM =
      i > 0
        ? ((r.importCostNgnPerUnit - historical[i - 1].importCostNgnPerUnit) /
            historical[i - 1].importCostNgnPerUnit) *
          100
        : 0;

    const flags: RiskEvent['flags'] = [];
    if (fxMoM > 5) {
      flags.push('fx_shock');
      histFxShock++;
    }
    if (r.operatingProfitNgn < 0) {
      flags.push('negative_profit');
      histNegProfit++;
    }
    if (r.operatingMarginPct < 20) {
      flags.push('low_margin');
      histLowMargin++;
    }
    if (importMoM > 4) {
      flags.push('import_surge');
      histImportSurge++;
    }

    if (flags.length > 0) {
      events.push({
        dateKey: r.dateKey,
        label: r.label,
        period: 'historical',
        fxMoMPct: fxMoM,
        operatingProfitNgn: r.operatingProfitNgn,
        operatingMarginPct: r.operatingMarginPct,
        importCostMoMPct: importMoM,
        flags,
        severity:
          flags.includes('negative_profit') || flags.length >= 2
            ? 'critical'
            : 'elevated',
      });
    }
  }

  // Evaluate statistical feasibility of binary ML classification on historical data
  const minExamplesForClassifier = 15;
  const classificationFeasible =
    histNegProfit >= minExamplesForClassifier &&
    histLowMargin >= minExamplesForClassifier;

  const feasibilityReason = classificationFeasible
    ? `Sufficient historical distress observations exist (${histNegProfit} negative-profit months) for cross-validated risk classification.`
    : `Rule-based risk engine active: Historical data contains only ${histNegProfit} negative-profit month(s), ${histLowMargin} margin-below-20% month(s), and ${histFxShock} FX shock month(s) (>5% MoM) across ${historical.length} observations. Because positive-class samples are below the 15-event reliability threshold, training a binary ML classifier would produce unstable, overfitted probabilities—transparent deterministic thresholds are used instead.`;

  let projFxShock = 0;
  let projNegProfit = 0;
  let projLowMargin = 0;
  let projImportSurge = 0;

  let worstMonth: RiskIntelligenceReport['worstProjectedMonth'] = null;
  const lastHist = historical[historical.length - 1];

  const fc = activeScenario.monthly;
  for (let i = 0; i < fc.length; i++) {
    const p = fc[i];
    const prevImportNgn =
      i === 0 ? lastHist.importCostNgnPerUnit : fc[i - 1].importCostNgnPerUnit;
    const importMoM =
      ((p.importCostNgnPerUnit - prevImportNgn) / prevImportNgn) * 100;

    if (
      !worstMonth ||
      p.operatingProfitNgn < worstMonth.operatingProfitNgn
    ) {
      worstMonth = {
        label: p.label,
        operatingProfitNgn: p.operatingProfitNgn,
        operatingMarginPct: p.operatingMarginPct,
      };
    }

    const flags: RiskEvent['flags'] = [];
    if (p.fxChangeMoMPct > 5) {
      flags.push('fx_shock');
      projFxShock++;
    }
    if (p.operatingProfitNgn < 0) {
      flags.push('negative_profit');
      projNegProfit++;
    }
    if (p.operatingMarginPct < 20) {
      flags.push('low_margin');
      projLowMargin++;
    }
    if (importMoM > 4) {
      flags.push('import_surge');
      projImportSurge++;
    }

    if (flags.length > 0) {
      events.push({
        dateKey: p.dateKey,
        label: p.label,
        period: 'forecast',
        fxMoMPct: p.fxChangeMoMPct,
        operatingProfitNgn: p.operatingProfitNgn,
        operatingMarginPct: p.operatingMarginPct,
        importCostMoMPct: importMoM,
        flags,
        severity:
          flags.includes('negative_profit') || flags.length >= 2
            ? 'critical'
            : 'elevated',
      });
    }
  }

  let peakRiskPeriodSummary = 'No projected operating margin breaches (<20%) or operating losses under current scenario assumptions.';
  if (projNegProfit > 0 && worstMonth) {
    peakRiskPeriodSummary = `${projNegProfit} projected month(s) fall into negative operating profit, troughing in ${worstMonth.label} (${formatNgnCompact(worstMonth.operatingProfitNgn)}, ${formatPct(worstMonth.operatingMarginPct, 1)} margin).`;
  } else if (projLowMargin > 0 && worstMonth) {
    peakRiskPeriodSummary = `${projLowMargin} projected month(s) breach the 20% operating margin threshold without turning negative; lowest margin occurs in ${worstMonth.label} (${formatPct(worstMonth.operatingMarginPct, 1)}).`;
  } else if (projImportSurge > 0) {
    peakRiskPeriodSummary = `${projImportSurge} projected month(s) experience >4% MoM import cost growth, though pricing pass-through preserves operating margins above 20%.`;
  }

  return {
    classificationFeasible,
    feasibilityReason,
    historicalCounts: {
      totalMonths: historical.length,
      fxShockMonths: histFxShock,
      negativeProfitMonths: histNegProfit,
      lowMarginMonths: histLowMargin,
      importSurgeMonths: histImportSurge,
    },
    projectedCounts: {
      totalMonths: fc.length,
      fxShockMonths: projFxShock,
      negativeProfitMonths: projNegProfit,
      lowMarginMonths: projLowMargin,
      importSurgeMonths: projImportSurge,
    },
    worstProjectedMonth: worstMonth,
    peakRiskPeriodSummary,
    events,
  };
}

export function generateDataGroundedInsights(
  historical: HistoricalRow[],
  modelOutput: ForecastingModelOutput,
  currentScenario: ScenarioResult,
  baseScenario: ScenarioResult,
  stressScenario: ScenarioResult
): BusinessInsight[] {
  const insights: BusinessInsight[] = [];
  const params = currentScenario.params;

  // 1. +5 percentage points inflation shock counterfactual
  const plus5InfParams = {
    ...params,
    presetId: 'custom' as const,
    annualInflationPct: Math.min(50, params.annualInflationPct + 5),
  };
  const plus5Result = runFinancialForecast(historical, modelOutput, plus5InfParams);
  const deltaFxPlus5 =
    plus5Result.summary.endFxRateSep2031 - currentScenario.summary.endFxRateSep2031;
  const deltaOpPlus5 =
    plus5Result.summary.cumulative5YrOperatingProfit -
    currentScenario.summary.cumulative5YrOperatingProfit;
  const deltaMarginPlus5 =
    plus5Result.summary.overall5YrOperatingMarginPct -
    currentScenario.summary.overall5YrOperatingMarginPct;

  insights.push({
    id: 'inflation-plus-5',
    title: 'Impact of +5pp Annual Inflation Shock',
    category: 'inflation',
    headlineValue: formatNgnCompact(deltaOpPlus5, true),
    summary: `Raising annual inflation from ${formatPct(params.annualInflationPct, 2)} to ${formatPct(plus5InfParams.annualInflationPct, 2)} shifts 5-year cumulative operating profit by ${formatNgnCompact(deltaOpPlus5, true)} and moves the Sep 2031 USD/NGN rate by ${deltaFxPlus5 >= 0 ? '+' : ''}${formatFxRate(deltaFxPlus5)}.`,
    detail: `Five-year operating margin changes by ${formatPct(deltaMarginPlus5, 2, true)} (to ${formatPct(plus5Result.summary.overall5YrOperatingMarginPct, 2)}), driven by higher local operating cost compounding and inflation-linked FX pressure.`,
  });

  // 2. Price & FX pass-through protection counterfactual (+15pp pass-through)
  const boostedPricePt = Math.min(100, params.priceInflationPassThroughPct + 15);
  const boostedFxPt = Math.min(100, params.fxCostPassThroughPct + 15);
  const passThroughParams = {
    ...params,
    presetId: 'custom' as const,
    priceInflationPassThroughPct: boostedPricePt,
    fxCostPassThroughPct: boostedFxPt,
  };
  const ptResult = runFinancialForecast(historical, modelOutput, passThroughParams);
  const ptDeltaOp =
    ptResult.summary.cumulative5YrOperatingProfit -
    currentScenario.summary.cumulative5YrOperatingProfit;
  const ptDeltaMargin =
    ptResult.summary.overall5YrOperatingMarginPct -
    currentScenario.summary.overall5YrOperatingMarginPct;

  insights.push({
    id: 'passthrough-protection',
    title: 'Margin Protection via Pricing Pass-Through',
    category: 'pricing',
    headlineValue: formatPct(ptDeltaMargin, 2, true),
    summary:
      boostedPricePt === params.priceInflationPassThroughPct &&
      boostedFxPt === params.fxCostPassThroughPct
        ? `Both pricing pass-through levers are already at 100%, capturing full cost recovery on customer pricing.`
        : `Increasing inflation & FX pass-through by up to +15pp (to ${boostedPricePt}% / ${boostedFxPt}%) lifts 5-year operating margin by ${formatPct(ptDeltaMargin, 2, true)} and adds ${formatNgnCompact(ptDeltaOp, true)} in cumulative profit.`,
    detail: `Under this pricing adjustment, Sep 2031 monthly operating profit reaches ${formatNgnCompact(ptResult.summary.endMonthlyOperatingProfitSep2031)} compared to ${formatNgnCompact(currentScenario.summary.endMonthlyOperatingProfitSep2031)} in the current scenario.`,
  });

  // 3. Base vs Stress (and Current vs Base) cumulative profit spread
  const baseVsStressProfitDiff =
    baseScenario.summary.cumulative5YrOperatingProfit -
    stressScenario.summary.cumulative5YrOperatingProfit;
  const currentVsBaseDiff =
    currentScenario.summary.cumulative5YrOperatingProfit -
    baseScenario.summary.cumulative5YrOperatingProfit;

  insights.push({
    id: 'scenario-spread',
    title: 'Cumulative Profit Spread Across Scenarios',
    category: 'scenario',
    headlineValue: formatNgnCompact(baseVsStressProfitDiff),
    summary: `The 5-year cumulative operating profit gap between Base Case (${formatNgnCompact(baseScenario.summary.cumulative5YrOperatingProfit)}) and Stress Case (${formatNgnCompact(stressScenario.summary.cumulative5YrOperatingProfit)}) is ${formatNgnCompact(baseVsStressProfitDiff)}.`,
    detail:
      Math.abs(currentVsBaseDiff) < 1000
        ? `Your active scenario matches the Base Case baseline (${formatNgnCompact(baseScenario.summary.total5YrRevenue)} total 5-year revenue).`
        : `Your active scenario differs from the Base Case by ${formatNgnCompact(currentVsBaseDiff, true)} in cumulative 5-year operating profit.`,
  });

  // 4. Profitless Growth / Revenue Up, Margin Down periods
  const divergenceAnnual: string[] = [];
  const ann = currentScenario.annual;
  for (let i = 1; i < ann.length; i++) {
    // Compare full or annualized monthly average revenue vs margin
    const prevAvgRev = ann[i - 1].totalRevenueNgn / ann[i - 1].monthsCount;
    const curAvgRev = ann[i].totalRevenueNgn / ann[i].monthsCount;
    if (
      curAvgRev > prevAvgRev &&
      ann[i].operatingMarginPct < ann[i - 1].operatingMarginPct - 0.25
    ) {
      divergenceAnnual.push(
        `${ann[i].yearLabel} (margin ${formatPct(ann[i - 1].operatingMarginPct, 1)} → ${formatPct(ann[i].operatingMarginPct, 1)})`
      );
    }
  }

  // Also count monthly YoY divergences
  let monthlyDivergenceCount = 0;
  const fc = currentScenario.monthly;
  for (let i = 12; i < fc.length; i++) {
    if (
      fc[i].salesRevenueNgn > fc[i - 12].salesRevenueNgn &&
      fc[i].operatingMarginPct < fc[i - 12].operatingMarginPct - 0.25
    ) {
      monthlyDivergenceCount++;
    }
  }

  insights.push({
    id: 'margin-divergence',
    title: 'Revenue Growth vs. Margin Compression',
    category: 'margin',
    headlineValue: `${monthlyDivergenceCount} / 48 YoY mos`,
    summary:
      monthlyDivergenceCount > 0
        ? `In ${monthlyDivergenceCount} of 48 year-over-year forecast comparisons, nominal revenue grows while operating margin narrows due to imported COGS or operating expense inflation outpacing selling-price adjustments.`
        : `Across all 48 year-over-year forecast comparisons, operating margin holds steady or expands alongside nominal revenue growth.`,
    detail:
      divergenceAnnual.length > 0
        ? `Annual periods showing margin compression despite higher monthly run-rate revenue: ${divergenceAnnual.join(', ')}.`
        : `Total FX-induced cumulative import cost change relative to flat Sep 2026 FX (₦${historical[historical.length - 1].usdNgnRate.toFixed(0)}) is ${formatNgnCompact(currentScenario.summary.fxDrivenCostImpactNgn, true)} over 5 years.`,
  });

  return insights;
}
