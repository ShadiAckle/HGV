import type { Application, Request, Response, NextFunction } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createCompMcpServer } from './createCompMcpServer.js';
import { MCP_TOOL_CATALOG, type CompMcpDeps } from './types.js';

async function handleMcpRequest(req: Request, res: Response, deps: CompMcpDeps): Promise<void> {
  const server = createCompMcpServer(deps);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
  } catch (err) {
    console.error('[MCP] Request failed:', err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal MCP server error' },
        id: null,
      });
    }
  }
}

function mountMcpRoute(
  app: Application,
  path: string,
  deps: CompMcpDeps,
  requireMcpAuth: (req: Request, res: Response, next: NextFunction) => void,
): void {
  app.post(path, requireMcpAuth, (req, res) => {
    void handleMcpRequest(req, res, deps);
  });
}

export function mountMcpHttp(
  app: Application,
  deps: CompMcpDeps,
  requireAgentAuth: (req: Request, res: Response, next: NextFunction) => void,
  requireMcpAuth: (req: Request, res: Response, next: NextFunction) => void,
): void {
  // Databricks convention — AI Playground & Agent Bricks discover apps named mcp-* at /mcp
  mountMcpRoute(app, '/mcp', deps, requireMcpAuth);
  // Backward-compatible alias for external HTTP clients
  mountMcpRoute(app, '/api/mcp', deps, requireMcpAuth);

  app.get('/api/agent/info', requireAgentAuth, (_req, res) => {
    res.json({
      agent: 'hgv-compensation-hub',
      version: '1.0.0',
      protocol: 'mcp',
      transport: 'streamable-http',
      mcp_endpoint: '/mcp',
      mcp_endpoint_alias: '/api/mcp',
      databricks: {
        mcp_app_name: 'mcp-hgv-comp-hub',
        ai_gateway_path: 'Workspace → AI Gateway → MCPs',
        ai_playground_path: 'Tools → Add tool → MCP Servers → Custom MCP Server',
        playground_app_name_prefix: 'mcp-',
        supervisor_agent: 'Agent Bricks → Supervisor Agent → add MCP server',
      },
      rest_endpoints: {
        health: '/api/agent/health',
        invoke: '/api/agent/invoke',
      },
      auth: {
        databricks_oauth: 'AI Playground / Agent Bricks (workspace identity headers)',
        external_header: 'X-Agent-Api-Key',
        external_bearer: 'Authorization: Bearer <AGENT_API_KEY>',
        env_var: 'AGENT_API_KEY',
      },
      tools: MCP_TOOL_CATALOG,
    });
  });
}
