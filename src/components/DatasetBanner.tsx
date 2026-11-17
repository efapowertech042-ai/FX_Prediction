import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  Info,
  Moon,
  RotateCcw,
  Sun,
} from 'lucide-react';
import { DatasetSummary } from '../types/analytics';

interface DatasetBannerProps {
  summary: DatasetSummary;
  isDefaultDataset: boolean;
  theme: 'light' | 'dark';
  onSetTheme: (theme: 'light' | 'dark') => void;
  onTriggerUpload: () => void;
  onResetToMasterclassCsv: () => void;
  onDownloadForecast: () => void;
  uploadError: string | null;
  onDismissError: () => void;
  onDropFile: (file: File) => void;
}

export const DatasetBanner: React.FC<DatasetBannerProps> = ({
  summary,
  isDefaultDataset,
  theme,
  onSetTheme,
  onTriggerUpload,
  onResetToMasterclassCsv,
  onDownloadForecast,
  uploadError,
  onDismissError,
  onDropFile,
}) => {
  const [auditOpen, setAuditOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onDropFile(file);
    }
  };

  const warningCount = summary.issues.filter((i) => i.severity === 'warning').length;

  return (
    <section
      aria-label="Dataset status and workspace controls"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative overflow-hidden rounded-xl border transition-colors ${
        isDragging
          ? 'border-sky-500 bg-sky-50/70 dark:border-emerald-400 dark:bg-sky-950/30'
          : 'border-slate-200/90 bg-white/85 dark:border-slate-800/90 dark:bg-[#0B1426]/90'
      }`}
    >
      {/* Fine top gradient accent hairline */}
      <div
        aria-hidden="true"
        className="h-[2px] w-full bg-gradient-to-r from-sky-500 via-teal-400 to-emerald-400"
      />

      <div className="flex flex-col gap-3.5 px-5 py-3.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="font-display text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-lg">
            Meridian Tech Distribution — Predictive Analytics &amp; Forecasting
          </h1>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
            <span className="font-mono text-sky-700 dark:text-emerald-300">
              {summary.fileName}
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
              ·
            </span>
            <span className="tabular-nums">
              {summary.startDateLabel} – {summary.endDateLabel}
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
              ·
            </span>
            <span className="tabular-nums">
              {summary.observationCount} monthly observations
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
              ·
            </span>
            <span className="text-amber-700 dark:text-amber-300/90">
              Synthetic educational dataset (not official exchange-rate statistics)
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Light & Dark Toggle Buttons */}
          <div
            role="group"
            aria-label="Color theme toggle"
            className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-100/90 p-0.5 dark:border-slate-700/80 dark:bg-[#060C18]"
          >
            <button
              type="button"
              onClick={() => onSetTheme('light')}
              aria-pressed={theme === 'light'}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                theme === 'light'
                  ? 'bg-gradient-to-r from-sky-600 to-emerald-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <Sun className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Light</span>
            </button>
            <button
              type="button"
              onClick={() => onSetTheme('dark')}
              aria-pressed={theme === 'dark'}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                theme === 'dark'
                  ? 'bg-gradient-to-r from-sky-600 to-emerald-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <Moon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Dark</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setAuditOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300 hover:text-slate-950 dark:border-slate-700/80 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <span>
              Data Audit ({warningCount > 0 ? `${warningCount} warning` : 'Clean'})
            </span>
            {auditOpen ? (
              <ChevronUp className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            )}
          </button>

          {!isDefaultDataset && (
            <button
              type="button"
              onClick={onResetToMasterclassCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-300 dark:border-slate-700/80 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Masterclass CSV</span>
            </button>
          )}

          <button
            type="button"
            onClick={onTriggerUpload}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-sky-500/35 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-500/15 dark:border-emerald-400/35 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Replace CSV</span>
          </button>

          <button
            type="button"
            onClick={onDownloadForecast}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-sky-600 to-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-white hover:from-sky-500 hover:to-emerald-400 transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {uploadError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 border-t border-rose-300 bg-rose-50 px-5 py-3 text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
            <span>{uploadError}</span>
          </div>
          <button
            type="button"
            onClick={onDismissError}
            className="underline shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {auditOpen && (
        <div className="border-t border-slate-200/80 dark:border-slate-800/80 px-5 py-4 grid gap-5 md:grid-cols-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
              Automated Data Cleaning &amp; Validation Log
            </h2>
            <ul className="space-y-2">
              {summary.issues.map((issue, idx) => (
                <li
                  key={`${issue.code}-${idx}`}
                  className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-200 leading-relaxed"
                >
                  {issue.severity === 'warning' ? (
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden="true" />
                  ) : issue.code === 'ACCOUNTING_VERIFIED' ? (
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  ) : (
                    <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                  )}
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
              Historical Market Notes Recorded in CSV ({summary.marketNotesEvents.length})
            </h2>
            {summary.marketNotesEvents.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No Market_Notes annotations found in this CSV.
              </p>
            ) : (
              <ul className="space-y-2">
                {summary.marketNotesEvents.map((ev, idx) => (
                  <li
                    key={`${ev.dateLabel}-${idx}`}
                    className="flex items-baseline gap-2.5 text-xs text-slate-700 dark:text-slate-200"
                  >
                    <span className="font-mono text-sky-700 dark:text-emerald-300 shrink-0">
                      {ev.dateLabel}
                    </span>
                    <span className="text-slate-400" aria-hidden="true">
                      —
                    </span>
                    <span>{ev.note}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
