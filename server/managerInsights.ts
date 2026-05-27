import type { ActionItem, ManagerWorkspacePayload, MetricAttainmentRow } from './managerWorkspace.js';
import { appendInsightGrounding } from '../shared/insightGrounding.js';
import type { TeamMarketPosition } from '../shared/compStandards.js';

export type ManagerInsightFocus = 'payout' | 'coaching';

export interface InsightGroundingOptions {
  industryBenchmarks?: Record<string, unknown>[];
  teamMarketPositions?: TeamMarketPosition[];
}

export function buildManagerInsightPrompt(
  groundingContext: string,
  roleTitle: string,
  focus: ManagerInsightFocus = 'payout',
  grounding?: InsightGroundingOptions,
): string {
  const grounded = appendInsightGrounding(groundingContext, {
    includeSlide16: false,
    includeTeamMarket: focus === 'coaching',
    industryBenchmarks: grounding?.industryBenchmarks,
    teamMarketPositions: grounding?.teamMarketPositions,
  });

  const sharedRules = [
    'CRITICAL RULES:',
    '1. Answer ONLY from the context. Name specific rep_id, rep_name, tour_id, dollar amounts, and metric weights.',
    '2. NEVER tell the manager to "check another system" — the data is already here.',
    '3. Tie every action to plan economics: metric weight %, current attainment %, payout %, and monthly vs quarterly timing.',
    '4. Reference industry compensation benchmarks — flag reps below market TCC, inverted pay mix (40/60 vs 60/40), and combined at-risk vs market %.',
    '5. If attainment exceeds 125%, describe it as at/near the accelerator ceiling — do not treat high percentages literally as "room to grow".',
  ];

  if (focus === 'coaching') {
    return [
      `You are the HGV IGNITE Compensation Agent advising a ${roleTitle} on TEAM COACHING — not personal payout mechanics.`,
      'You have governed warehouse data below — direct reports, open tours, metric weights, attainment, at-risk flags, and team pay vs market.',
      '',
      ...sharedRules,
      '6. Focus on rep-level coaching: who to intervene with, which open tours to convert to FPS, who is below market AND below quota (CRITICAL).',
      '7. Recommend evening out pay mix toward market 60/40 for marketing reps where inverted.',
      '8. Format as a concise coaching brief (150–250 words):',
      '   - Open with one bold sentence on team health and market alignment (no section label)',
      '   - **Coaching priorities** (3 numbered): rep/tour_id, gap, intervention',
      '   - **Quick win**: fastest path to move team attainment or market parity',
      '',
      '=== LIVE MANAGER CONTEXT ===',
      grounded,
      '=== END CONTEXT ===',
      '',
      'Produce the coaching brief now.',
    ].join('\n');
  }

  return [
    `You are the HGV IGNITE Compensation Agent advising a ${roleTitle} on PERSONAL PAYOUT — how plan metrics translate to their comp check.`,
    'You have governed warehouse data below — plan metrics, payout curve, and industry compensation benchmarks.',
    '',
    ...sharedRules,
    '6. Focus on payout mechanics: blended payout %, accelerator gates, monthly vs quarterly timing for THIS role only.',
    '7. Reference role-scoped industry benchmarks — do not discuss unrelated personas (e.g. no director gaps on a frontline manager brief).',
    '8. Format as a concise executive brief (150–250 words):',
    '   - Open with one bold sentence on payout posture this period (no section label)',
    '   - **Priority actions** (3 numbered): metric, gap to payout tier, NSV/penetration impact on YOUR comp',
    '   - **Watch item**: metric most likely to drag blended payout',
    '',
    '=== LIVE MANAGER CONTEXT ===',
    grounded,
    '=== END CONTEXT ===',
    '',
    'Produce the executive brief now.',
  ].join('\n');
}

function contentFromMessageContent(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';
  return content
    .map((block) => {
      if (typeof block === 'string') return block;
      if (block && typeof block === 'object' && 'text' in block) return String((block as { text: string }).text);
      return '';
    })
    .join('\n')
    .trim();
}

/** Parse OpenAI / Databricks serving responses across endpoint variants. */
export function extractAssistantContent(data: unknown): string {
  if (data == null) return '';
  if (typeof data === 'string') return data.trim();
  if (typeof data !== 'object') return '';

  const obj = data as Record<string, unknown>;

  // Some wrappers nest the payload again under `data` (but not embeddings arrays).
  if (
    obj.data &&
    typeof obj.data === 'object' &&
    !Array.isArray(obj.data) &&
    !('choices' in obj)
  ) {
    const nested = extractAssistantContent(obj.data);
    if (nested) return nested;
  }

  const choices = obj.choices as Array<Record<string, unknown>> | undefined;
  if (choices?.length) {
    const choice = choices[0];
    const message = choice.message as Record<string, unknown> | undefined;
    const fromMessage = contentFromMessageContent(message?.content);
    if (fromMessage) return fromMessage;
    if (typeof choice.text === 'string' && choice.text.trim()) return choice.text.trim();
  }

  const predictions = obj.predictions;
  if (Array.isArray(predictions) && predictions.length > 0) {
    const first = predictions[0];
    if (typeof first === 'string' && first.trim()) return first.trim();
    const fromPrediction = extractAssistantContent(first);
    if (fromPrediction) return fromPrediction;
  }

  if (typeof obj.output === 'string' && obj.output.trim()) return obj.output.trim();
  if (typeof obj.result === 'string' && obj.result.trim()) return obj.result.trim();

  return '';
}

export function buildFallbackManagerInsight(
  roleTitle: string,
  actionItems: ActionItem[],
  metrics: MetricAttainmentRow[],
  teamRollup: ManagerWorkspacePayload['team_rollup'],
): string {
  const lowestMetric = [...metrics].sort((a, b) => a.attainment_pct - b.attainment_pct)[0];
  const headline = `${roleTitle} team is at **${teamRollup.team_attainment_pct}%** blended attainment with **${teamRollup.at_risk_count}** at-risk reps and **${teamRollup.report_count}** direct reports in scope.`;

  const actions =
    actionItems.length > 0
      ? actionItems
          .slice(0, 3)
          .map((item, i) => `${i + 1}. **${item.metric}** — ${item.recommendation} _(${item.evidence})_`)
          .join('\n')
      : '1. Review metric attainment table and prioritize the lowest-weighted metric below 100% attainment.\n2. Coach at-risk direct reports on open tours and conversion.\n3. Confirm monthly vs quarterly payout timing before launching a SPIFF.';

  const watch = lowestMetric
    ? `- **Watch:** ${lowestMetric.metric} (${lowestMetric.weight_pct}% weight) at ${lowestMetric.attainment_pct}% — ${lowestMetric.actual} vs ${lowestMetric.target}.`
    : '';

  return [headline, '', '**Priority actions:**', actions, watch].filter(Boolean).join('\n');
}
