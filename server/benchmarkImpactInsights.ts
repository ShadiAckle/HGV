import { appendInsightGrounding } from '../shared/insightGrounding.js';
import { isFrontlineRepRoleKey, withHgvRepBrandFraming } from '../shared/hgvRepBrandFraming.js';
import type { InsightGroundingOptions } from './managerInsights.js';
import type { CompImpactLine, CompImpactStatus } from '../shared/compStatementImpact.js';

export type BenchmarkImpactRoleKey =
  | 'marketing_rep'
  | 'sales_executive'
  | 'sales_manager'
  | 'marketing_manager'
  | 'marketing_director';

const VALID_STATUS = new Set<CompImpactStatus>(['aligned', 'at_risk', 'gap', 'info']);

const ROLE_AUDIENCE: Record<BenchmarkImpactRoleKey, string> = {
  marketing_rep: 'MARKETING REP',
  sales_executive: 'SALES EXECUTIVE',
  sales_manager: 'SALES MANAGER',
  marketing_manager: 'MARKETING MANAGER',
  marketing_director: 'MARKETING DIRECTOR',
};

const ROLE_AREAS: Record<BenchmarkImpactRoleKey, string[]> = {
  marketing_rep: [
    'Area 1: Your total cash (TCC) vs marketing rep market bands',
    'Area 2: Pay mix volatility (base/variable vs market 60/40)',
    'Area 3: Commission rate, tour tier, and plan-metric upside on your statement',
    'Area 4: Desk incentives — regional bonus tiers, SPIFF gates, tour quality/show rate',
  ],
  sales_executive: [
    'Area 1: Your total cash (TCC) vs sales executive market bands',
    'Area 2: Pay mix volatility (base/variable vs market 30/70–40/60)',
    'Area 3: Commission rate, quota tier, and deal-credit upside on your statement',
    'Area 4: Pipeline and closed-deal quality — what moves you to the next rate booster',
  ],
  sales_manager: [
    'Area 1: Your manager TCC vs market for player-coach sales managers',
    'Area 2: Pay mix vs market for your role',
    'Area 3: How team quota rollup and direct-report production affect your payout',
    'Area 4: Override / takeover economics and FFS mix impact on your comp check',
  ],
  marketing_manager: [
    'Area 1: Your manager TCC vs market for site marketing managers',
    'Area 2: Pay mix vs market for your role',
    'Area 3: How LM Tours, NSV, and club penetration weights translate to your payout',
    'Area 4: Team tour flow and contribution timing (monthly vs quarterly) on your statement',
  ],
  marketing_director: [
    'Area 1: Your director TCC vs market bands',
    'Area 2: Pay mix vs market for director-level roles',
    'Area 3: Regional NSV and contribution attainment vs payout curve',
    'Area 4: Profitability weight (NOI/contribution) vs revenue-heavy plan design',
  ],
};

const ROLE_EXCLUSIONS: Record<BenchmarkImpactRoleKey, string> = {
  marketing_rep:
    'Do NOT mention directors, VPs, sales managers, or leadership-only NOI planning unless comparing market bands at rep level only.',
  sales_executive:
    'Do NOT mention marketing tour desks, FPS packages, or director/manager workflows.',
  sales_manager:
    'Do NOT mention marketing rep tour tiers or director-only regional NOI planning.',
  marketing_manager:
    'Do NOT mention marketing rep tour-rate mechanics or VP-level benchmarks.',
  marketing_director:
    'Do NOT mention frontline rep tour-tier coaching or sales executive deal credits.',
};

function groundedContext(context: string, grounding?: InsightGroundingOptions): string {
  return appendInsightGrounding(context, {
    includeSlide16: false,
    includeTeamMarket: false,
    industryBenchmarks: grounding?.industryBenchmarks,
  });
}

export function buildBenchmarkImpactPrompt(
  context: string,
  roleTitle: string,
  roleKey: BenchmarkImpactRoleKey,
  grounding?: InsightGroundingOptions,
): string {
  const audience = ROLE_AUDIENCE[roleKey];
  const areas = ROLE_AREAS[roleKey];
  const exclusion = ROLE_EXCLUSIONS[roleKey];
  const grounded = groundedContext(context, grounding);

  const brandRules = isFrontlineRepRoleKey(roleKey) ? withHgvRepBrandFraming([]) : [];

  return [
    `You are the HGV IGNITE Compensation Agent explaining how industry market standards affect a ${roleTitle}'s comp statement.`,
    `Audience: ${audience} only.`,
    'You have live warehouse facts and role-scoped industry benchmarks below.',
    '',
    'CRITICAL RULES:',
    '1. Synthesize fresh copy from the numbers — never paste template paragraphs.',
    `2. ${exclusion}`,
    '3. Use exact dollar amounts, percentages, tier labels, rep/deal/tour IDs, and metric weights from context.',
    '4. Produce exactly 4 impact areas:',
    ...areas.map((a) => `   - ${a}`),
    '5. Return ONLY valid JSON (no markdown fences) — an array of 4 objects:',
    '[{"areaId":1,"areaHeadline":"...","badge":"...","status":"aligned|at_risk|gap|info","statementImpact":"...","detail":"...","marketAlignedPreview":"..."}]',
    '6. statementImpact = one punchy line with $ or % impact on this period\'s statement. detail = 2-3 sentences grounded in their data.',
    '7. marketAlignedPreview is optional; include when a concrete upside action exists.',
    '8. Vary areaHeadline and badge wording each generation — same facts, different phrasing.',
    ...(isFrontlineRepRoleKey(roleKey)
      ? [
          '9. For status and badges: NEVER imply HGV is below market or uncompetitive. Prefer status "info" or "aligned" with badges like "HGV Upside Path", "Accelerator Opportunity", or "Plan Strength". Use "gap" or "at_risk" ONLY for rep-controllable metrics (tours, show rate, tier attainment) — never for HGV plan or TCC inferiority.',
          '10. areaHeadline, detail, and statementImpact must always position HGV favorably vs market comparisons.',
        ]
      : []),
    ...brandRules,
    '=== LIVE CONTEXT ===',
    grounded,
    '=== END CONTEXT ===',
    '',
    'Return the JSON array now.',
  ].join('\n');
}

/** @deprecated use buildBenchmarkImpactPrompt */
export function buildMarketingBenchmarkImpactPrompt(
  context: string,
  roleTitle: string,
  grounding?: InsightGroundingOptions,
): string {
  return buildBenchmarkImpactPrompt(context, roleTitle, 'marketing_rep', grounding);
}

function asImpactStatus(v: unknown): CompImpactStatus | null {
  const s = String(v ?? '');
  return VALID_STATUS.has(s as CompImpactStatus) ? (s as CompImpactStatus) : null;
}

function asAreaId(v: unknown): 1 | 2 | 3 | 4 | null {
  const n = Number(v);
  if (n >= 1 && n <= 4) return n as 1 | 2 | 3 | 4;
  return null;
}

export function parseCompImpactLines(raw: string): CompImpactLine[] {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fenceMatch ? fenceMatch[1].trim() : trimmed;
  const start = jsonText.indexOf('[');
  const end = jsonText.lastIndexOf(']');
  if (start < 0 || end <= start) {
    throw new Error('Model response did not contain a JSON array');
  }

  const parsed = JSON.parse(jsonText.slice(start, end + 1)) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Model returned an empty impact array');
  }

  const lines: CompImpactLine[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const areaId = asAreaId(row.areaId);
    const status = asImpactStatus(row.status);
    const areaHeadline = String(row.areaHeadline ?? '').trim();
    const badge = String(row.badge ?? '').trim();
    const statementImpact = String(row.statementImpact ?? '').trim();
    const detail = String(row.detail ?? '').trim();
    if (!areaId || !status || !areaHeadline || !badge || !statementImpact || !detail) continue;

    const previewRaw = row.marketAlignedPreview;
    const marketAlignedPreview =
      previewRaw != null && String(previewRaw).trim() ? String(previewRaw).trim() : undefined;

    lines.push({
      areaId,
      areaHeadline,
      badge,
      status,
      statementImpact,
      detail,
      ...(marketAlignedPreview ? { marketAlignedPreview } : {}),
    });
  }

  if (lines.length < 4) {
    throw new Error(`Expected 4 benchmark impact areas, got ${lines.length}`);
  }

  return lines.sort((a, b) => a.areaId - b.areaId).slice(0, 4);
}

export function resolveBenchmarkRoleKey(raw?: string | null): BenchmarkImpactRoleKey {
  switch (raw) {
    case 'marketing_rep':
    case 'sales_executive':
    case 'sales_manager':
    case 'marketing_manager':
    case 'marketing_director':
      return raw;
    default:
      return 'marketing_rep';
  }
}
