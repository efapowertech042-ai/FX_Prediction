import React from 'react';
import { Upload } from 'lucide-react';

export type DashboardPage =
  | 'overview'
  | 'usd-forecast'
  | 'profit-forecast'
  | 'scenarios'
  | 'risk-model';

interface TopBarProps {
  activePage: DashboardPage;
  onSelectPage: (page: DashboardPage) => void;
  onTriggerUpload: () => void;
}

const NAV_ITEMS: Array<{ id: DashboardPage; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'usd-forecast', label: 'USD/NGN' },
  { id: 'profit-forecast', label: 'Profit' },
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'risk-model', label: 'Risk & Model' },
];

export const TopBar: React.FC<TopBarProps> = ({
  activePage,
  onSelectPage,
  onTriggerUpload,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-slate-800/80 dark:bg-[#060C18]/90">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-4 py-3 sm:px-6 lg:px-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => onSelectPage('overview')}
          className="font-display text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-500"
        >
          Meridian AI
        </button>

        {/* Zone 2: 5 concise single-line nav buttons */}
        <nav
          aria-label="Dashboard pages"
          className="hidden md:flex items-center gap-6 text-sm font-medium"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectPage(item.id)}
                className={`relative py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'text-slate-950 dark:text-white font-semibold'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                <span>{item.label}</span>
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[13px] h-0.5 rounded-full bg-gradient-to-r from-sky-500 to-emerald-400"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary CTA */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onTriggerUpload}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-sky-600 to-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:from-sky-500 hover:to-emerald-400 active:scale-[0.99] transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Upload CSV</span>
          </button>
        </div>
      </div>

      {/* Mobile page navigation strip */}
      <nav
        aria-label="Mobile dashboard pages"
        className="flex md:hidden items-center gap-1 overflow-x-auto border-t border-slate-200/70 px-4 py-1.5 dark:border-slate-800/70"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectPage(item.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-sky-500/15 to-emerald-400/15 text-sky-700 dark:text-emerald-300 font-semibold'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
