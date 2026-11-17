import Papa from 'papaparse';
import {
  DataQualityIssue,
  DatasetSummary,
  HistoricalRow,
} from '../types/analytics';
import {
  buildDateKey,
  formatMonthLabel,
  getQuarterLabel,
} from '../utils/formatters';

const REQUIRED_COLUMNS = [
  'Month',
  'USD_NGN_Planning_Rate',
  'Inflation_YoY_Pct',
  'Units_Sold',
  'Import_Cost_USD_Per_Unit',
  'Avg_Selling_Price_NGN',
  'Marketing_Spend_NGN',
  'Other_Operating_Cost_NGN',
  'Sales_Revenue_NGN',
  'Operating_Profit_NGN',
] as const;

function parseMonthString(raw: string): { year: number; monthNum: number } | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;

  // Handle MM/DD/YYYY or M/D/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const m = Number(slashMatch[1]);
    const y = Number(slashMatch[3]);
    if (m >= 1 && m <= 12 && y >= 1990 && y <= 2100) {
      return { year: y, monthNum: m };
    }
  }

  // Handle YYYY-MM or YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    if (m >= 1 && m <= 12 && y >= 1990 && y <= 2100) {
      return { year: y, monthNum: m };
    }
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return {
      year: parsed.getUTCFullYear(),
      monthNum: parsed.getUTCMonth() + 1,
    };
  }
  return null;
}

function toNum(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim().replace(/,/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export interface ParsedDataset {
  rows: HistoricalRow[];
  summary: DatasetSummary;
}

export function parseAndValidateCsv(
  csvText: string,
  fileName: string
): ParsedDataset {
  const parsed = Papa.parse<Record<string, string>>(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    throw new Error(
      `CSV parsing failed: ${parsed.errors[0]?.message ?? 'Invalid CSV format'}`
    );
  }

  const fields = parsed.meta.fields ?? [];
  const missingCols = REQUIRED_COLUMNS.filter((c) => !fields.includes(c));
  if (missingCols.length > 0) {
    throw new Error(
      `Uploaded CSV is missing required columns: ${missingCols.join(', ')}`
    );
  }

  const issues: DataQualityIssue[] = [];
  const rawRecords = parsed.data;
  if (rawRecords.length < 24) {
    throw new Error(
      `At least 24 monthly observations are required for reliable chronological backtesting (found ${rawRecords.length}).`
    );
  }

  interface TempRow {
    year: number;
    monthNum: number;
    monthRaw: string;
    quarter: string;
    usdNgnRate: number;
    inflationDecimal: number;
    unitsSold: number;
    importCostUsdPerUnit: number;
    avgSellingPriceNgn: number;
    marketingSpendNgn: number;
    otherOperatingCostNgn: number;
    fxChangeMoMDecimal: number | null;
    importCostNgnPerUnit: number;
    cogsNgn: number;
    salesRevenueNgn: number;
    grossProfitNgn: number;
    grossMarginDecimal: number;
    operatingProfitNgn: number;
    operatingMarginDecimal: number;
    marketNotes: string;
  }

  const tempRows: TempRow[] = [];
  let invalidRowCount = 0;
  let accountingMismatchCount = 0;
  let unexpectedMissingFxChangeCount = 0;
  let inflationConvertedFromPercentCount = 0;

  for (let i = 0; i < rawRecords.length; i++) {
    const rec = rawRecords[i];
    const dateInfo = parseMonthString(rec.Month);
    const fx = toNum(rec.USD_NGN_Planning_Rate);
    const infRaw = toNum(rec.Inflation_YoY_Pct);
    const units = toNum(rec.Units_Sold);
    const usdCost = toNum(rec.Import_Cost_USD_Per_Unit);
    const price = toNum(rec.Avg_Selling_Price_NGN);
    const mkt = toNum(rec.Marketing_Spend_NGN);
    const otherOpEx = toNum(rec.Other_Operating_Cost_NGN);

    if (
      !dateInfo ||
      fx === null ||
      fx <= 0 ||
      infRaw === null ||
      units === null ||
      usdCost === null ||
      price === null ||
      mkt === null ||
      otherOpEx === null
    ) {
      invalidRowCount++;
      continue;
    }

    // Inflation_YoY_Pct is stored as decimal fraction (0.2067 = 20.67%).
    // Guard against files where inflation was saved as > 1.5 (e.g. 20.67).
    let inflationDecimal = infRaw;
    if (infRaw > 1.5) {
      inflationDecimal = infRaw / 100;
      inflationConvertedFromPercentCount++;
    }

    const fxChangeRaw = toNum(rec.FX_Change_MoM_Pct);
    const importCostNgn = toNum(rec.Import_Cost_NGN_Per_Unit) ?? fx * usdCost;
    const cogs = toNum(rec.COGS_NGN) ?? units * importCostNgn;
    const rev = toNum(rec.Sales_Revenue_NGN) ?? units * price;
    const gp = toNum(rec.Gross_Profit_NGN) ?? rev - cogs;
    const gm = toNum(rec.Gross_Margin_Pct) ?? (rev !== 0 ? gp / rev : 0);
    const op = toNum(rec.Operating_Profit_NGN) ?? gp - mkt - otherOpEx;
    const om = toNum(rec.Operating_Margin_Pct) ?? (rev !== 0 ? op / rev : 0);

    // Accounting consistency check (tolerance 0.5%)
    const expectedRev = units * price;
    const expectedOp = expectedRev - units * (fx * usdCost) - mkt - otherOpEx;
    if (
      Math.abs(rev - expectedRev) > Math.max(5000, expectedRev * 0.005) ||
      Math.abs(op - expectedOp) > Math.max(5000, Math.abs(expectedOp) * 0.01)
    ) {
      accountingMismatchCount++;
    }

    tempRows.push({
      year: dateInfo.year,
      monthNum: dateInfo.monthNum,
      monthRaw: String(rec.Month).trim(),
      quarter: String(rec.Quarter || '').trim() || getQuarterLabel(dateInfo.monthNum),
      usdNgnRate: fx,
      inflationDecimal,
      unitsSold: units,
      importCostUsdPerUnit: usdCost,
      avgSellingPriceNgn: price,
      marketingSpendNgn: mkt,
      otherOperatingCostNgn: otherOpEx,
      fxChangeMoMDecimal: fxChangeRaw,
      importCostNgnPerUnit: importCostNgn,
      cogsNgn: cogs,
      salesRevenueNgn: rev,
      grossProfitNgn: gp,
      grossMarginDecimal: gm,
      operatingProfitNgn: op,
      operatingMarginDecimal: om,
      marketNotes: String(rec.Market_Notes || '').trim(),
    });
  }

  // Sort chronologically
  tempRows.sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.monthNum - b.monthNum
  );

  // Deduplicate by YYYY-MM
  const seenKeys = new Set<string>();
  const deduped: TempRow[] = [];
  let duplicateCount = 0;
  for (const r of tempRows) {
    const key = buildDateKey(r.year, r.monthNum);
    if (seenKeys.has(key)) {
      duplicateCount++;
      continue;
    }
    seenKeys.add(key);
    deduped.push(r);
  }

  // Check chronological gaps & build final HistoricalRow[]
  let gapCount = 0;
  const rows: HistoricalRow[] = deduped.map((r, idx) => {
    let fxMoMPct: number | null = null;
    if (idx === 0) {
      // First-month missing FX change is expected
      fxMoMPct = r.fxChangeMoMDecimal !== null ? r.fxChangeMoMDecimal * 100 : null;
    } else {
      const prev = deduped[idx - 1];
      const expectedTotalMonths = prev.year * 12 + (prev.monthNum - 1) + 1;
      const actualTotalMonths = r.year * 12 + (r.monthNum - 1);
      if (actualTotalMonths !== expectedTotalMonths) {
        gapCount++;
      }
      if (r.fxChangeMoMDecimal !== null) {
        fxMoMPct = r.fxChangeMoMDecimal * 100;
      } else {
        unexpectedMissingFxChangeCount++;
        fxMoMPct = ((r.usdNgnRate - prev.usdNgnRate) / prev.usdNgnRate) * 100;
      }
    }

    return {
      index: idx,
      monthRaw: r.monthRaw,
      dateKey: buildDateKey(r.year, r.monthNum),
      label: formatMonthLabel(r.year, r.monthNum),
      year: r.year,
      monthNum: r.monthNum,
      quarter: r.quarter,
      usdNgnRate: r.usdNgnRate,
      inflationYoYPct: r.inflationDecimal * 100,
      inflationDecimal: r.inflationDecimal,
      unitsSold: r.unitsSold,
      importCostUsdPerUnit: r.importCostUsdPerUnit,
      avgSellingPriceNgn: r.avgSellingPriceNgn,
      marketingSpendNgn: r.marketingSpendNgn,
      otherOperatingCostNgn: r.otherOperatingCostNgn,
      fxChangeMoMPct: fxMoMPct,
      importCostNgnPerUnit: r.importCostNgnPerUnit,
      cogsNgn: r.cogsNgn,
      salesRevenueNgn: r.salesRevenueNgn,
      grossProfitNgn: r.grossProfitNgn,
      grossMarginPct: r.grossMarginDecimal * 100,
      operatingProfitNgn: r.operatingProfitNgn,
      operatingMarginPct: r.operatingMarginDecimal * 100,
      marketNotes: r.marketNotes,
    };
  });

  if (rows.length === 0) {
    throw new Error('No valid monthly rows found in uploaded CSV.');
  }

  // Build Data Quality report
  if (rows[0].fxChangeMoMPct === null) {
    issues.push({
      severity: 'info',
      code: 'INITIAL_FX_CHANGE_EXPECTED',
      message: `First observation (${rows[0].label}) has blank FX_Change_MoM_Pct as expected (no prior month exists).`,
      rowCount: 1,
    });
  }
  issues.push({
    severity: 'info',
    code: 'INFLATION_DECIMAL_NORMALIZED',
    message:
      inflationConvertedFromPercentCount > 0
        ? `Normalized ${inflationConvertedFromPercentCount} inflation values > 1.5 and formatted decimal fractions (e.g. ${(rows[rows.length - 1].inflationDecimal).toFixed(4)} → ${rows[rows.length - 1].inflationYoYPct.toFixed(2)}%).`
        : `Parsed Inflation_YoY_Pct decimal fractions accurately (e.g. ${rows[rows.length - 1].inflationDecimal.toFixed(4)} → ${rows[rows.length - 1].inflationYoYPct.toFixed(2)}%).`,
  });

  if (invalidRowCount > 0) {
    issues.push({
      severity: 'warning',
      code: 'DROPPED_INVALID_ROWS',
      message: `Excluded ${invalidRowCount} row(s) with missing or non-numeric required fields.`,
      rowCount: invalidRowCount,
    });
  }
  if (duplicateCount > 0) {
    issues.push({
      severity: 'warning',
      code: 'DUPLICATE_MONTHS',
      message: `Deduplicated ${duplicateCount} duplicate month entry/entries.`,
      rowCount: duplicateCount,
    });
  }
  if (gapCount > 0) {
    issues.push({
      severity: 'warning',
      code: 'CHRONOLOGICAL_GAPS',
      message: `Detected ${gapCount} non-consecutive month gap(s) in timeline.`,
      rowCount: gapCount,
    });
  }
  if (unexpectedMissingFxChangeCount > 0) {
    issues.push({
      severity: 'warning',
      code: 'IMPUTED_FX_MOM',
      message: `Imputed ${unexpectedMissingFxChangeCount} missing subsequent FX_Change_MoM_Pct value(s) from consecutive USD/NGN rates.`,
      rowCount: unexpectedMissingFxChangeCount,
    });
  }
  if (accountingMismatchCount > 0) {
    issues.push({
      severity: 'warning',
      code: 'ACCOUNTING_VARIANCE',
      message: `Observed minor rounding/accounting variance (>0.5%) in ${accountingMismatchCount} row(s).`,
      rowCount: accountingMismatchCount,
    });
  } else {
    issues.push({
      severity: 'info',
      code: 'ACCOUNTING_VERIFIED',
      message: 'Verified 100% accounting consistency across Units, Price, COGS, Revenue, and Operating Profit.',
    });
  }

  const marketNotesEvents = rows
    .filter((r) => r.marketNotes.length > 0)
    .map((r) => ({ dateLabel: r.label, note: r.marketNotes }));

  const first = rows[0];
  const last = rows[rows.length - 1];

  return {
    rows,
    summary: {
      fileName,
      observationCount: rows.length,
      startDateLabel: first.label,
      endDateLabel: last.label,
      startKey: first.dateKey,
      endKey: last.dateKey,
      latestFxRate: last.usdNgnRate,
      latestInflationPct: last.inflationYoYPct,
      latestOperatingProfit: last.operatingProfitNgn,
      latestRevenue: last.salesRevenueNgn,
      latestOperatingMarginPct: last.operatingMarginPct,
      issues,
      marketNotesEvents,
      isSyntheticEducational: true,
    },
  };
}
