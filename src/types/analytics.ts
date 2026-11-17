export interface HistoricalRow {
  index: number;
  monthRaw: string;
  dateKey: string; // YYYY-MM
  label: string; // e.g. "Oct 2016"
  year: number;
  monthNum: number; // 1..12
  quarter: string;
  usdNgnRate: number;
  inflationYoYPct: number; // stored as percentage e.g. 20.67 (converted from decimal 0.2067)
  inflationDecimal: number; // e.g. 0.2067
  unitsSold: number;
  importCostUsdPerUnit: number;
  avgSellingPriceNgn: number;
  marketingSpendNgn: number;
  otherOperatingCostNgn: number;
  fxChangeMoMPct: number | null; // percentage e.g. 1.9555, null for month 0
  importCostNgnPerUnit: number;
  cogsNgn: number;
  salesRevenueNgn: number;
  grossProfitNgn: number;
  grossMarginPct: number; // percentage e.g. 37.83
  operatingProfitNgn: number;
  operatingMarginPct: number; // percentage e.g. 27.45
  marketNotes: string;
}

export interface DataQualityIssue {
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  rowCount?: number;
}

export interface DatasetSummary {
  fileName: string;
  observationCount: number;
  startDateLabel: string;
  endDateLabel: string;
  startKey: string;
  endKey: string;
  latestFxRate: number;
  latestInflationPct: number;
  latestOperatingProfit: number;
  latestRevenue: number;
  latestOperatingMarginPct: number;
  issues: DataQualityIssue[];
  marketNotesEvents: Array<{ dateLabel: string; note: string }>;
  isSyntheticEducational: boolean;
}

export interface ModelMetrics {
  modelId: 'naive' | 'damped_ets' | 'arx_inflation' | 'seasonal_arx';
  modelName: string;
  shortName: string;
  description: string;
  mae1Step: number;
  rmse1Step: number;
  mape1Step: number;
  mae6Step: number;
  rmse6Step: number;
  mape6Step: number;
  mae12Step: number;
  rmse12Step: number;
  mape12Step: number;
  isSelectedBaseline: boolean;
}

export interface InflationSensitivityStats {
  estimatedSlopeMonthlyPctPer1pp: number; // monthly FX % impact per +1pp annual inflation
  effectiveSlopeMonthlyPctPer1pp: number; // stabilized/disclosed sensitivity used by simulator
  rSquared: number;
  isUnstable: boolean;
  explanation: string;
}

export interface FxBaselinePoint {
  horizon: number; // 1..60
  dateKey: string;
  label: string;
  year: number;
  monthNum: number;
  quarter: string;
  baselineFx: number;
  lower80Fx: number;
  upper80Fx: number;
  lower95Fx: number;
  upper95Fx: number;
  sigmaLog: number; // cumulative log-space residual std
}

export interface ForecastingModelOutput {
  selectedModelId: ModelMetrics['modelId'];
  selectedModelName: string;
  modelComparison: ModelMetrics[];
  backtestWindowCount: number;
  backtestStartLabel: string;
  backtestEndLabel: string;
  inflationSensitivity: InflationSensitivityStats;
  baselineFxForecast: FxBaselinePoint[];
  seasonalUnitIndices: number[]; // length 12 (Jan..Dec)
  seasonalMarketingIndices: number[]; // length 12 (Jan..Dec)
  historicalCogsShare: number;
  historicalTrendAnnualUnitsPct: number;
  learnedParamsSummary: string[];
}

export type ScenarioPresetId = 'base' | 'optimistic' | 'stress' | 'custom';

export interface ScenarioParams {
  presetId: ScenarioPresetId;
  annualInflationPct: number; // 0..50
  annualUnitSalesGrowthPct: number; // -20..40
  priceInflationPassThroughPct: number; // 0..100
  fxCostPassThroughPct: number; // 0..100
  annualUsdImportCostGrowthPct: number; // -10..25
  opExInflationSensitivityPct: number; // 0..200
  fxInflationSensitivityMult: number; // 0.0..2.5 (default 1.0)
}

export interface ForecastPoint {
  horizon: number;
  dateKey: string;
  label: string;
  year: number;
  monthNum: number;
  quarter: string;
  baselineFx: number;
  scenarioFx: number;
  fxLower80: number;
  fxUpper80: number;
  fxChangeMoMPct: number;
  inflationYoYPct: number;
  unitsSold: number;
  importCostUsdPerUnit: number;
  importCostNgnPerUnit: number;
  avgSellingPriceNgn: number;
  cogsNgn: number;
  salesRevenueNgn: number;
  grossProfitNgn: number;
  grossMarginPct: number;
  marketingSpendNgn: number;
  otherOperatingCostNgn: number;
  operatingProfitNgn: number;
  operatingMarginPct: number;
  // Uncertainty bounds derived from FX 80% interval propagated strictly through accounting identities
  operatingProfitLow: number;
  operatingProfitHigh: number;
}

export interface AnnualSummaryRow {
  yearLabel: string; // e.g. "2026 (Q4)" or "2027"
  periodType: 'historical' | 'forecast' | 'mixed';
  isPartial: boolean;
  monthsCount: number;
  avgFxRate: number;
  endFxRate: number;
  totalUnitsSold: number;
  totalRevenueNgn: number;
  totalCogsNgn: number;
  totalGrossProfitNgn: number;
  grossMarginPct: number;
  totalOperatingProfitNgn: number;
  operatingMarginPct: number;
}

export interface ScenarioResult {
  params: ScenarioParams;
  monthly: ForecastPoint[];
  annual: AnnualSummaryRow[];
  summary: {
    endFxRateSep2031: number;
    endMonthlyOperatingProfitSep2031: number;
    endMonthlyRevenueSep2031: number;
    total5YrRevenue: number;
    total5YrCogs: number;
    total5YrGrossProfit: number;
    cumulative5YrOperatingProfit: number;
    overall5YrOperatingMarginPct: number;
    overall5YrGrossMarginPct: number;
    fxDrivenCostImpactNgn: number;
  };
}

export interface RiskEvent {
  dateKey: string;
  label: string;
  period: 'historical' | 'forecast';
  fxMoMPct: number;
  operatingProfitNgn: number;
  operatingMarginPct: number;
  importCostMoMPct: number;
  flags: Array<'fx_shock' | 'negative_profit' | 'low_margin' | 'import_surge'>;
  severity: 'elevated' | 'critical';
}

export interface RiskIntelligenceReport {
  classificationFeasible: boolean;
  feasibilityReason: string;
  historicalCounts: {
    totalMonths: number;
    fxShockMonths: number; // > 5% MoM
    negativeProfitMonths: number; // < 0
    lowMarginMonths: number; // < 20%
    importSurgeMonths: number; // > 4% MoM
  };
  projectedCounts: {
    totalMonths: number;
    fxShockMonths: number;
    negativeProfitMonths: number;
    lowMarginMonths: number;
    importSurgeMonths: number;
  };
  worstProjectedMonth: {
    label: string;
    operatingProfitNgn: number;
    operatingMarginPct: number;
  } | null;
  peakRiskPeriodSummary: string;
  events: RiskEvent[];
}

export interface BusinessInsight {
  id: string;
  title: string;
  category: 'inflation' | 'pricing' | 'scenario' | 'margin';
  headlineValue: string;
  summary: string;
  detail: string;
}
