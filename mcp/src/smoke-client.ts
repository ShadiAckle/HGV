#!/usr/bin/env node
/**
 * Smoke test for external agent integration against a running Compensation Hub.
 * Usage: HGV_COMP_BASE_URL=http://localhost:8000 AGENT_API_KEY=... npm run smoke --prefix mcp
 */
const baseUrl = (process.env.HGV_COMP_BASE_URL ?? 'http://localhost:8000').replace(/\/$/, '');
const apiKey = process.env.HGV_COMP_API_KEY ?? process.env.AGENT_API_KEY ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['X-Agent-Api-Key'] = apiKey;

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${path} → HTTP ${res.status}: ${JSON.stringify(body)}`);
  }
  return body as T;
}

async function main() {
  console.log(`[smoke] base URL: ${baseUrl}`);

  const health = await request<{ status: string; mcp_endpoint?: string }>('/api/agent/health');
  console.log('[smoke] health:', health);

  const info = await request<{ tools: Array<{ name: string }> }>('/api/agent/info');
  console.log('[smoke] tools:', info.tools.map((t) => t.name).join(', '));

  const invoke = await request<{ answer: string }>('/api/agent/invoke', {
    method: 'POST',
    body: JSON.stringify({
      question: 'What rep ID is PERSONA-MKT-REP and what channel should I use?',
      rep_id: 'PERSONA-MKT-REP',
      period_id: '2026-Q2',
      channel: 'marketing',
    }),
  });
  console.log('[smoke] invoke answer (first 200 chars):', invoke.answer.slice(0, 200));

  console.log('[smoke] OK');
}

main().catch((err) => {
  console.error('[smoke] FAILED:', err);
  process.exit(1);
});
