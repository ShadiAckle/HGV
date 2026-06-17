/**
 * Compensation Configuration Types
 *
 * Self-service admin configuration for compensation rules and mappings.
 * Enables stakeholders to adjust business rules without SQL changes.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tour Status → Payout Mapping
// ─────────────────────────────────────────────────────────────────────────────

export interface TourStatusConfig {
  config_id: string;
  tour_status_desc: string | null;  // NULL represented as null in TypeScript
  payout_amount: number;
  is_active: boolean;
  effective_start_date: string;  // ISO date string
  effective_end_date: string | null;
  created_at: string;
  created_by: string;
  updated_at: string | null;  // ISO timestamp
  updated_by: string | null;
}

export interface TourStatusConfigInput {
  tour_status_desc: string | null;
  payout_amount: number;
  is_active?: boolean;
  effective_start_date: string;
  effective_end_date?: string | null;
  created_by: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Compensation Rule Configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface CompRuleConfig {
  config_id: string;
  rule_name: string;
  rule_value: string;
  rule_description: string | null;
  is_active: boolean;
  effective_start_date: string;
  effective_end_date: string | null;
  created_at: string;
  created_by: string;
  updated_at: string | null;
  updated_by: string | null;
}

export interface CompRuleConfigInput {
  rule_name: string;
  rule_value: string;
  rule_description?: string | null;
  is_active?: boolean;
  effective_start_date: string;
  effective_end_date?: string | null;
  created_by: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rep Filtering Rules
// ─────────────────────────────────────────────────────────────────────────────

export interface RepFilterConfig {
  config_id: string;
  filter_name: string;
  filter_type: string;
  filter_value: string;
  is_active: boolean;
  effective_start_date: string;
  effective_end_date: string | null;
  created_at: string;
  created_by: string;
  updated_at: string | null;
  updated_by: string | null;
}

export interface RepFilterConfigInput {
  filter_name: string;
  filter_type: string;
  filter_value: string;
  is_active?: boolean;
  effective_start_date: string;
  effective_end_date?: string | null;
  created_by: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration Change Audit Log
// ─────────────────────────────────────────────────────────────────────────────

export interface CompConfigAuditLog {
  audit_id: string;
  config_table: string;
  config_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  changed_by: string;
  changed_at: string;
  old_value: string | null;  // JSON snapshot
  new_value: string | null;  // JSON snapshot
}

// ─────────────────────────────────────────────────────────────────────────────
// Known Rule Names (for type safety)
// ─────────────────────────────────────────────────────────────────────────────

export type CompRuleName =
  | 'multi_rep_credit_policy'
  | 'min_tour_count_threshold'
  | 'rep_name_exclude_pattern'
  | 'default_payout_amount'
  | 'null_status_handling';

export type MultiRepCreditPolicy = 'first_rep_only' | 'split_credit' | 'all_reps' | 'primary_rep';

export type FilterType = 'exclude_pattern' | 'min_tour_count' | 'site_filter' | 'role_filter';

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert NULL tour status to '__NULL__' string for SQL joins.
 */
export function normalizeTourStatusForSql(status: string | null): string {
  return status === null ? '__NULL__' : status;
}

/**
 * Convert '__NULL__' back to null for display.
 */
export function denormalizeTourStatusFromSql(status: string | null): string | null {
  return status === '__NULL__' ? null : status;
}

/**
 * Format tour status for display in UI.
 */
export function formatTourStatusDisplay(status: string | null): string {
  if (status === null) return '(null/unknown)';
  if (status === '__NULL__') return '(null/unknown)';
  return status;
}
