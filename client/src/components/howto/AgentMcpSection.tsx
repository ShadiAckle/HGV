import { Plug, Server, Shield, Workflow } from 'lucide-react';
import { McpClientWiringSection } from '@/components/howto/McpClientWiringSection';

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4
      style={{
        fontSize: 13,
        fontWeight: 800,
        color: 'var(--foreground)',
        borderBottom: '1px solid var(--border)',
        paddingBottom: '0.5rem',
        marginTop: '0.25rem',
      }}
    >
      {children}
    </h4>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre
      style={{
        fontSize: 10,
        lineHeight: 1.55,
        padding: '0.875rem 1rem',
        borderRadius: 8,
        background: 'var(--muted)',
        border: '1px solid var(--border)',
        overflowX: 'auto',
        color: 'var(--foreground)',
        margin: 0,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      }}
    >
      {children}
    </pre>
  );
}

function FlowCard({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '3px solid var(--primary)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <ol style={{ margin: 0, paddingLeft: '1.125rem', fontSize: 11, color: 'var(--foreground-muted)', lineHeight: 1.65 }}>
        {steps.map((s) => (
          <li key={s} style={{ marginBottom: 4 }}>
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function AgentMcpSection() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <p style={{ fontSize: 13, lineHeight: 1.75, color: 'var(--foreground-muted)', margin: 0 }}>
        External orchestrators — LangGraph agents, enterprise copilots, workflow bots, or custom SDK runners — can call the
        HGV Compensation Hub through a built-in <strong style={{ color: 'var(--foreground)' }}>Model Context Protocol (MCP)</strong>{' '}
        server. The MCP layer exposes warehouse-grounded tools and the same Claude-backed comp agent used inside the web app.
        External orchestrators connect over HTTP using the ResponsesAgent API or MCP tools.
      </p>

      <div className="card" style={{ padding: '1.25rem 1.5rem', background: 'linear-gradient(135deg, #0a2540 0%, #12365a 100%)', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Workflow size={16} color="#14b8a6" />
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Agent Integration Flow
          </span>
        </div>
        <CodeBlock>{`Databricks Agents UI / Playground / external orchestrator
    │
    ├─► POST /responses             ResponsesAgent API (same invokeCompAgent as the web UI)
    ├─► GET  /agent/info            Agent catalog registration (use_case: agent)
    ├─► GET  /health                Agent liveness probe
    │
    ├─► POST /mcp                   MCP tools (Streamable HTTP)
    ├─► POST /api/agent/invoke      REST shortcut (single Q&A turn)
    └─► GET  /api/agent/info        MCP tool catalog + transport metadata`}</CodeBlock>
      </div>

      <SectionHeading>What is MCP here?</SectionHeading>
      <p style={{ fontSize: 11.5, color: 'var(--foreground-muted)', lineHeight: 1.65, margin: 0 }}>
        MCP is an open protocol for giving LLM agents structured tools, resources, and prompts. Instead of hard-coding HTTP
        calls in every orchestrator, the client discovers tools from the server, validates arguments with JSON Schema, and
        receives normalized text responses. The Compensation Hub runs MCP <strong>inside the Databricks App</strong> on the
        same process as the REST API — no separate MCP container to deploy.
      </p>

      <SectionHeading>Register in Databricks (Agents + MCP)</SectionHeading>
      <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '3px solid var(--warning)' }}>
        <div style={{ fontSize: 11.5, color: 'var(--foreground-muted)', lineHeight: 1.65 }}>
          <strong>Important:</strong> MCP and Agents use different registration rules.{' '}
          <code>mcp-*</code> apps with <code>POST /mcp</code> auto-appear under <strong>AI Gateway → MCPs</strong>.{' '}
          <code>agent-*</code> apps do <em>not</em> auto-appear under <strong>AI Gateway → Agents</strong> from bundle deploy alone —
          that tab lists agents created via the <strong>Create</strong> button (Supervisor, Knowledge Assistant, or Custom Agent template),
          or Model Serving agents from <code>agents.deploy()</code>. Our app is still a valid ResponsesAgent at{' '}
          <code>POST /responses</code> and is callable as <code>apps/agent-hgv-comp-hub</code> in Playground / Supervisor API.
        </div>
      </div>
      <FlowCard
        title="Custom Agent (Agents catalog)"
        steps={[
          'Deploy bundle — app name agent-hgv-comp-hub, GET /health → { status: "healthy" }, POST /responses live.',
          'Do not expose POST /mcp on the agent app (use mcp-hgv-comp-hub for the MCPs tab).',
          'To populate AI Gateway → Agents: click Create on that page, or Compute → Apps → Create → Agents → Custom Agent template, then bind this bundle.',
          'After UI creation: databricks bundle deployment bind app agent-hgv-comp-hub --auto-approve && npm run deploy:agent',
          'Playground / Supervisor: model apps/agent-hgv-comp-hub, or app tool pointing at agent-hgv-comp-hub.',
        ]}
      />
      <FlowCard
        title="Custom MCP (MCPs catalog — optional second app)"
        steps={[
          'Bundle also deploys mcp-hgv-comp-hub when you need the mcp- prefix in AI Gateway → MCPs.',
          'The agent app already exposes POST /mcp on its own URL if you prefer a single deployment.',
          'MCP endpoint must be /mcp — Playground connects to https://<app-url>/mcp.',
          'AI Playground: Tools → MCP Servers → Custom MCP Server → mcp-hgv-comp-hub or agent-hgv-comp-hub.',
        ]}
      />

      <SectionHeading>Connection endpoints</SectionHeading>
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
        <table className="data-table data-table-compact" style={{ fontSize: 11 }}>
          <thead>
            <tr>
              <th>Endpoint</th>
              <th>Method</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>/responses</code></td>
              <td>POST</td>
              <td>ResponsesAgent invoke — Databricks Agents catalog contract</td>
            </tr>
            <tr>
              <td><code>/agent/info</code></td>
              <td>GET</td>
              <td>Agent registration metadata (use_case: agent)</td>
            </tr>
            <tr>
              <td><code>/health</code></td>
              <td>GET</td>
              <td>Agent health probe ({'{ status: "healthy" }'})</td>
            </tr>
            <tr>
              <td><code>/mcp</code></td>
              <td>POST</td>
              <td>Canonical Databricks MCP transport (AI Playground, Agent Bricks)</td>
            </tr>
            <tr>
              <td><code>/api/mcp</code></td>
              <td>POST</td>
              <td>Alias for external HTTP clients</td>
            </tr>
            <tr>
              <td><code>/api/agent/info</code></td>
              <td>GET</td>
              <td>Tool catalog, auth headers, transport metadata</td>
            </tr>
            <tr>
              <td><code>/api/agent/health</code></td>
              <td>GET</td>
              <td>Liveness check</td>
            </tr>
            <tr>
              <td><code>/api/agent/invoke</code></td>
              <td>POST</td>
              <td>Direct REST invoke (one question, JSON answer)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <SectionHeading>Authentication</SectionHeading>
      <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Shield size={16} color="var(--warning)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 11.5, color: 'var(--foreground-muted)', lineHeight: 1.65 }}>
          <strong>Databricks agents (Playground / Agent Bricks):</strong> workspace OAuth via Databricks Apps — no custom API
          key. Users need <code>CAN_USE</code> on <code>mcp-hgv-comp-hub</code>.<br /><br />
          <strong>External orchestrators:</strong> optional app secret <code>AGENT_API_KEY</code> with header{' '}
          <code>X-Agent-Api-Key</code> or <code>Authorization: Bearer</code>.
        </div>
      </div>

      <SectionHeading>Registered MCP tools</SectionHeading>
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
        <table className="data-table data-table-compact" style={{ fontSize: 11 }}>
          <thead>
            <tr>
              <th>Tool</th>
              <th>Use when</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>ask_comp_agent</code></td>
              <td>Natural-language Q&A grounded in rep / manager / marketing warehouse context</td>
            </tr>
            <tr>
              <td><code>get_marketing_workspace</code></td>
              <td>Structured KPIs, tours, money map, chargebacks for a marketing rep</td>
            </tr>
            <tr>
              <td><code>get_tour_context</code></td>
              <td>Guest 360 + comp impact for a tour ID (Intervene drawer data)</td>
            </tr>
            <tr>
              <td><code>get_comp_metadata</code></td>
              <td>Reps, teams, periods, scenarios roster</td>
            </tr>
            <tr>
              <td><code>search_comp_entities</code></td>
              <td>Entity search for @mention-style references</td>
            </tr>
            <tr>
              <td><code>hub_health</code></td>
              <td>Connectivity probe from the orchestrator</td>
            </tr>
          </tbody>
        </table>
      </div>

      <SectionHeading>Copy-paste client wiring (Python, C#, TypeScript, Java, Go, PowerShell)</SectionHeading>
      <McpClientWiringSection />

      <SectionHeading>Implementation location</SectionHeading>
      <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Server size={16} color="var(--primary)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 11.5, color: 'var(--foreground-muted)', lineHeight: 1.65 }}>
          MCP server code lives in <code>server/mcp/</code> and ships with the Databricks App bundle. Tool handlers call the
          same warehouse builders and <code>invokeCompAgent</code> path as the UI — no duplicate business logic over HTTP loops.
        </div>
      </div>

      <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Plug size={16} color="var(--success)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 11.5, color: 'var(--foreground-muted)', lineHeight: 1.65 }}>
          MCP app URL: <code>https://mcp-hgv-comp-hub-&lt;workspace-id&gt;.aws.databricksapps.com/mcp</code>.
          Agent + UI app URL: <code>https://agent-hgv-comp-hub-&lt;workspace-id&gt;.aws.databricksapps.com</code>.
          Run <code>GET /api/agent/info</code> on either app to verify tools.
        </div>
      </div>
    </div>
  );
}
