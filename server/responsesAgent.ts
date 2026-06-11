import { randomUUID } from 'node:crypto';
import type { Application, Request, Response } from 'express';
import type { invokeCompAgent, AgentInvokeRequest } from './agentGateway.js';

type RunSql = (sql: string) => Promise<Record<string, unknown>[]>;

type AppKitServing = {
  serving: () => { invoke: (body: Record<string, unknown>) => Promise<unknown> };
};

type ResponsesInputItem = {
  role?: string;
  content?: string | Array<{ type?: string; text?: string }>;
};

export interface ResponsesAgentDeps {
  runSql: RunSql;
  appkit: AppKitServing;
  invokeAgent: typeof invokeCompAgent;
  prepare?: () => Promise<void>;
}

const AGENT_APP_NAME = process.env.DATABRICKS_APP_NAME?.trim() || 'agent-hgv-comp-hub';

function extractUserText(input: ResponsesInputItem[] | undefined): string {
  if (!input?.length) return '';
  for (let i = input.length - 1; i >= 0; i -= 1) {
    const item = input[i];
    if (item.role !== 'user') continue;
    if (typeof item.content === 'string') return item.content.trim();
    if (Array.isArray(item.content)) {
      const text = item.content
        .map((part) => (part?.type === 'input_text' || part?.type === 'text' ? part.text : ''))
        .join('')
        .trim();
      if (text) return text;
    }
  }
  return '';
}

function buildConversation(input: ResponsesInputItem[] | undefined) {
  if (!input?.length) return undefined;
  const turns = input
    .filter((item) => item.role === 'user' || item.role === 'assistant')
    .map((item) => {
      const content = typeof item.content === 'string'
        ? item.content
        : Array.isArray(item.content)
          ? item.content.map((p) => p.text ?? '').join('')
          : '';
      return {
        role: item.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: content.trim(),
      };
    })
    .filter((t) => t.content);
  if (turns.length <= 1) return undefined;
  return turns.slice(0, -1);
}

function parseAgentInvokeRequest(body: Record<string, unknown>): AgentInvokeRequest {
  const input = Array.isArray(body.input) ? body.input as ResponsesInputItem[] : [];
  const custom = (body.custom_inputs && typeof body.custom_inputs === 'object')
    ? body.custom_inputs as Record<string, unknown>
    : {};

  const question = extractUserText(input);
  if (!question) {
    throw new Error('input must include a user message');
  }

  return {
    question,
    rep_id: typeof custom.rep_id === 'string' ? custom.rep_id : undefined,
    period_id: typeof custom.period_id === 'string' ? custom.period_id : undefined,
    channel: custom.channel === 'marketing' || custom.channel === 'sales' || custom.channel === 'manager'
      ? custom.channel
      : undefined,
    plain_english: custom.plain_english === true,
    conversation: buildConversation(input),
  };
}

function createTextOutputItem(text: string, id: string) {
  return {
    type: 'message',
    id,
    status: 'completed',
    role: 'assistant',
    content: [{ type: 'output_text', text }],
  };
}

function buildCompletedResponse(text: string, itemId: string) {
  return { output: [createTextOutputItem(text, itemId)] };
}

function chunkText(text: string, size = 48): string[] {
  if (!text) return [''];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

async function handleInvoke(
  deps: ResponsesAgentDeps,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (deps.prepare) await deps.prepare();
  const request = parseAgentInvokeRequest(body);
  const result = await deps.invokeAgent(deps.appkit, deps.runSql, request);
  const itemId = `msg_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  return buildCompletedResponse(result.answer, itemId);
}

async function handleStream(
  res: Response,
  deps: ResponsesAgentDeps,
  body: Record<string, unknown>,
): Promise<void> {
  if (deps.prepare) await deps.prepare();
  const request = parseAgentInvokeRequest(body);
  const result = await deps.invokeAgent(deps.appkit, deps.runSql, request);
  const itemId = `msg_${randomUUID().replace(/-/g, '').slice(0, 12)}`;

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  for (const delta of chunkText(result.answer)) {
    const event = {
      type: 'response.output_text.delta',
      item_id: itemId,
      output_index: 0,
      content_index: 0,
      delta,
    };
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  const doneEvent = {
    type: 'response.output_item.done',
    item: createTextOutputItem(result.answer, itemId),
  };
  res.write(`data: ${JSON.stringify(doneEvent)}\n\n`);
  res.write('data: [DONE]\n\n');
  res.end();
}

async function handleResponsesRequest(
  req: Request,
  res: Response,
  deps: ResponsesAgentDeps,
): Promise<void> {
  const body = (req.body && typeof req.body === 'object') ? req.body as Record<string, unknown> : {};
  const stream = body.stream === true;

  try {
    if (stream) {
      await handleStream(res, deps, body);
      return;
    }
    const payload = await handleInvoke(deps, body);
    res.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Agent invocation failed';
    const status = message.includes('required') || message.includes('must include') ? 400 : 500;
    if (!res.headersSent) {
      res.status(status).json({ error: message });
    }
  }
}

type ExpressRouteLayer = {
  route?: {
    path?: string;
    stack?: Array<{ handle: (req: Request, res: Response) => void }>;
  };
};

/** AppKit registers GET /health → { status: "ok" } before extensions; Agents catalog requires "healthy". */
export function patchAppKitHealthForAgentCatalog(app: Application): void {
  const stack = (app as Application & { _router?: { stack: ExpressRouteLayer[] } })._router?.stack;
  if (!stack) return;

  for (const layer of stack) {
    if (layer.route?.path !== '/health') continue;
    const routeHandle = layer.route.stack?.[0];
    if (!routeHandle) continue;
    routeHandle.handle = (_req: Request, res: Response) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: AGENT_APP_NAME,
      });
    };
    return;
  }
}

export function mountResponsesAgent(app: Application, deps: ResponsesAgentDeps): void {
  const mcpAppName = process.env.MCP_COMPANION_APP_NAME?.trim() || 'mcp-hgv-comp-hub';

  app.get('/agent/info', (_req, res) => {
    res.json({
      name: AGENT_APP_NAME,
      use_case: 'agent',
      agent_api: 'responses',
      description: 'HGV IGNITE Compensation Agent — warehouse-grounded comp intelligence',
      endpoints: {
        responses: '/responses',
        invocations: '/invocations',
        health: '/health',
      },
      mcp_tools_app: mcpAppName,
    });
  });

  const handler = (req: Request, res: Response) => {
    void handleResponsesRequest(req, res, deps);
  };

  app.post('/responses', handler);
  app.post('/invocations', handler);

  patchAppKitHealthForAgentCatalog(app);
}
