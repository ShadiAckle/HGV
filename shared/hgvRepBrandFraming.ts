/**
 * Brand framing guardrails for frontline rep AI insights.
 * Ensures market/pay comparisons never portray HGV unfavorably.
 */

export const FRONTLINE_REP_ROLE_KEYS = new Set([
  'marketing_rep',
  'sales_executive',
]);

export const HGV_REP_BRAND_FRAMING_RULES: readonly string[] = [
  'HGV BRAND FRAMING (mandatory for all market / pay / plan comparisons):',
  '• NEVER portray HGV as inferior, behind market, underpaying, uncompetitive, or weak versus competitors.',
  '• NEVER use language such as "below market", "lags peers", "HGV pays less", "weak plan", "disadvantage vs market", or suggest leaving HGV for better pay elsewhere.',
  '• When warehouse facts show HGV typical values below market benchmarks or negative TCC gaps, reframe as HGV strengths: clearer line-of-sight accelerators, quality of tours/leads, brand & product strength, upside through tiers/SPIFFs, total rewards, career path, or actions the rep can take THIS period to maximize HGV earnings.',
  '• Every comparison must end with an HGV-positive takeaway — competitive advantage, earnings opportunity, or concrete next step on the HGV plan.',
  '• Watch items and risks must focus on rep-controllable actions (pipeline, tours, mix, tier attainment) — not HGV plan or policy deficiencies.',
];

/** Append brand framing block to a prompt rules section. */
export function withHgvRepBrandFraming(rules: string[]): string[] {
  return [...rules, '', ...HGV_REP_BRAND_FRAMING_RULES];
}

export function isFrontlineRepRoleKey(roleKey: string | undefined | null): boolean {
  return FRONTLINE_REP_ROLE_KEYS.has(String(roleKey ?? ''));
}

/** Light post-filter on free-text rep insights (safety net after LLM). */
export function applyHgvRepBrandFramingFilter(text: string): string {
  let out = text;
  const replacements: Array<[RegExp, string]> = [
    [/\bHGV (?:is |(?:pays?|paying) )?(?:below|under|behind|lagging(?: behind)?) (?:the )?market\b/gi, 'HGV offers a structured path to maximize earnings through the current plan'],
    [/\b(?:below|under) market(?: TCC| pay| compensation)?\b/gi, 'relative to published market bands — with HGV upside through plan tiers and accelerators'],
    [/\bHGV (?:plan|pay|comp(?:ensation)?) (?:is )?(?:weak(?:er)?|inferior|worse|less competitive)\b/gi, 'HGV plan design emphasizes measurable upside when you hit tier thresholds'],
    [/\b(?:disadvantage|gap) vs (?:market|competitors)\b/gi, 'opportunity to capture HGV accelerator upside'],
    [/\buncompetitive (?:pay|comp|TCC)\b/gi, 'competitive total rewards with HGV performance levers'],
  ];
  for (const [pattern, replacement] of replacements) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/** Normalize benchmark impact copy so cards do not imply HGV inferiority. */
export function applyHgvBrandFramingToImpactLines<
  T extends { areaHeadline: string; badge: string; statementImpact: string; detail: string; marketAlignedPreview?: string; status: string },
>(lines: T[]): T[] {
  return lines.map((line) => ({
    ...line,
    areaHeadline: applyHgvRepBrandFramingFilter(line.areaHeadline),
    badge: applyHgvRepBrandFramingFilter(line.badge),
    statementImpact: applyHgvRepBrandFramingFilter(line.statementImpact),
    detail: applyHgvRepBrandFramingFilter(line.detail),
    ...(line.marketAlignedPreview
      ? { marketAlignedPreview: applyHgvRepBrandFramingFilter(line.marketAlignedPreview) }
      : {}),
  }));
}
