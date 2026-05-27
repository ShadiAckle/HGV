/**
 * Industry compensation standards (industry benchmark framework).
 * Ground truth for AI insights, pay-mix flags, and Strategy Control Room.
 */

export interface Slide16Area {
  id: 1 | 2 | 3 | 4;
  headline: string;
  description: string;
  benchmark: string;
}

export const SLIDE_16_AREAS: Slide16Area[] = [
  {
    id: 1,
    headline: 'Below Market Target Cash Levels',
    description: 'Total cash compensation (base + target incentives) vs industry benchmarks.',
    benchmark: 'Directors/Sr. Directors 10–17% below market TCC; Sales VPs 14–43% below market target TCC.',
  },
  {
    id: 2,
    headline: 'Variable-Heavy Pay Mix Volatility',
    description: 'Base/variable cash mix vs competitor ranges by role.',
    benchmark: 'Marketing reps market standard 60/40 (base/variable); HGV often inverted at 40/60.',
  },
  {
    id: 3,
    headline: 'Commission Rate & Opportunity Misalignment',
    description: 'Commission rates and upside opportunity vs market bands.',
    benchmark: 'Optimal commission 4–6%; below 4% = talent attrition risk; above 6% = cost risk.',
  },
  {
    id: 4,
    headline: 'NOI / Margin Weight in Director+ Plans',
    description: 'Revenue-heavy vs profit-centric metric weighting in leadership plans.',
    benchmark: 'Market-aligned Director+ plans weight NOI 50–80% to protect margins.',
  },
];

export interface PayMixStandard {
  roleKey: string;
  roleLabel: string;
  marketBasePct: number;
  marketVariablePct: number;
  hgvTypicalBasePct: number;
  hgvTypicalVariablePct: number;
}

export const PAY_MIX_STANDARDS: PayMixStandard[] = [
  { roleKey: 'sales_executive', roleLabel: 'Sales Executives', marketBasePct: 35, marketVariablePct: 65, hgvTypicalBasePct: 20, hgvTypicalVariablePct: 80 },
  { roleKey: 'marketing_rep', roleLabel: 'Marketing Reps', marketBasePct: 60, marketVariablePct: 40, hgvTypicalBasePct: 40, hgvTypicalVariablePct: 60 },
  { roleKey: 'sales_manager', roleLabel: 'Sales Managers', marketBasePct: 50, marketVariablePct: 50, hgvTypicalBasePct: 30, hgvTypicalVariablePct: 70 },
  { roleKey: 'marketing_manager', roleLabel: 'Marketing Managers', marketBasePct: 62.5, marketVariablePct: 37.5, hgvTypicalBasePct: 40, hgvTypicalVariablePct: 60 },
  { roleKey: 'marketing_director', roleLabel: 'Directors / Sr. Directors', marketBasePct: 65, marketVariablePct: 35, hgvTypicalBasePct: 35, hgvTypicalVariablePct: 65 },
];

export interface TeamMarketPosition {
  rep_id: string;
  rep_name: string;
  role: string;
  /** Negative = below market TCC; positive = above market */
  tcc_gap_vs_market_pct: number;
  base_pct: number;
  variable_pct: number;
  quota_attainment_pct: number;
}

/** Mixed seed — some above market, some below (stakeholder request). */
export const TEAM_MARKET_POSITIONS: TeamMarketPosition[] = [
  { rep_id: 'DR-001', rep_name: 'M. Chen', role: 'Marketing Rep', tcc_gap_vs_market_pct: -12, base_pct: 38, variable_pct: 62, quota_attainment_pct: 112 },
  { rep_id: 'DR-002', rep_name: 'J. Rivera', role: 'Marketing Rep', tcc_gap_vs_market_pct: 5, base_pct: 55, variable_pct: 45, quota_attainment_pct: 94 },
  { rep_id: 'DR-003', rep_name: 'A. Patel', role: 'Marketing Rep', tcc_gap_vs_market_pct: -18, base_pct: 35, variable_pct: 65, quota_attainment_pct: 58 },
  { rep_id: 'DR-004', rep_name: 'K. Nguyen', role: 'Marketing Rep', tcc_gap_vs_market_pct: -8, base_pct: 42, variable_pct: 58, quota_attainment_pct: 71 },
  { rep_id: 'DR-005', rep_name: 'S. Okonkwo', role: 'Marketing Rep', tcc_gap_vs_market_pct: 3, base_pct: 58, variable_pct: 42, quota_attainment_pct: 103 },
  { rep_id: 'DR-006', rep_name: 'L. Torres', role: 'Marketing Rep', tcc_gap_vs_market_pct: -22, base_pct: 32, variable_pct: 68, quota_attainment_pct: 48 },
];

export function formatSlide16Context(): string {
  return [
    '## Industry Compensation Standards (MUST reference when advising)',
    ...SLIDE_16_AREAS.map(
      (a) => `- **Area ${a.id}: ${a.headline}** — ${a.description} Benchmark: ${a.benchmark}`,
    ),
    '',
    '## Industry Pay Mix Standards (base/variable %)',
    ...PAY_MIX_STANDARDS.map(
      (p) =>
        `- ${p.roleLabel}: Market ${p.marketBasePct}/${p.marketVariablePct} | HGV typical ${p.hgvTypicalBasePct}/${p.hgvTypicalVariablePct}`,
    ),
  ].join('\n');
}

export function getPayMixForRole(roleKey: string) {
  return PAY_MIX_STANDARDS.find((p) => p.roleKey === roleKey) ?? PAY_MIX_STANDARDS[1];
}

export function assessPayMix(roleKey: string, actualBasePct: number) {
  const std = getPayMixForRole(roleKey);
  const gap = actualBasePct - std.marketBasePct;
  const inverted = roleKey === 'marketing_rep' && actualBasePct < std.marketBasePct - 10;
  return {
    aligned: Math.abs(gap) <= 8,
    inverted,
    marketBasePct: std.marketBasePct,
    marketVariablePct: std.marketVariablePct,
    gapPct: gap,
    message: inverted
      ? `Pay mix ${actualBasePct}/${100 - actualBasePct} is inverted vs market ${std.marketBasePct}/${std.marketVariablePct} — variable-heavy volatility risk.`
      : Math.abs(gap) <= 8
        ? `Pay mix aligned with market ${std.marketBasePct}/${std.marketVariablePct}.`
        : `Base ${gap > 0 ? 'above' : 'below'} market by ${Math.abs(gap).toFixed(0)} pts.`,
  };
}

export function combinedAtRiskFlag(quotaAttainment: number, tccGapPct: number): 'CRITICAL' | 'AT_RISK' | 'ON_TRACK' {
  const quotaAtRisk = quotaAttainment < 70;
  const marketAtRisk = tccGapPct <= -10;
  if (quotaAtRisk && marketAtRisk) return 'CRITICAL';
  if (quotaAtRisk || marketAtRisk) return 'AT_RISK';
  return 'ON_TRACK';
}

export function formatTeamMarketContext(positions: TeamMarketPosition[] = []): string {
  if (!positions.length) {
    return '## Team Pay vs Market (Unity Catalog: fact_rep_market_position)\nNo team market position rows loaded for this period.';
  }
  return [
    '## Team Pay vs Market (Unity Catalog: fact_rep_market_position)',
    JSON.stringify(
      positions.map((p) => ({
        ...p,
        combined_risk: combinedAtRiskFlag(p.quota_attainment_pct, p.tcc_gap_vs_market_pct),
        pay_mix_flag: assessPayMix('marketing_rep', p.base_pct).message,
      })),
      null,
      2,
    ),
  ].join('\n');
}
