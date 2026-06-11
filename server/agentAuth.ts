import type { Request, Response, NextFunction } from 'express';

const AGENT_API_KEY = process.env.AGENT_API_KEY?.trim();

/** Databricks Apps / AI Playground forward workspace identity on proxied requests. */
export function hasDatabricksUserIdentity(req: Request): boolean {
  const h = req.headers;
  return Boolean(
    h['x-forwarded-user']
    || h['x-user-email']
    || h['x-user-username']
    || h['x-databricks-user-id']
    || h['x-databricks-org-id'],
  );
}

function hasValidAgentApiKey(req: Request): boolean {
  if (!AGENT_API_KEY) return false;
  const headerKey = req.headers['x-agent-api-key'];
  const bearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : undefined;
  const provided = (typeof headerKey === 'string' ? headerKey : bearer)?.trim();
  return Boolean(provided && provided === AGENT_API_KEY);
}

/**
 * Machine-to-machine auth for external agents calling /api/agent/*.
 * Also accepts Databricks workspace identity (AI Playground, Agent Bricks OBO).
 */
export function requireAgentApiKey(req: Request, res: Response, next: NextFunction): void {
  if (hasDatabricksUserIdentity(req) || hasValidAgentApiKey(req) || !AGENT_API_KEY) {
    next();
    return;
  }

  res.status(401).json({
    error: 'Unauthorized',
    hint: 'Set X-Agent-Api-Key, Authorization: Bearer <AGENT_API_KEY>, or call via Databricks Apps OAuth',
  });
}

/**
 * MCP routes: Databricks AI Playground connects with workspace OAuth (no custom API key).
 * External orchestrators may still pass X-Agent-Api-Key when AGENT_API_KEY is configured.
 */
export function requireMcpAccess(req: Request, res: Response, next: NextFunction): void {
  if (hasDatabricksUserIdentity(req) || hasValidAgentApiKey(req) || !AGENT_API_KEY) {
    next();
    return;
  }

  res.status(401).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Unauthorized MCP request' },
    id: null,
  });
}
