import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MASTERCLASS_CSV_FILENAME,
  MASTERCLASS_CSV_RAW,
} from './data/masterclassCsv';
import { parseAndValidateCsv, ParsedDataset } from './engine/csvParser';
import { trainAndEvaluateForecastingEngine } from './engine/forecasting';
import {
  getPresetParams,
  runFinancialForecast,
} from './engine/financialEngine';
import {
  evaluateRiskIntelligence,
  generateDataGroundedInsights,
} from './engine/riskAndInsights';
import { ScenarioParams, ScenarioPresetId } from './types/analytics';
import { exportForecastCsv } from './utils/formatters';
import { DashboardPage, TopBar } from './components/TopBar';
import { DatasetBanner } from './components/DatasetBanner';
import { ExecutiveOverview } from './components/ExecutiveOverview';
import { ScenarioSimulator } from './components/ScenarioSimulator';
import { UsdForecastPage } from './components/UsdForecastPage';
import { ProfitForecastPage } from './components/ProfitForecastPage';
import { RevenueProfitabilitySection } from './components/RevenueProfitabilitySection';
import { ScenarioComparisonSection } from './components/ScenarioComparisonSection';
import { RiskAndInsightsSection } from './components/RiskAndInsightsSection';
import { ModelTransparencySection } from './components/ModelTransparencySection';

export default function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [activePage, setActivePage] = useState<DashboardPage>('overview');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = window.localStorage.getItem('meridian-theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // Ignore storage access errors
    }
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      window.localStorage.setItem('meridian-theme', theme);
    } catch {
      // Ignore storage access errors
    }
  }, [theme]);

  const [datasetSource, setDatasetSource] = useState<{
    csvText: string;
    fileName: string;
    isDefault: boolean;
  }>({
    csvText: MASTERCLASS_CSV_RAW,
    fileName: MASTERCLASS_CSV_FILENAME,
    isDefault: true,
  });

  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  const parsedDataset = useMemo<ParsedDataset>(() => {
    return parseAndValidateCsv(datasetSource.csvText, datasetSource.fileName);
  }, [datasetSource]);

  const modelOutput = useMemo(() => {
    return trainAndEvaluateForecastingEngine(parsedDataset.rows);
  }, [parsedDataset.rows]);

  const latestInf = parsedDataset.summary.latestInflationPct;

  const [scenarioParams, setScenarioParams] = useState<ScenarioParams>(() =>
    getPresetParams('base', latestInf)
  );
  const [savedCustomParams, setSavedCustomParams] = useState<ScenarioParams>(
    () => ({
      ...getPresetParams('base', latestInf),
      presetId: 'custom',
    })
  );

  const handleSelectPreset = (presetId: Exclude<ScenarioPresetId, 'custom'>) => {
    setScenarioParams(getPresetParams(presetId, latestInf));
  };

  const handleChangeParams = (next: ScenarioParams) => {
    setScenarioParams(next);
    setSavedCustomParams({ ...next, presetId: 'custom' });
  };

  const handleResetBaseline = () => {
    setScenarioParams(getPresetParams('base', latestInf));
  };

  const processFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      setUploadError(
        `Unsupported file type (${file.name}). Please upload a valid .csv file.`
      );
      return;
    }

    setIsProcessingFile(true);
    setUploadError(null);

    try {
      const text = await file.text();
      const validated = parseAndValidateCsv(text, file.name);
      setDatasetSource({
        csvText: text,
        fileName: file.name,
        isDefault: false,
      });
      const nextBase = getPresetParams(
        'base',
        validated.summary.latestInflationPct
      );
      setScenarioParams(nextBase);
      setSavedCustomParams({ ...nextBase, presetId: 'custom' });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to parse uploaded CSV file.';
      setUploadError(msg);
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processFile(file);
    }
    e.target.value = '';
  };

  const handleResetToMasterclassCsv = () => {
    setUploadError(null);
    setDatasetSource({
      csvText: MASTERCLASS_CSV_RAW,
      fileName: MASTERCLASS_CSV_FILENAME,
      isDefault: true,
    });
    const validated = parseAndValidateCsv(
      MASTERCLASS_CSV_RAW,
      MASTERCLASS_CSV_FILENAME
    );
    const nextBase = getPresetParams(
      'base',
      validated.summary.latestInflationPct
    );
    setScenarioParams(nextBase);
    setSavedCustomParams({ ...nextBase, presetId: 'custom' });
  };

  const baseScenario = useMemo(
    () =>
      runFinancialForecast(
        parsedDataset.rows,
        modelOutput,
        getPresetParams('base', latestInf)
      ),
    [parsedDataset.rows, modelOutput, latestInf]
  );

  const optimisticScenario = useMemo(
    () =>
      runFinancialForecast(
        parsedDataset.rows,
        modelOutput,
        getPresetParams('optimistic', latestInf)
      ),
    [parsedDataset.rows, modelOutput, latestInf]
  );

  const stressScenario = useMemo(
    () =>
      runFinancialForecast(
        parsedDataset.rows,
        modelOutput,
        getPresetParams('stress', latestInf)
      ),
    [parsedDataset.rows, modelOutput, latestInf]
  );

  const customScenario = useMemo(
    () =>
      runFinancialForecast(
        parsedDataset.rows,
        modelOutput,
        savedCustomParams
      ),
    [parsedDataset.rows, modelOutput, savedCustomParams]
  );

  const activeScenario = useMemo(
    () =>
      runFinancialForecast(
        parsedDataset.rows,
        modelOutput,
        scenarioParams
      ),
    [parsedDataset.rows, modelOutput, scenarioParams]
  );

  const riskReport = useMemo(
    () => evaluateRiskIntelligence(parsedDataset.rows, activeScenario),
    [parsedDataset.rows, activeScenario]
  );

  const insights = useMemo(
    () =>
      generateDataGroundedInsights(
        parsedDataset.rows,
        modelOutput,
        activeScenario,
        baseScenario,
        stressScenario
      ),
    [parsedDataset.rows, modelOutput, activeScenario, baseScenario, stressScenario]
  );

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleDownloadForecast = () => {
    exportForecastCsv(activeScenario.monthly, scenarioParams.presetId);
  };

  const handleNavigate = (page: DashboardPage) => {
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        theme === 'dark' ? 'ambient-canvas-dark' : 'ambient-canvas-light'
      } text-slate-900 dark:text-slate-100`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleFileInputChange}
        className="sr-only"
        aria-label="Upload business CSV dataset"
      />

      <TopBar
        activePage={activePage}
        onSelectPage={handleNavigate}
        onTriggerUpload={triggerUpload}
      />

      <main className="mx-auto max-w-[1440px] space-y-6 px-4 py-5 sm:px-6 lg:px-8">
        {isProcessingFile && (
          <div className="rounded-xl border border-sky-400/50 bg-sky-50 px-5 py-3 text-xs text-sky-900 dark:border-emerald-400/40 dark:bg-emerald-950/30 dark:text-emerald-200">
            Parsing CSV observations, running chronological backtests, and recalibrating 60-month projections…
          </div>
        )}

        <DatasetBanner
          summary={parsedDataset.summary}
          isDefaultDataset={datasetSource.isDefault}
          theme={theme}
          onSetTheme={setTheme}
          onTriggerUpload={triggerUpload}
          onResetToMasterclassCsv={handleResetToMasterclassCsv}
          onDownloadForecast={handleDownloadForecast}
          uploadError={uploadError}
          onDismissError={() => setUploadError(null)}
          onDropFile={(f) => void processFile(f)}
        />

        {activePage === 'overview' && (
          <div className="space-y-7">
            <ExecutiveOverview
              summary={parsedDataset.summary}
              currentScenario={activeScenario}
              baseScenario={baseScenario}
              onNavigate={handleNavigate}
            />

            <ScenarioSimulator
              params={scenarioParams}
              latestInflationPct={latestInf}
              onChangeParams={handleChangeParams}
              onSelectPreset={handleSelectPreset}
              onResetBaseline={handleResetBaseline}
            />

            <RevenueProfitabilitySection
              historical={parsedDataset.rows}
              currentScenario={activeScenario}
              theme={theme}
            />

            <RiskAndInsightsSection
              riskReport={riskReport}
              insights={insights}
              showInsights={true}
              showRisk={false}
            />
          </div>
        )}

        {activePage === 'usd-forecast' && (
          <UsdForecastPage
            historical={parsedDataset.rows}
            summary={parsedDataset.summary}
            modelOutput={modelOutput}
            currentScenario={activeScenario}
            baseScenario={baseScenario}
            params={scenarioParams}
            theme={theme}
            onChangeParams={handleChangeParams}
            onSelectPreset={handleSelectPreset}
            onResetBaseline={handleResetBaseline}
          />
        )}

        {activePage === 'profit-forecast' && (
          <ProfitForecastPage
            historical={parsedDataset.rows}
            summary={parsedDataset.summary}
            currentScenario={activeScenario}
            baseScenario={baseScenario}
            params={scenarioParams}
            theme={theme}
            onChangeParams={handleChangeParams}
            onSelectPreset={handleSelectPreset}
            onResetBaseline={handleResetBaseline}
          />
        )}

        {activePage === 'scenarios' && (
          <div className="space-y-7">
            <ScenarioSimulator
              params={scenarioParams}
              latestInflationPct={latestInf}
              onChangeParams={handleChangeParams}
              onSelectPreset={handleSelectPreset}
              onResetBaseline={handleResetBaseline}
            />

            <ScenarioComparisonSection
              baseScenario={baseScenario}
              optimisticScenario={optimisticScenario}
              stressScenario={stressScenario}
              customScenario={customScenario}
              activePresetId={scenarioParams.presetId}
              theme={theme}
            />
          </div>
        )}

        {activePage === 'risk-model' && (
          <div className="space-y-8">
            <RiskAndInsightsSection
              riskReport={riskReport}
              insights={insights}
              showInsights={true}
              showRisk={true}
            />

            <ModelTransparencySection modelOutput={modelOutput} />
          </div>
        )}
      </main>

      <footer className="mt-10 border-t border-slate-200/80 dark:border-slate-800/80 py-6">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 text-xs text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            Meridian Tech Distribution · Predictive Analytics &amp; Business Intelligence Simulator
          </p>
          <p>
            Synthetic educational dataset — not official exchange-rate statistics.
          </p>
        </div>
      </footer>
    </div>
  );
}
