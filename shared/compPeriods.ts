/** Governed comp period ids — single source of truth for demo / defaults. */
export const CURRENT_PERIOD_ID = '2026-Q2';
export const CURRENT_PERIOD_LABEL = 'Q2 2026';
export const PRIOR_PERIOD_ID = '2025-Q4';
export const PRIOR_PERIOD_LABEL = 'Q4 2025';

/** Legacy period ids retained in warehouse for migration copy source. */
export const LEGACY_PERIOD_ID = '2025-Q1';
export const LEGACY_PRIOR_PERIOD_ID = '2024-Q4';

export interface CompPeriodOption {
  period_id: string;
  period_label: string;
  is_current: boolean;
}

export const DEFAULT_PERIODS: CompPeriodOption[] = [
  { period_id: CURRENT_PERIOD_ID, period_label: CURRENT_PERIOD_LABEL, is_current: true },
  { period_id: PRIOR_PERIOD_ID, period_label: PRIOR_PERIOD_LABEL, is_current: false },
];
