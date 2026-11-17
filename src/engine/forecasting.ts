import {
  ForecastingModelOutput,
  FxBaselinePoint,
  HistoricalRow,
  InflationSensitivityStats,
  ModelMetrics,
} from '../types/analytics';
import {
  buildDateKey,
  formatMonthLabel,
  getQuarterLabel,
} from '../utils/formatters';

function solveRidgeOLS(
  X: number[][],
  y: number[],
  lambda = 1e-3
): number[] {
  const n = X.length;
  const p = X[0]?.length ?? 0;
  if (n === 0 || p === 0) return new Array(p).fill(0);

  // Compute X^T X + lambda * I (do not penalize intercept column 0)
  const A: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  const b: number[] = new Array(p).fill(0);

  for (let i = 0; i < n; i++) {
    const row = X[i];
    const yi = y[i];
    for (let j = 0; j < p; j++) {
      b[j] += row[j] * yi;
      for (let k = 0; k < p; k++) {
        A[j][k] += row[j] * row[k];
      }
    }
  }

  for (let j = 1; j < p; j++) {
    A[j][j] += lambda;
  }
  A[0][0] += 1e-8;

  // Gaussian elimination with partial pivoting
  const aug = A.map((row, idx) => [...row, b[idx]]);
  for (let col = 0; col < p; col++) {
    let pivotRow = col;
    let maxVal = Math.abs(aug[col][col]);
    for (let r = col + 1; r < p; r++) {
      if (Math.abs(aug[r][col]) > maxVal) {
        maxVal = Math.abs(aug[r][col]);
        pivotRow = r;
      }
    }
    if (pivotRow !== col) {
      const tmp = aug[col];
      aug[col] = aug[pivotRow];
      aug[pivotRow] = tmp;
    }

    const pivot = Math.abs(aug[col][col]) < 1e-12 ? 1e-12 : aug[col][col];
    for (let j = col; j <= p; j++) {
      aug[col][j] /= pivot;
    }
    for (let r = 0; r < p; r++) {
      if (r !== col) {
        const factor = aug[r][col];
        for (let j = col; j <= p; j++) {
          aug[r][j] -= factor * aug[col][j];
        }
      }
    }
  }

  return aug.map((row) => row[p]);
}

interface DampedHoltParams {
  alpha: number;
  beta: number;
  phi: number;
}

function runDampedHoltLog(
  logSeries: number[],
  params: DampedHoltParams
): {
  level: number;
  trend: number;
  fitted: number[];
  sse: number;
} {
  const { alpha, beta, phi } = params;
  const n = logSeries.length;
  let level = logSeries[0];
  let trend = n > 1 ? logSeries[1] - logSeries[0] : 0;
  const fitted: number[] = [level];
  let sse = 0;

  for (let t = 1; t < n; t++) {
    const forecast = level + phi * trend;
    fitted.push(forecast);
    const err = logSeries[t] - forecast;
    sse += err * err;

    const prevLevel = level;
    level = alpha * logSeries[t] + (1 - alpha) * (level + phi * trend);
    trend = beta * (level - prevLevel) + (1 - beta) * phi * trend;
  }

  return { level, trend, fitted, sse };
}

function fitBestDampedHolt(logSeries: number[]): {
  params: DampedHoltParams;
  level: number;
  trend: number;
} {
  // Use recent emphasis grid search over alpha, beta, phi
  const alphas = [0.35, 0.55, 0.75, 0.9];
  const betas = [0.05, 0.15, 0.3];
  const phis = [0.82, 0.88, 0.93];

  let bestParams: DampedHoltParams = { alpha: 0.75, beta: 0.15, phi: 0.88 };
  let bestSse = Number.POSITIVE_INFINITY;
  let bestLevel = logSeries[logSeries.length - 1];
  let bestTrend = 0;

  for (const alpha of alphas) {
    for (const beta of betas) {
      for (const phi of phis) {
        const res = runDampedHoltLog(logSeries, { alpha, beta, phi });
        if (res.sse < bestSse) {
          bestSse = res.sse;
          bestParams = { alpha, beta, phi };
          bestLevel = res.level;
          bestTrend = res.trend;
        }
      }
    }
  }

  return { params: bestParams, level: bestLevel, trend: bestTrend };
}

function predictDampedHolt(
  level: number,
  trend: number,
  phi: number,
  horizon: number
): number {
  let dampedSum = 0;
  let phiPow = phi;
  for (let h = 1; h <= horizon; h++) {
    dampedSum += phiPow;
    phiPow *= phi;
  }
  return Math.exp(level + dampedSum * trend);
}

function fitArxInflation(rows: HistoricalRow[]): number[] {
  const X: number[][] = [];
  const y: number[] = [];

  for (let t = 2; t < rows.length; t++) {
    const retT = Math.log(rows[t].usdNgnRate / rows[t - 1].usdNgnRate);
    const retPrev = Math.log(rows[t - 1].usdNgnRate / rows[t - 2].usdNgnRate);
    const infPrev = rows[t - 1].inflationDecimal;
    const dInfPrev = rows[t - 1].inflationDecimal - rows[t - 2].inflationDecimal;
    X.push([1, retPrev, infPrev, dInfPrev]);
    y.push(retT);
  }

  return solveRidgeOLS(X, y, 0.05);
}

function predictArxInflation(
  rows: HistoricalRow[],
  coeffs: number[],
  horizon: number
): number {
  const n = rows.length;
  let logFx = Math.log(rows[n - 1].usdNgnRate);
  let prevRet = Math.log(rows[n - 1].usdNgnRate / rows[n - 2].usdNgnRate);
  const infLatest = rows[n - 1].inflationDecimal;
  let dInf = rows[n - 1].inflationDecimal - rows[n - 2].inflationDecimal;

  for (let h = 1; h <= horizon; h++) {
    const predRetRaw =
      coeffs[0] +
      coeffs[1] * prevRet +
      coeffs[2] * infLatest +
      coeffs[3] * dInf;
    // Clamp extreme single-month log-return extrapolation for numerical stability
    const predRet = Math.max(-0.08, Math.min(0.12, predRetRaw));
    logFx += predRet;
    prevRet = predRet;
    dInf *= 0.7;
  }
  return Math.exp(logFx);
}

function fitSeasonalArx(rows: HistoricalRow[]): number[] {
  const X: number[][] = [];
  const y: number[] = [];

  for (let t = 3; t < rows.length; t++) {
    const retT = Math.log(rows[t].usdNgnRate / rows[t - 1].usdNgnRate);
    const ret1 = Math.log(rows[t - 1].usdNgnRate / rows[t - 2].usdNgnRate);
    const ret2 = Math.log(rows[t - 2].usdNgnRate / rows[t - 3].usdNgnRate);
    const infPrev = rows[t - 1].inflationDecimal;
    const angle = (2 * Math.PI * rows[t].monthNum) / 12;
    X.push([1, ret1, ret2, infPrev, Math.sin(angle), Math.cos(angle)]);
    y.push(retT);
  }

  return solveRidgeOLS(X, y, 0.08);
}

function predictSeasonalArx(
  rows: HistoricalRow[],
  coeffs: number[],
  horizon: number
): number {
  const n = rows.length;
  let logFx = Math.log(rows[n - 1].usdNgnRate);
  let ret1 = Math.log(rows[n - 1].usdNgnRate / rows[n - 2].usdNgnRate);
  let ret2 = Math.log(rows[n - 2].usdNgnRate / rows[n - 3].usdNgnRate);
  const infLatest = rows[n - 1].inflationDecimal;
  let monthNum = rows[n - 1].monthNum;

  for (let h = 1; h <= horizon; h++) {
    monthNum = (monthNum % 12) + 1;
    const angle = (2 * Math.PI * monthNum) / 12;
    const predRetRaw =
      coeffs[0] +
      coeffs[1] * ret1 +
      coeffs[2] * ret2 +
      coeffs[3] * infLatest +
      coeffs[4] * Math.sin(angle) +
      coeffs[5] * Math.cos(angle);
    const predRet = Math.max(-0.08, Math.min(0.12, predRetRaw));
    logFx += predRet;
    ret2 = ret1;
    ret1 = predRet;
  }
  return Math.exp(logFx);
}

interface ErrorBucket {
  absErr: number[];
  sqErr: number[];
  ape: number[];
  logErr: number[];
}

function makeBucket(): ErrorBucket {
  return { absErr: [], sqErr: [], ape: [], logErr: [] };
}

function summarizeBucket(b: ErrorBucket): {
  mae: number;
  rmse: number;
  mape: number;
} {
  const n = b.absErr.length;
  if (n === 0) return { mae: 0, rmse: 0, mape: 0 };
  const mae = b.absErr.reduce((a, c) => a + c, 0) / n;
  const rmse = Math.sqrt(b.sqErr.reduce((a, c) => a + c, 0) / n);
  const mape = (b.ape.reduce((a, c) => a + c, 0) / n) * 100;
  return { mae, rmse, mape };
}

function estimateInflationSensitivity(
  rows: HistoricalRow[]
): InflationSensitivityStats {
  // OLS of monthly FX log-return (%) on YoY inflation (%)
  const xs: number[] = [];
  const ys: number[] = [];
  for (let t = 1; t < rows.length; t++) {
    const infPct = rows[t - 1].inflationYoYPct;
    const retPct = Math.log(rows[t].usdNgnRate / rows[t - 1].usdNgnRate) * 100;
    xs.push(infPct);
    ys.push(retPct);
  }

  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    den += dx * dx;
    ssTot += dy * dy;
  }

  const slope = den > 1e-9 ? num / den : 0;
  const intercept = meanY - slope * meanX;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const pred = intercept + slope * xs[i];
    const err = ys[i] - pred;
    ssRes += err * err;
  }
  const rSquared = ssTot > 1e-9 ? Math.max(0, 1 - ssRes / ssTot) : 0;

  // Check stability: single-variable inflation OLS in monthly FX returns is noisy when regime jumps exist
  const isUnstable = rSquared < 0.15 || slope <= 0 || slope > 0.25;
  // Stabilized scenario slope: bounded to economically coherent monthly pass-through per +1pp excess annual inflation
  // e.g., ~0.06% per month per +1pp annual inflation (~0.72% annualized FX shift per 1pp excess inflation)
  const effectiveSlope = isUnstable
    ? Math.max(0.05, Math.min(0.08, slope > 0 ? slope : 0.06))
    : slope;

  const explanation = isUnstable
    ? `Historical OLS indicates a positive slope (+${slope.toFixed(3)}% monthly FX per +1pp inflation) with R² = ${(rSquared * 100).toFixed(1)}%, reflecting discrete FX regime shifts rather than inflation alone. Accordingly, the simulator applies a disclosed, stabilized scenario sensitivity of +${effectiveSlope.toFixed(3)}% monthly FX drift per +1pp excess annual inflation (scalable via Slider G).`
    : `Historical OLS yields +${slope.toFixed(3)}% monthly FX change per +1pp annual inflation (R² = ${(rSquared * 100).toFixed(1)}%). Retained as an adjustable scenario sensitivity control, not a deterministic causal law.`;

  return {
    estimatedSlopeMonthlyPctPer1pp: slope,
    effectiveSlopeMonthlyPctPer1pp: effectiveSlope,
    rSquared,
    isUnstable,
    explanation,
  };
}

function extractSeasonalIndices(
  rows: HistoricalRow[],
  getter: (r: HistoricalRow) => number
): number[] {
  // Centered 12-month moving average ratio method
  const n = rows.length;
  const vals = rows.map(getter);
  const ratiosByMonth: number[][] = Array.from({ length: 12 }, () => []);

  for (let t = 6; t < n - 6; t++) {
    // 2x12 centered MA
    let sum = 0.5 * vals[t - 6] + 0.5 * vals[t + 6];
    for (let k = -5; k <= 5; k++) {
      sum += vals[t + k];
    }
    const ma = sum / 12;
    if (ma > 0) {
      const mIdx = rows[t].monthNum - 1;
      ratiosByMonth[mIdx].push(vals[t] / ma);
    }
  }

  const rawIndices = ratiosByMonth.map((arr) => {
    if (arr.length === 0) return 1;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  });

  const meanIdx = rawIndices.reduce((a, b) => a + b, 0) / 12;
  return rawIndices.map((v) => (meanIdx > 0 ? v / meanIdx : 1));
}

export function trainAndEvaluateForecastingEngine(
  rows: HistoricalRow[]
): ForecastingModelOutput {
  const n = rows.length;
  const minTrain = Math.min(48, Math.max(24, Math.floor(n * 0.4)));

  const modelIds: ModelMetrics['modelId'][] = [
    'naive',
    'damped_ets',
    'arx_inflation',
    'seasonal_arx',
  ];

  const buckets: Record<
    ModelMetrics['modelId'],
    { h1: ErrorBucket; h6: ErrorBucket; h12: ErrorBucket }
  > = {
    naive: { h1: makeBucket(), h6: makeBucket(), h12: makeBucket() },
    damped_ets: { h1: makeBucket(), h6: makeBucket(), h12: makeBucket() },
    arx_inflation: { h1: makeBucket(), h6: makeBucket(), h12: makeBucket() },
    seasonal_arx: { h1: makeBucket(), h6: makeBucket(), h12: makeBucket() },
  };

  // Chronological expanding-window backtest
  for (let origin = minTrain; origin < n - 1; origin++) {
    const trainSlice = rows.slice(0, origin + 1);
    const logSlice = trainSlice.map((r) => Math.log(r.usdNgnRate));

    const holt = fitBestDampedHolt(logSlice);
    const arxCoeffs = fitArxInflation(trainSlice);
    const seasCoeffs = fitSeasonalArx(trainSlice);
    const lastActual = trainSlice[trainSlice.length - 1].usdNgnRate;

    const horizons = [1, 6, 12] as const;
    for (const h of horizons) {
      const targetIdx = origin + h;
      if (targetIdx >= n) continue;
      const actual = rows[targetIdx].usdNgnRate;

      const preds: Record<ModelMetrics['modelId'], number> = {
        naive: lastActual,
        damped_ets: predictDampedHolt(
          holt.level,
          holt.trend,
          holt.params.phi,
          h
        ),
        arx_inflation: predictArxInflation(trainSlice, arxCoeffs, h),
        seasonal_arx: predictSeasonalArx(trainSlice, seasCoeffs, h),
      };

      const hKey = h === 1 ? 'h1' : h === 6 ? 'h6' : 'h12';
      for (const mId of modelIds) {
        const pred = preds[mId];
        const err = actual - pred;
        const logErr = Math.log(actual) - Math.log(Math.max(1e-6, pred));
        buckets[mId][hKey].absErr.push(Math.abs(err));
        buckets[mId][hKey].sqErr.push(err * err);
        buckets[mId][hKey].ape.push(Math.abs(err) / actual);
        buckets[mId][hKey].logErr.push(logErr);
      }
    }
  }

  const descriptions: Record<
    ModelMetrics['modelId'],
    { name: string; short: string; desc: string }
  > = {
    naive: {
      name: 'Naive Persistence Baseline',
      short: 'Naive',
      desc: 'Random-walk benchmark assuming future USD/NGN remains unchanged at the latest observed rate.',
    },
    damped_ets: {
      name: 'Damped-Trend Exponential Smoothing (Log-ETS)',
      short: 'Damped ETS',
      desc: 'Log-space Holt damped-trend smoothing that adapts to recent FX stabilization while preventing runaway extrapolation.',
    },
    arx_inflation: {
      name: 'Inflation & FX Lag Regression (ARX-Ridge)',
      short: 'ARX Inflation',
      desc: 'Ridge-regularized autoregressive model linking monthly FX log-returns to lagged FX momentum and YoY inflation.',
    },
    seasonal_arx: {
      name: 'Seasonal Lagged ARX Regression',
      short: 'Seasonal ARX',
      desc: 'Multi-lag autoregressive model incorporating annual Fourier seasonality terms alongside lagged YoY inflation.',
    },
  };

  // Compute blended multi-horizon RMSE score among candidate ML/time-series models to select baseline
  const candidateIds: ModelMetrics['modelId'][] = [
    'damped_ets',
    'arx_inflation',
    'seasonal_arx',
  ];

  let selectedModelId: ModelMetrics['modelId'] = 'damped_ets';
  let bestBlendedRmse = Number.POSITIVE_INFINITY;

  const rawMetrics = modelIds.map((mId) => {
    const s1 = summarizeBucket(buckets[mId].h1);
    const s6 = summarizeBucket(buckets[mId].h6);
    const s12 = summarizeBucket(buckets[mId].h12);
    const blended = 0.25 * s1.rmse + 0.35 * s6.rmse + 0.4 * s12.rmse;
    if (candidateIds.includes(mId) && blended < bestBlendedRmse) {
      bestBlendedRmse = blended;
      selectedModelId = mId;
    }
    return { mId, s1, s6, s12 };
  });

  const modelComparison: ModelMetrics[] = rawMetrics.map(({ mId, s1, s6, s12 }) => ({
    modelId: mId,
    modelName: descriptions[mId].name,
    shortName: descriptions[mId].short,
    description: descriptions[mId].desc,
    mae1Step: s1.mae,
    rmse1Step: s1.rmse,
    mape1Step: s1.mape,
    mae6Step: s6.mae,
    rmse6Step: s6.rmse,
    mape6Step: s6.mape,
    mae12Step: s12.mae,
    rmse12Step: s12.rmse,
    mape12Step: s12.mape,
    isSelectedBaseline: mId === selectedModelId,
  }));

  // Fit selected model on FULL historical dataset to produce 60-month baseline forecast
  const fullLogSeries = rows.map((r) => Math.log(r.usdNgnRate));
  const fullHolt = fitBestDampedHolt(fullLogSeries);
  const fullArx = fitArxInflation(rows);
  const fullSeasonalArx = fitSeasonalArx(rows);

  // Calibrate log-space residual standard deviations from backtest errors of the selected model
  const stdOf = (arr: number[]): number => {
    if (arr.length < 2) return 0.04;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance =
      arr.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (arr.length - 1);
    return Math.sqrt(variance);
  };

  const selBucket = buckets[selectedModelId];
  const sigma1 = Math.max(0.02, stdOf(selBucket.h1.logErr));
  const sigma6 = Math.max(sigma1 * 1.4, stdOf(selBucket.h6.logErr));
  const sigma12 = Math.max(sigma6 * 1.15, stdOf(selBucket.h12.logErr));

  const lastRow = rows[n - 1];
  let curYear = lastRow.year;
  let curMonth = lastRow.monthNum;

  const baselineFxForecast: FxBaselinePoint[] = [];
  for (let h = 1; h <= 60; h++) {
    curMonth++;
    if (curMonth > 12) {
      curMonth = 1;
      curYear++;
    }

    let fxPred = lastRow.usdNgnRate;
    if (selectedModelId === 'damped_ets') {
      fxPred = predictDampedHolt(
        fullHolt.level,
        fullHolt.trend,
        fullHolt.params.phi,
        h
      );
    } else if (selectedModelId === 'arx_inflation') {
      fxPred = predictArxInflation(rows, fullArx, h);
    } else {
      fxPred = predictSeasonalArx(rows, fullSeasonalArx, h);
    }

    // Smoothly bridge backtest empirical uncertainty (h=1,6,12) to damped sub-linear growth out to h=60
    let sigmaLog: number;
    if (h <= 6) {
      sigmaLog = sigma1 + ((sigma6 - sigma1) * (h - 1)) / 5;
    } else if (h <= 12) {
      sigmaLog = sigma6 + ((sigma12 - sigma6) * (h - 6)) / 6;
    } else {
      // Damped uncertainty expansion beyond 12 months (~sqrt(h/12) attenuated by 0.72)
      sigmaLog = sigma12 * Math.pow(h / 12, 0.42);
    }

    const z80 = 1.2816;
    const z95 = 1.96;

    baselineFxForecast.push({
      horizon: h,
      dateKey: buildDateKey(curYear, curMonth),
      label: formatMonthLabel(curYear, curMonth),
      year: curYear,
      monthNum: curMonth,
      quarter: getQuarterLabel(curMonth),
      baselineFx: fxPred,
      lower80Fx: fxPred * Math.exp(-z80 * sigmaLog),
      upper80Fx: fxPred * Math.exp(z80 * sigmaLog),
      lower95Fx: fxPred * Math.exp(-z95 * sigmaLog),
      upper95Fx: fxPred * Math.exp(z95 * sigmaLog),
      sigmaLog,
    });
  }

  const inflationSensitivity = estimateInflationSensitivity(rows);
  const seasonalUnitIndices = extractSeasonalIndices(rows, (r) => r.unitsSold);
  const seasonalMarketingIndices = extractSeasonalIndices(
    rows,
    (r) => r.marketingSpendNgn
  );

  // Recent 24-month average COGS share (more representative of post-2024 regime)
  const recentRows = rows.slice(Math.max(0, n - 24));
  const totalRecentRev = recentRows.reduce((s, r) => s + r.salesRevenueNgn, 0);
  const totalRecentCogs = recentRows.reduce((s, r) => s + r.cogsNgn, 0);
  const historicalCogsShare =
    totalRecentRev > 0 ? totalRecentCogs / totalRecentRev : 0.63;

  // Historical CAGR of Units Sold
  const first12Units =
    rows.slice(0, 12).reduce((s, r) => s + r.unitsSold, 0) / 12;
  const last12Units =
    rows.slice(Math.max(0, n - 12)).reduce((s, r) => s + r.unitsSold, 0) / 12;
  const yearsSpan = Math.max(1, (n - 12) / 12);
  const historicalTrendAnnualUnitsPct =
    first12Units > 0
      ? (Math.pow(last12Units / first12Units, 1 / yearsSpan) - 1) * 100
      : 10;

  const learnedParamsSummary: string[] = [
    `Selected baseline model: ${descriptions[selectedModelId].name} (chosen via chronological expanding-window validation across ${n - minTrain - 1} origins).`,
    `Damped-Trend Log-ETS calibrated parameters: α = ${fullHolt.params.alpha.toFixed(2)}, β = ${fullHolt.params.beta.toFixed(2)}, damping φ = ${fullHolt.params.phi.toFixed(2)}.`,
    `Learned historical unit demand CAGR: ${historicalTrendAnnualUnitsPct.toFixed(2)}%/yr; Q4 (Nov/Dec) unit seasonality factor averages ${((seasonalUnitIndices[10] + seasonalUnitIndices[11]) * 50).toFixed(1)}% of annual monthly mean.`,
    `Recent 24-month imported COGS share of revenue: ${(historicalCogsShare * 100).toFixed(1)}%.`,
  ];

  return {
    selectedModelId,
    selectedModelName: descriptions[selectedModelId].name,
    modelComparison,
    backtestWindowCount: n - minTrain - 1,
    backtestStartLabel: rows[minTrain].label,
    backtestEndLabel: rows[n - 1].label,
    inflationSensitivity,
    baselineFxForecast,
    seasonalUnitIndices,
    seasonalMarketingIndices,
    historicalCogsShare,
    historicalTrendAnnualUnitsPct,
    learnedParamsSummary,
  };
}
