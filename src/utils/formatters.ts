import { ForecastPoint } from '../types/analytics';

export function formatNgnCompact(value: number, includeSign = false): string {
  if (!Number.isFinite(value)) return '₦0';
  const sign = value < 0 ? '-' : includeSign && value > 0 ? '+' : '';
  const abs = Math.abs(value);

  if (abs >= 1_000_000_000) {
    return `${sign}₦${(abs / 1_000_000_000).toFixed(2)}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}₦${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}₦${(abs / 1_000).toFixed(1)}K`;
  }
  return `${sign}₦${abs.toFixed(0)}`;
}

export function formatNgnFull(value: number): string {
  if (!Number.isFinite(value)) return '₦0';
  const sign = value < 0 ? '-' : '';
  return `${sign}₦${Math.round(Math.abs(value)).toLocaleString('en-NG')}`;
}

export function formatFxRate(rate: number): string {
  if (!Number.isFinite(rate)) return '₦0.00';
  return `₦${rate.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatUsd(amount: number): string {
  if (!Number.isFinite(amount)) return '$0.00';
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPct(pctValue: number, decimals = 2, includeSign = false): string {
  if (!Number.isFinite(pctValue)) return '0.00%';
  const sign = includeSign && pctValue > 0 ? '+' : '';
  return `${sign}${pctValue.toFixed(decimals)}%`;
}

export function formatUnits(units: number): string {
  if (!Number.isFinite(units)) return '0';
  return Math.round(units).toLocaleString('en-US');
}

const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function formatMonthLabel(year: number, monthNum: number): string {
  return `${MONTH_ABBR[monthNum - 1] ?? 'Jan'} ${year}`;
}

export function buildDateKey(year: number, monthNum: number): string {
  return `${year}-${String(monthNum).padStart(2, '0')}`;
}

export function getQuarterLabel(monthNum: number): string {
  return `Q${Math.ceil(monthNum / 3)}`;
}

export function exportForecastCsv(
  forecast: ForecastPoint[],
  scenarioLabel: string
): void {
  const headers = [
    'Month',
    'Quarter',
    'Horizon_Month',
    'Baseline_USD_NGN_Rate',
    'Scenario_USD_NGN_Rate',
    'FX_Lower_80_Pct',
    'FX_Upper_80_Pct',
    'FX_Change_MoM_Pct',
    'Assumed_Inflation_YoY_Pct',
    'Forecast_Units_Sold',
    'Import_Cost_USD_Per_Unit',
    'Import_Cost_NGN_Per_Unit',
    'Avg_Selling_Price_NGN',
    'Sales_Revenue_NGN',
    'COGS_NGN',
    'Gross_Profit_NGN',
    'Gross_Margin_Pct',
    'Marketing_Spend_NGN',
    'Other_Operating_Cost_NGN',
    'Operating_Profit_NGN',
    'Operating_Profit_Low_80_NGN',
    'Operating_Profit_High_80_NGN',
    'Operating_Margin_Pct',
  ];

  const rows = forecast.map((p) => [
    p.dateKey,
    p.quarter,
    p.horizon,
    p.baselineFx.toFixed(2),
    p.scenarioFx.toFixed(2),
    p.fxLower80.toFixed(2),
    p.fxUpper80.toFixed(2),
    p.fxChangeMoMPct.toFixed(4),
    p.inflationYoYPct.toFixed(2),
    Math.round(p.unitsSold),
    p.importCostUsdPerUnit.toFixed(2),
    p.importCostNgnPerUnit.toFixed(2),
    Math.round(p.avgSellingPriceNgn),
    Math.round(p.salesRevenueNgn),
    Math.round(p.cogsNgn),
    Math.round(p.grossProfitNgn),
    p.grossMarginPct.toFixed(2),
    Math.round(p.marketingSpendNgn),
    Math.round(p.otherOperatingCostNgn),
    Math.round(p.operatingProfitNgn),
    Math.round(p.operatingProfitLow),
    Math.round(p.operatingProfitHigh),
    p.operatingMarginPct.toFixed(2),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((r) => r.join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = scenarioLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  link.href = url;
  link.download = `meridian_forecast_${safeName}_2026_2031.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
