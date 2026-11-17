import {
  AnnualSummaryRow,
  ForecastingModelOutput,
  ForecastPoint,
  HistoricalRow,
  ScenarioParams,
  ScenarioPresetId,
  ScenarioResult,
} from '../types/analytics';

export function getPresetParams(
  presetId: Exclude<ScenarioPresetId, 'custom'>,
  latestInflationPct: number
): ScenarioParams {
  const baseInf = Number(latestInflationPct.toFixed(2));
  switch (presetId) {
    case 'base':
      return {
        presetId: 'base',
        annualInflationPct: baseInf,
        annualUnitSalesGrowthPct: 10,
        priceInflationPassThroughPct: 60,
        fxCostPassThroughPct: 60,
        annualUsdImportCostGrowthPct: 3,
        opExInflationSensitivityPct: 100,
        fxInflationSensitivityMult: 1.0,
      };
    case 'optimistic':
      return {
        presetId: 'optimistic',
        annualInflationPct: Math.max(8, Number((baseInf - 6.5).toFixed(1))),
        annualUnitSalesGrowthPct: 18,
        priceInflationPassThroughPct: 75,
        fxCostPassThroughPct: 75,
        annualUsdImportCostGrowthPct: 1,
        opExInflationSensitivityPct: 85,
        fxInflationSensitivityMult: 0.7,
      };
    case 'stress':
      return {
        presetId: 'stress',
        annualInflationPct: Math.min(50, Number((baseInf + 13.5).toFixed(1))),
        annualUnitSalesGrowthPct: -2,
        priceInflationPassThroughPct: 35,
        fxCostPassThroughPct: 35,
        annualUsdImportCostGrowthPct: 8,
        opExInflationSensitivityPct: 130,
        fxInflationSensitivityMult: 1.5,
      };
  }
}

export function runFinancialForecast(
  historical: HistoricalRow[],
  modelOutput: ForecastingModelOutput,
  params: ScenarioParams
): ScenarioResult {
  const lastHist = historical[historical.length - 1];
  const baseInflationPct = lastHist.inflationYoYPct;
  const inflationDeltaPp = params.annualInflationPct - baseInflationPct;

  // Monthly compounding rates (exact 12th root, never naive division)
  const monthlyInflationRate = Math.pow(1 + params.annualInflationPct / 100, 1 / 12) - 1;
  const monthlyUnitGrowthRate =
    Math.pow(1 + params.annualUnitSalesGrowthPct / 100, 1 / 12) - 1;
  const monthlyUsdCostGrowthRate =
    Math.pow(1 + params.annualUsdImportCostGrowthPct / 100, 1 / 12) - 1;

  const opExMonthlyGrowth =
    monthlyInflationRate * (params.opExInflationSensitivityPct / 100);

  // FX sensitivity shift per month from inflation delta
  // Positive excess inflation adds positive monthly FX drift; lower inflation relieves FX pressure.
  const monthlyFxDriftShift =
    (modelOutput.inflationSensitivity.effectiveSlopeMonthlyPctPer1pp / 100) *
    inflationDeltaPp *
    params.fxInflationSensitivityMult;

  const cogsShare = modelOutput.historicalCogsShare;
  const unitSeasonality = modelOutput.seasonalUnitIndices;
  const mktSeasonality = modelOutput.seasonalMarketingIndices;

  // De-seasonalize anchor month so h=1 connects cleanly and seasonality repeats naturally
  const lastMonthIdx = lastHist.monthNum - 1;
  const anchorUnitSeas = unitSeasonality[lastMonthIdx] || 1;
  const anchorMktSeas = mktSeasonality[lastMonthIdx] || 1;
  const deseasonalizedUnitsBase = lastHist.unitsSold / anchorUnitSeas;
  const deseasonalizedMktBase = lastHist.marketingSpendNgn / anchorMktSeas;

  let prevScenarioFx = lastHist.usdNgnRate;
  let runningPrice = lastHist.avgSellingPriceNgn;
  let runningOtherOpEx = lastHist.otherOperatingCostNgn;
  let runningMktTrend = deseasonalizedMktBase;
  let runningUsdCost = lastHist.importCostUsdPerUnit;

  // Also track what COGS would have been if FX stayed flat at Sep 2026 rate
  let fxDrivenCostImpactNgn = 0;

  const monthly: ForecastPoint[] = [];

  for (let i = 0; i < modelOutput.baselineFxForecast.length; i++) {
    const fxPt = modelOutput.baselineFxForecast[i];
    const h = fxPt.horizon;

    // 1. Scenario FX Rate: baseline model FX * cumulative inflation-sensitivity drift
    const scenarioMultiplier = Math.exp(monthlyFxDriftShift * h);
    const scenarioFx = Math.max(100, fxPt.baselineFx * scenarioMultiplier);
    const z80 = 1.2816;
    const fxLower80 = scenarioFx * Math.exp(-z80 * fxPt.sigmaLog);
    const fxUpper80 = scenarioFx * Math.exp(z80 * fxPt.sigmaLog);

    const fxMoMReturn = (scenarioFx - prevScenarioFx) / prevScenarioFx;
    const fxChangeMoMPct = fxMoMReturn * 100;

    // 2. Units Sold (monthly compounded trend * historical monthly seasonal pattern)
    const mIdx = fxPt.monthNum - 1;
    const unitsTrend =
      deseasonalizedUnitsBase * Math.pow(1 + monthlyUnitGrowthRate, h);
    const unitsSold = Math.max(100, unitsTrend * (unitSeasonality[mIdx] || 1));

    // 3. USD Import Cost per Unit (supplier inflation in USD, separate from NGN inflation)
    runningUsdCost = runningUsdCost * (1 + monthlyUsdCostGrowthRate);

    // 4. Import Cost in NGN per Unit = USD Import Cost * Forecast FX Rate
    const importCostNgnPerUnit = runningUsdCost * scenarioFx;

    // 5. COGS = Units Sold * Import Cost in NGN per Unit
    const cogsNgn = unitsSold * importCostNgnPerUnit;
    const flatFxCogsNgn = unitsSold * (runningUsdCost * lastHist.usdNgnRate);
    fxDrivenCostImpactNgn += cogsNgn - flatFxCogsNgn;

    // 6. Average Selling Price in NGN:
    // Strictly partition domestic inflation pass-through (non-COGS share) and imported cost pass-through (COGS share)
    // so prices and margins do not double-count domestic inflation on imported USD goods.
    const domesticShare = Math.max(0.15, 1 - cogsShare);
    const prevImportNgn =
      i === 0
        ? lastHist.importCostNgnPerUnit
        : monthly[i - 1].importCostNgnPerUnit;
    const importCostMoMReturn =
      (importCostNgnPerUnit - prevImportNgn) / prevImportNgn;
    const infPriceComponent =
      (params.priceInflationPassThroughPct / 100) *
      domesticShare *
      monthlyInflationRate;
    const fxPriceComponent =
      (params.fxCostPassThroughPct / 100) * cogsShare * importCostMoMReturn;
    const monthlyPriceGrowth = Math.max(-0.04, infPriceComponent + fxPriceComponent);
    runningPrice = runningPrice * (1 + monthlyPriceGrowth);

    // 7. Sales Revenue = Units Sold * Avg Selling Price
    const salesRevenueNgn = unitsSold * runningPrice;

    // 8. Gross Profit = Sales Revenue - COGS
    const grossProfitNgn = salesRevenueNgn - cogsNgn;
    const grossMarginPct =
      salesRevenueNgn > 0 ? (grossProfitNgn / salesRevenueNgn) * 100 : 0;

    // 9. Operating Expenses (purely local NGN costs driven by OpEx inflation sensitivity, NO FX double-counting)
    // Marketing scales with local OpEx inflation + 40% of unit volume growth + historical seasonal intensity
    const mktMonthlyGrowth = opExMonthlyGrowth + 0.4 * monthlyUnitGrowthRate;
    runningMktTrend = runningMktTrend * (1 + mktMonthlyGrowth);
    const marketingSpendNgn = Math.max(
      0,
      runningMktTrend * (mktSeasonality[mIdx] || 1)
    );

    runningOtherOpEx = Math.max(0, runningOtherOpEx * (1 + opExMonthlyGrowth));

    // 10. Operating Profit = Gross Profit - Marketing Spend - Other Operating Costs
    const operatingProfitNgn =
      grossProfitNgn - marketingSpendNgn - runningOtherOpEx;
    const operatingMarginPct =
      salesRevenueNgn > 0 ? (operatingProfitNgn / salesRevenueNgn) * 100 : 0;

    // 11. Propagate FX 80% uncertainty band strictly through COGS accounting identity
    const cogsAtFxHigh = unitsSold * (runningUsdCost * fxUpper80);
    const cogsAtFxLow = unitsSold * (runningUsdCost * fxLower80);
    const operatingProfitLow =
      salesRevenueNgn - cogsAtFxHigh - marketingSpendNgn - runningOtherOpEx;
    const operatingProfitHigh =
      salesRevenueNgn - cogsAtFxLow - marketingSpendNgn - runningOtherOpEx;

    monthly.push({
      horizon: h,
      dateKey: fxPt.dateKey,
      label: fxPt.label,
      year: fxPt.year,
      monthNum: fxPt.monthNum,
      quarter: fxPt.quarter,
      baselineFx: fxPt.baselineFx,
      scenarioFx,
      fxLower80,
      fxUpper80,
      fxChangeMoMPct,
      inflationYoYPct: params.annualInflationPct,
      unitsSold,
      importCostUsdPerUnit: runningUsdCost,
      importCostNgnPerUnit,
      avgSellingPriceNgn: runningPrice,
      cogsNgn,
      salesRevenueNgn,
      grossProfitNgn,
      grossMarginPct,
      marketingSpendNgn,
      otherOperatingCostNgn: runningOtherOpEx,
      operatingProfitNgn,
      operatingMarginPct,
      operatingProfitLow,
      operatingProfitHigh,
    });

    prevScenarioFx = scenarioFx;
  }

  // Build Annual Summaries (grouping forecast years cleanly, labelling partial years explicitly)
  const annualMap = new Map<number, ForecastPoint[]>();
  for (const pt of monthly) {
    const arr = annualMap.get(pt.year) ?? [];
    arr.push(pt);
    annualMap.set(pt.year, arr);
  }

  const annual: AnnualSummaryRow[] = [];
  for (const [year, pts] of Array.from(annualMap.entries()).sort(
    (a, b) => a[0] - b[0]
  )) {
    const monthsCount = pts.length;
    const isPartial = monthsCount < 12;
    let yearLabel = String(year);
    if (isPartial) {
      const firstM = pts[0].label.split(' ')[0];
      const lastM = pts[pts.length - 1].label.split(' ')[0];
      yearLabel = `${year} (${firstM}–${lastM}, ${monthsCount}m)`;
    }

    const avgFxRate =
      pts.reduce((s, p) => s + p.scenarioFx, 0) / monthsCount;
    const endFxRate = pts[pts.length - 1].scenarioFx;
    const totalUnitsSold = pts.reduce((s, p) => s + p.unitsSold, 0);
    const totalRevenueNgn = pts.reduce((s, p) => s + p.salesRevenueNgn, 0);
    const totalCogsNgn = pts.reduce((s, p) => s + p.cogsNgn, 0);
    const totalGrossProfitNgn = pts.reduce((s, p) => s + p.grossProfitNgn, 0);
    const totalOperatingProfitNgn = pts.reduce(
      (s, p) => s + p.operatingProfitNgn,
      0
    );

    annual.push({
      yearLabel,
      periodType: 'forecast',
      isPartial,
      monthsCount,
      avgFxRate,
      endFxRate,
      totalUnitsSold,
      totalRevenueNgn,
      totalCogsNgn,
      totalGrossProfitNgn,
      grossMarginPct:
        totalRevenueNgn > 0 ? (totalGrossProfitNgn / totalRevenueNgn) * 100 : 0,
      totalOperatingProfitNgn,
      operatingMarginPct:
        totalRevenueNgn > 0
          ? (totalOperatingProfitNgn / totalRevenueNgn) * 100
          : 0,
    });
  }

  const lastFc = monthly[monthly.length - 1];
  const total5YrRevenue = monthly.reduce((s, p) => s + p.salesRevenueNgn, 0);
  const total5YrCogs = monthly.reduce((s, p) => s + p.cogsNgn, 0);
  const total5YrGrossProfit = monthly.reduce(
    (s, p) => s + p.grossProfitNgn,
    0
  );
  const cumulative5YrOperatingProfit = monthly.reduce(
    (s, p) => s + p.operatingProfitNgn,
    0
  );

  return {
    params,
    monthly,
    annual,
    summary: {
      endFxRateSep2031: lastFc.scenarioFx,
      endMonthlyOperatingProfitSep2031: lastFc.operatingProfitNgn,
      endMonthlyRevenueSep2031: lastFc.salesRevenueNgn,
      total5YrRevenue,
      total5YrCogs,
      total5YrGrossProfit,
      cumulative5YrOperatingProfit,
      overall5YrOperatingMarginPct:
        total5YrRevenue > 0
          ? (cumulative5YrOperatingProfit / total5YrRevenue) * 100
          : 0,
      overall5YrGrossMarginPct:
        total5YrRevenue > 0 ? (total5YrGrossProfit / total5YrRevenue) * 100 : 0,
      fxDrivenCostImpactNgn,
    },
  };
}

export function buildHistoricalAnnualSummaries(
  historical: HistoricalRow[]
): AnnualSummaryRow[] {
  const map = new Map<number, HistoricalRow[]>();
  for (const r of historical) {
    const arr = map.get(r.year) ?? [];
    arr.push(r);
    map.set(r.year, arr);
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, pts]) => {
      const monthsCount = pts.length;
      const isPartial = monthsCount < 12;
      let yearLabel = String(year);
      if (isPartial) {
        const firstM = pts[0].label.split(' ')[0];
        const lastM = pts[pts.length - 1].label.split(' ')[0];
        yearLabel = `${year} (${firstM}–${lastM}, ${monthsCount}m)`;
      }
      const totalRevenueNgn = pts.reduce((s, p) => s + p.salesRevenueNgn, 0);
      const totalCogsNgn = pts.reduce((s, p) => s + p.cogsNgn, 0);
      const totalGrossProfitNgn = pts.reduce(
        (s, p) => s + p.grossProfitNgn,
        0
      );
      const totalOperatingProfitNgn = pts.reduce(
        (s, p) => s + p.operatingProfitNgn,
        0
      );

      return {
        yearLabel,
        periodType: 'historical' as const,
        isPartial,
        monthsCount,
        avgFxRate:
          pts.reduce((s, p) => s + p.usdNgnRate, 0) / monthsCount,
        endFxRate: pts[pts.length - 1].usdNgnRate,
        totalUnitsSold: pts.reduce((s, p) => s + p.unitsSold, 0),
        totalRevenueNgn,
        totalCogsNgn,
        totalGrossProfitNgn,
        grossMarginPct:
          totalRevenueNgn > 0
            ? (totalGrossProfitNgn / totalRevenueNgn) * 100
            : 0,
        totalOperatingProfitNgn,
        operatingMarginPct:
          totalRevenueNgn > 0
            ? (totalOperatingProfitNgn / totalRevenueNgn) * 100
            : 0,
      };
    });
}
