import { CURRENT_PERIOD_ID } from '../shared/compPeriods.js';
import { invokeServingModelDetailed } from './llmInvoke.js';
import { buildMarketingRepWorkspace } from './marketingRepWorkspace.js';
import { buildManagerWorkspace, formatCompactManagerInsightContext } from './managerWorkspace.js';
import { buildRepInsightPayload, extractAssistantContent, formatCompactRepInsightContext } from './repInsights.js';

type RunSql = (sql: string) => Promise<Record<string, unknown>[]>;

type AppKitServing = {
  serving: () => { invoke: (body: Record<string, unknown>) => Promise<unknown> };
};

function planRowsForPersona(personaId: string | null) {
  if (personaId === 'marketing_manager') {
    return [
      { attribute: 'Total Comp Range (TCC)', hgvPlan: 'Average ~$130k | Top $255k–$278k' },
      { attribute: 'Metrics / Weights', hgvPlan: 'Contribution 15–20%, LM NSV 15–20%, LM Tours 15–35%, Club Pen 20–70%' },
    ];
  }
  if (personaId === 'marketing_director') {
    return [
      { attribute: 'Total Comp Range (TCC)', hgvPlan: 'Average ~$205k–$250k | Top $489k–$527k' },
      { attribute: 'Metrics / Weights', hgvPlan: 'Total NSV 40%, New Owner NSV 20%, Regional NSV 10%, DC Contribution 30%' },
    ];
  }
  return [
    { attribute: 'Total Comp Range (TCC)', hgvPlan: 'Average ~$130k–$180k | Top $250k–$300k' },
    { attribute: 'Metrics / Weights', hgvPlan: 'Team NSV 35%, Direct Report Attainment 25%, FFS Mix 15%, VPG 10%, Override/TO 15%' },
  ];
}

export interface AgentInvokeRequest {
  question: string;
  rep_id?: string;
  period_id?: string;
  channel?: 'marketing' | 'sales' | 'manager';
  plain_english?: boolean;
  conversation?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface AgentInvokeResponse {
  answer: string;
  rep_id: string;
  period_id: string;
  channel: string;
  serving_endpoint?: string;
}

const AGENT_SYSTEM_RULES = [
  'You are the HGV IGNITE Compensation Agent.',
  'Answer from the LIVE DATA CONTEXT only. State exact dollar amounts, dates, and IDs.',
  'Keep answers concise: 2–5 bullets. Lead with the direct answer.',
  'If a record is missing from context, say it was not found in the current dataset.',
].join('\n');

function buildAgentPrompt(
  question: string,
  dataContext: string,
  conversation?: AgentInvokeRequest['conversation'],
): string {
  const blocks = [
    AGENT_SYSTEM_RULES,
    '',
    '=== LIVE DATA CONTEXT ===',
    dataContext,
    '=== END CONTEXT ===',
  ];

  if (conversation?.length) {
    const transcript = conversation
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');
    blocks.push('', '--- Prior conversation ---', transcript);
  }

  blocks.push('', 'Question to answer:', question);
  return blocks.join('\n');
}

async function resolveDataContext(
  runSql: RunSql,
  repId: string,
  periodId: string,
  channel: AgentInvokeRequest['channel'],
): Promise<{ context: string; channel: string }> {
  if (channel === 'manager' || repId.includes('MGR')) {
    const payload = await buildManagerWorkspace(runSql, repId, periodId);
    const planRows = planRowsForPersona(payload.persona_id);
    return {
      context: formatCompactManagerInsightContext(payload, planRows),
      channel: 'manager',
    };
  }

  if (channel === 'marketing' || repId.startsWith('MKT-') || repId === 'PERSONA-MKT-REP') {
    const payload = await buildMarketingRepWorkspace(runSql, repId, periodId);
    return { context: payload.insights_context || payload.grounding_context, channel: 'marketing' };
  }

  const payload = await buildRepInsightPayload(runSql, repId, periodId);
  return { context: formatCompactRepInsightContext(payload), channel: 'sales' };
}

export async function invokeCompAgent(
  appkit: AppKitServing,
  runSql: RunSql,
  body: AgentInvokeRequest,
): Promise<AgentInvokeResponse> {
  const question = body.question?.trim();
  if (!question) {
    throw new Error('question is required');
  }

  const repId = body.rep_id?.trim() || 'PERSONA-MKT-REP';
  const periodId = body.period_id?.trim() || CURRENT_PERIOD_ID;
  const { context, channel } = await resolveDataContext(runSql, repId, periodId, body.channel);

  const prompt = buildAgentPrompt(question, context, body.conversation);
  const requestBody = {
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1200,
    temperature: 0.5,
    top_p: 0.92,
  };

  const { payload, endpoint } = await invokeServingModelDetailed(appkit, requestBody);
  const answer = extractAssistantContent(payload);
  if (!answer) {
    throw new Error('Model returned empty response');
  }

  return {
    answer,
    rep_id: repId,
    period_id: periodId,
    channel,
    serving_endpoint: endpoint,
  };
}
