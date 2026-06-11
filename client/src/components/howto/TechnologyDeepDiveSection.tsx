import { Database, Layers, Server, Sparkles, Shield, GitBranch } from 'lucide-react';

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

function TechTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
      <table className="data-table data-table-compact" style={{ fontSize: 11 }}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} style={{ padding: '0.625rem 0.875rem' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '0.625rem 0.875rem', verticalAlign: 'top' }}>
                  {cell.includes('`') ? (
                    <span dangerouslySetInnerHTML={{ __html: cell.replace(/`([^`]+)`/g, '<code style="background:var(--muted);padding:1px 5px;border-radius:3px;font-size:10px">$1</code>') }} />
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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

export function TechnologyDeepDiveSection() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <p style={{ fontSize: 13, lineHeight: 1.75, color: 'var(--foreground-muted)', margin: 0 }}>
        End-to-end architecture reference for engineering leadership. This documents the exact frameworks, Databricks
        services, data contracts, and AI grounding patterns used to build the HGV IGNITE Compensation Hub — not marketing
        copy, but what is running in production today.
      </p>

      {/* Architecture */}
      <div className="card" style={{ padding: '1.25rem 1.5rem', background: 'linear-gradient(135deg, #0a2540 0%, #12365a 100%)', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Layers size={16} color="#14b8a6" />
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            End-to-End Architecture
          </span>
        </div>
        <CodeBlock>{`Browser (React 19 SPA)
    │
    ├─► AppKit Analytics  ──► /api/analytics/query/{name}  ──► config/queries/*.sql
    │                              │
    │                              └─► SQL Warehouse (0df692712c9a2f9a)
    │                                      └─► Unity Catalog: workspace.hgv_comp.*
    │
    ├─► Custom REST API   ──► /api/comp/*  (Express via @databricks/appkit)
    │                              │
    │                              ├─► runSql() → same warehouse
    │                              └─► invokeServingModelDetailed() → Model Serving
    │
    ├─► Agent API         ──► POST /responses  (ResponsesAgent — invokeCompAgent)
    │
    ├─► External agents   ──► POST /mcp on mcp-hgv-comp-hub  (MCP Streamable HTTP)
    │                              └─► MCP tools → same warehouse + invokeCompAgent()
    │
    └─► Databricks Apps SSO headers (x-user-email / x-forwarded-user)
            └─► /api/comp/user-profile → persona + manager gates

Deployed as: agent-hgv-comp-hub (UI + agent) + mcp-hgv-comp-hub (MCP)  |  node dist/server.js  |  DABs bundle deploy`}</CodeBlock>
      </div>

      <SectionHeading>Application Stack</SectionHeading>
      <TechTable
        headers={['Layer', 'Technology', 'Notes']}
        rows={[
          ['Frontend', 'React 19, React Router 7, TypeScript 5.9', 'SPA in `client/src/` — no SSR'],
          ['UI system', '@databricks/appkit-ui 0.24', 'Badge, Card, Skeleton, `useAnalyticsQuery`'],
          ['Styling', 'Tailwind CSS 4 + custom design tokens', 'HGV corporate light theme in `index.css`'],
          ['Build (client)', 'Vite (rolldown-vite 7) + tsc project refs', 'Output: `client/dist/`'],
          ['Backend', '@databricks/appkit 0.24 + Express', 'Entry: `server/server.ts` → `dist/server.js` via tsdown'],
          ['Shared logic', '`shared/` TypeScript modules', 'Imported by client + server — projection, grounding, plain language'],
          ['Deploy', 'Databricks Asset Bundles (DABs)', '`databricks bundle deploy` + `bundle run app`'],
          ['Runtime', 'Databricks Apps (Node.js, MEDIUM compute)', 'App SP scopes: `sql`, `model-serving`'],
        ]}
      />

      <SectionHeading>LLM & Data Grounding</SectionHeading>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '3px solid var(--primary)' }}>
          <p style={{ fontSize: 11.5, color: 'var(--foreground-muted)', lineHeight: 1.65, margin: 0 }}>
            All AI inference runs through <strong>Databricks Model Serving</strong> via the AppKit <code>serving()</code> plugin
            (primary endpoint: <code>databricks-claude-sonnet-4-6</code>). In-app Copilot and insights use the model for{' '}
            <strong>interpretation and explanation</strong> over pre-assembled warehouse context; MCP tools expose the same
            grounded data and agent to external orchestrators.
          </p>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem', borderLeft: '3px solid var(--success)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--foreground)' }}>
            Agent &amp; MCP surfaces (same core)
          </div>
          <p style={{ fontSize: 11, color: 'var(--foreground-muted)', lineHeight: 1.65, margin: 0 }}>
            The web UI, <code>POST /responses</code> (ResponsesAgent), and <code>mcp-hgv-comp-hub</code> MCP tools all call{' '}
            <code>invokeCompAgent()</code> — one warehouse-grounded comp agent. Playground and Supervisor flows can attach the
            MCP server as tools; external orchestrators use MCP Streamable HTTP or the REST invoke shortcut.
          </p>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--foreground)' }}>
            In-app pattern: retrieve → compose → generate
          </div>
          <p style={{ fontSize: 11, color: 'var(--foreground-muted)', lineHeight: 1.65, margin: '0 0 0.75rem' }}>
            The Copilot and insight panels use a deliberate <strong>context assembly pipeline</strong> before each model call.
            Each layer is code we control; the LLM receives a fully prepared brief grounded in Unity Catalog.
          </p>
          <ol style={{ margin: 0, paddingLeft: '1.125rem', fontSize: 11, color: 'var(--foreground-muted)', lineHeight: 1.65, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li><strong>Page load (UI)</strong> — AppKit analytics queries and REST workspace APIs load KPIs, ledgers, and charts from governed SQL (<code>config/queries/*.sql</code>, <code>/api/comp/*/workspace</code>).</li>
            <li><strong>Context string (client)</strong> — Each surface serializes live payloads into <code>dataContext</code> / <code>insights_context</code> passed to Copilot and insight panels.</li>
            <li><strong>Enrichment (server)</strong> — <code>appendInsightGrounding()</code> adds plan assessment, industry benchmarks, team market positions, and Slide 16 standards when warehouse rows exist.</li>
            <li><strong>Entity resolution (@ mentions)</strong> — User-typed <code>@rep:</code>, <code>@team:</code>, <code>@scenario:</code>, <code>@deal:</code> tokens trigger <code>/api/comp/copilot/mentions-lookup</code>: server runs fixed SQL and injects JSON into the prompt — the same outcome as a tool call, but deterministic and schema-bound.</li>
            <li><strong>Prompt contract (shared)</strong> — CRITICAL RULES, persona-specific insight templates, Simple View block, and <code>generation_pass</code> variation are appended in TypeScript before invoke.</li>
            <li><strong>Single invoke</strong> — <code>invokeServingModelDetailed()</code> sends one request to Model Serving; response is sanitized and brand-filtered before display.</li>
          </ol>
        </div>

        <TechTable
          headers={['Requirement', 'How we satisfy it']}
          rows={[
            ['Answer from live comp data', 'Warehouse-backed UI + workspace APIs build context; Copilot rules forbid deflecting to external systems'],
            ['Persona-aware pay story', 'User profile + channel routing; separate insight prompts in `repInsights.ts` / `managerInsights.ts`'],
            ['Drill into a specific rep, deal, or scenario', '@-mention lookup runs governed SQL server-side; results injected as SUPPLEMENTARY MENTION LOOKUP DATA'],
            ['Industry / market comparison', '`industry_comp_benchmark` + `fact_rep_market_position` via `benchmarkGrounding.ts` and `appendInsightGrounding()`'],
            ['Plan design vs market', '`plan_assessment_*` tables + `fetchPlanAssessment()`; fallback catalog if warehouse empty'],
            ['What-if scenario explanation', 'Scenario levers persisted in `scenario_run`; projection math in shared TypeScript, not LLM arithmetic'],
            ['Manager coaching & interventions', 'Interventions in `fact_manager_intervention`; team leaderboard SQL joins active levers into context'],
            ['Governed metrics vocabulary', '`semantic_definitions` table + admin CRUD; same definitions referenced in analytics and docs'],
            ['Simple language for frontline reps', 'Simple View toggle + `PLAIN_ENGLISH_LLM_BLOCK` appended to prompts; labels via `plainLanguage.ts` lexicon'],
            ['Safe, on-brand copy', '`sanitizeInsightText.ts` + `hgvRepBrandFraming.ts` post-process rep-facing insights'],
            ['Traceable AI output', 'Response headers `X-Serving-Endpoint`, `X-Insight-Source`; meta `generation_pass` + `generated_at` on insight routes'],
          ]}
        />
      </div>

      <SectionHeading>Databricks Platform Bindings</SectionHeading>
      <TechTable
        headers={['Resource', 'Identifier / Name', 'Purpose']}
        rows={[
          ['Workspace', '`dbc-60a40685-ea2b.cloud.databricks.com`', 'Premium workspace (HGV)'],
          ['Databricks App (UI + agent)', '`agent-hgv-comp-hub`', 'React UI + POST /responses ResponsesAgent API'],
          ['Databricks App (MCP)', '`mcp-hgv-comp-hub`', 'MCP tools for Playground, Supervisor, external orchestrators'],
          ['App service principal', '`d8d67f27-1896-4549-9351-e7b53a9df800`', 'Runs SQL + model invoke (not user OBO)'],
          ['SQL Warehouse', '`0df692712c9a2f9a`', 'All analytics queries + server `runSql()`'],
          ['Unity Catalog', '`workspace.hgv_comp`', 'Governed comp star schema + semantic layer'],
          ['Primary LLM endpoint', '`databricks-claude-sonnet-4-6`', 'Anthropic Claude Sonnet 4.6 via Model Serving'],
          ['Fallback LLM (dev only)', '`databricks-meta-llama-3-3-70b-instruct`', 'Disabled in prod (`LLM_ALLOW_FALLBACK=false`)'],
        ]}
      />

      <SectionHeading>Data Layer — Unity Catalog</SectionHeading>
      <p style={{ fontSize: 11.5, color: 'var(--foreground-muted)', lineHeight: 1.6, margin: 0 }}>
        Every live KPI, chart, and AI insight is grounded in warehouse tables. There is no parallel mock layer in production paths.
      </p>
      <TechTable
        headers={['Category', 'Tables']}
        rows={[
          ['Dimensions', '`dim_rep`, `dim_team`, `dim_period`, `dim_plan_version`, `dim_product_line`, `dim_finance_period`'],
          ['Rep comp facts', '`fact_quota_attainment`, `fact_payout`, `fact_deal_credit`, `fact_rep_product_mix`'],
          ['Manager / team', '`fact_team_snapshot`, `fact_manager_intervention`, `fact_rep_market_position`'],
          ['Marketing channel', '`fact_marketing_rep_period`, `fact_marketing_tour_payout`, `fact_tour_quality`, `fact_marketing_chargeback`'],
          ['Scenario modeling', '`scenario_run`, `scenario_result`, `scenario_payout_series`, `industry_comp_benchmark`'],
          ['Admin / finance', '`fact_comp_admin_log`, `fact_chargeback`, `fact_plan_eligibility`, `plan_assessment_*`'],
          ['Semantic layer', '`semantic_definitions`', 'CRUD via `/api/admin/semantic-definitions`'],
        ]}
      />

      <SectionHeading>Governed SQL Queries (AppKit Analytics)</SectionHeading>
      <p style={{ fontSize: 11.5, color: 'var(--foreground-muted)', lineHeight: 1.6, margin: 0 }}>
        SQL files in `config/queries/` auto-generate typed endpoints and TypeScript contracts (`npm run typegen` → `shared/appkit-types/`).
      </p>
      <TechTable
        headers={['Query key', 'Used for']}
        rows={[
          ['`comp_rep_kpi`', 'Rep KPI cards on My Comp'],
          ['`comp_rep_earnings_breakdown`', 'Pay breakdown panels'],
          ['`comp_rep_deals`', 'Deal ledger'],
          ['`comp_rep_monthly_attainment`', 'Attainment trend chart'],
          ['`comp_team_kpi`', 'Team summary KPIs'],
          ['`comp_team_agent_performance`', 'Leaderboard + intervention joins'],
          ['`comp_simulation_kpi`', 'Scenario comparison matrix'],
          ['`comp_scenario_design_kpi`', 'Strategy Control Room design panel'],
        ]}
      />

      <SectionHeading>Custom REST API Surface</SectionHeading>
      <p style={{ fontSize: 11.5, color: 'var(--foreground-muted)', lineHeight: 1.6, margin: 0 }}>
        ~45 routes registered in `server/server.ts`. Grouped by domain:
      </p>
      <TechTable
        headers={['Domain', 'Key endpoints']}
        rows={[
          ['Identity & metadata', 'GET `/api/comp/user-profile`, GET `/api/comp/metadata`'],
          ['Rep workspace', 'GET `/api/comp/marketing/workspace`, GET `/api/comp/manager/workspace`'],
          ['Scenarios', 'GET/POST/DELETE `/api/comp/scenarios`'],
          ['Manager coaching', 'GET/POST `/api/comp/manager/interventions`'],
          ['Semantic layer', 'CRUD `/api/admin/semantic-definitions` + validate'],
          ['Varicent ingest', 'POST `/api/admin/varicent/ingest`'],
          ['Copilot', 'POST `/api/comp/copilot/invoke`, mentions lookup + search'],
          ['Agent API', 'POST `/responses`, GET `/agent/info`, GET `/health`'],
          ['External agents (MCP)', 'POST `/mcp` on mcp-hgv-comp-hub, GET `/api/agent/info`, POST `/api/agent/invoke`'],
        ]}
      />

      <SectionHeading>AI / LLM Architecture</SectionHeading>
      <FlowCard
        title="How Claude is invoked (every insight + copilot turn)"
        steps={[
          'Page builds a dataContext string from warehouse/API payloads (KPIs, deals, tours, scenarios).',
          'Server enriches with insightGrounding (benchmarks, plan assessment, Slide 16 fallbacks, team market positions).',
          'finalizeLlmPrompt() appends PLAIN_ENGLISH_LLM_BLOCK (if Simple View) + unique generation_pass UUID.',
          'invokeServingModelDetailed() calls appkit.serving().invoke() using the app service principal.',
          'Response parsed (OpenAI-compatible choices[0].message.content), sanitized, brand-filtered for rep copy.',
          'Headers X-Serving-Endpoint + X-Insight-Source returned; meta includes generated_at + generation_pass.',
        ]}
      />

      <TechTable
        headers={['LLM route', 'Purpose', 'Typical params']}
        rows={[
          ['POST `/api/comp/copilot/invoke`', 'Free-form Copilot chat', 'User-built prompt + 9 CRITICAL RULES'],
          ['POST `/api/comp/manager/insights`', 'Manager payout / coaching brief', 'max_tokens 1024, temp 0.6'],
          ['POST `/api/comp/rep/insights`', 'Rep payout narrative', 'Channel-aware (sales vs marketing)'],
          ['POST `/api/comp/rep/benchmark-impact`', 'Industry benchmark cards', 'Structured impact lines from UC'],
          ['POST `/api/comp/scenario/insights`', 'Scenario interpretation', 'Selected scenario levers + matrix'],
          ['POST `/api/comp/plan-assessment/insights`', 'Plan design narrative', 'persona_id + warehouse matrix'],
          ['POST `/api/comp/pay-mix/insights`', 'Pay mix analysis', 'TCC / base-variable split'],
          ['POST `/api/comp/marketing/tour-insights`', 'Tour activity narrative', 'Tour ledger grounding'],
          ['POST `/api/comp/manager/coaching-signals`', 'Coaching signal cards', 'Team attainment + gaps'],
        ]}
      />

      <SectionHeading>Prompt Engineering & Grounding Sophistication</SectionHeading>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <Sparkles size={14} color="var(--gold)" />
            <span style={{ fontSize: 12, fontWeight: 700 }}>Copilot CRITICAL RULES (client-side)</span>
          </div>
          <p style={{ fontSize: 11, color: 'var(--foreground-muted)', lineHeight: 1.6, margin: 0 }}>
            Nine hard rules in `CompCopilot.buildPrompt()`: answer with facts from context, never deflect to external systems,
            cite exact dollars/IDs/dates, handle @-mentions from lookup data, concise 2–5 bullets. Simple View appends
            `PLAIN_ENGLISH_LLM_BLOCK` for simplified frontline copy.
          </p>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <Database size={14} color="var(--primary)" />
            <span style={{ fontSize: 12, fontWeight: 700 }}>Warehouse-first grounding</span>
          </div>
          <p style={{ fontSize: 11, color: 'var(--foreground-muted)', lineHeight: 1.6, margin: 0 }}>
            `shared/insightGrounding.ts` composes plan assessment blocks, `industry_comp_benchmark` rows
            (`benchmarkGrounding.ts`), Slide 16 static standards, and `fact_rep_market_position` team market data.
            Empty warehouse → deterministic fallback copy, never fabricated numbers.
          </p>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <GitBranch size={14} color="var(--success)" />
            <span style={{ fontSize: 12, fontWeight: 700 }}>@ Mentions — live entity resolution</span>
          </div>
          <p style={{ fontSize: 11, color: 'var(--foreground-muted)', lineHeight: 1.6, margin: 0 }}>
            Syntax: `@rep:REP-JASON`, `@team:TEAM-WEST`, `@scenario:SCN-SIM-01`, `@deal:DEAL-1001`.
            `POST /api/comp/copilot/mentions-lookup` runs live SQL; results injected as
            `=== SUPPLEMENTARY MENTION LOOKUP DATA ===` before the LLM call.
          </p>
        </div>

        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <Shield size={14} color="var(--primary)" />
            <span style={{ fontSize: 12, fontWeight: 700 }}>Post-LLM safety & brand filters</span>
          </div>
          <p style={{ fontSize: 11, color: 'var(--foreground-muted)', lineHeight: 1.6, margin: 0 }}>
            `sanitizeInsightText.ts` strips markdown artifacts; `hgvRepBrandFraming.ts` enforces HGV voice on rep-facing
            insights; benchmark prompts forbid implying HGV is below market on plan design (rep-controllable gaps only).
            `generation_pass` UUID prevents stale copy on refresh while keeping numeric fidelity.
          </p>
        </div>
      </div>

      <SectionHeading>Domain Logic (Shared TypeScript)</SectionHeading>
      <TechTable
        headers={['Module', 'Role']}
        rows={[
          ['`scenarioProjection.ts`', 'Org + team financial projection math (shared client/server)'],
          ['`scenarioLeverUnits.ts`', 'Absolute slider units ($ / tours) ↔ stored pct columns'],
          ['`benchmarkGrounding.ts`', 'Industry gap assessment, optimal commission bands'],
          ['`plainLanguage.ts`', 'Simple View labels + LLM instruction block + role defaults'],
          ['`managerIntervention.ts`', 'TAKEOVER_PRICING + QUOTA_SHIELD contracts'],
          ['`compStandards.ts`', 'Slide 16 areas, pay mix standards, team market seeds'],
          ['`compStatementImpact.ts`', 'Statement impact row derivation for rep panels'],
        ]}
      />

      <SectionHeading>Authentication & Authorization</SectionHeading>
      <TechTable
        headers={['Layer', 'Mechanism']}
        rows={[
          ['Databricks Apps SSO', 'Headers: `x-user-email`, `x-forwarded-user`, `x-user-username`'],
          ['Persona resolution', 'GET `/api/comp/user-profile` — substring map + `dim_rep` SQL lookup'],
          ['Manager gates', 'UI nav + route guards on `/team`, `/admin-console`, `/comp-admin`, `/finance`'],
          ['Warehouse ACL', 'App SP: USE CATALOG, SELECT/MODIFY on `workspace.hgv_comp` (see `08_grant_app_permissions.sql`)'],
          ['App sharing ACL', 'Databricks Apps permissions: CAN_USE / CAN_MANAGE per user'],
          ['LLM invoke identity', 'App service principal (avoids per-user model-serving OBO scope issues)'],
        ]}
      />

      <SectionHeading>Build, Test & Deploy Pipeline</SectionHeading>
      <TechTable
        headers={['Step', 'Command / tool']}
        rows={[
          ['Type generation', '`npm run sync && npm run typegen` — AppKit query types'],
          ['Typecheck', '`npm run typecheck` — server + client project refs'],
          ['Build', '`npm run build:artifacts` — tsdown (server) + vite (client)'],
          ['Bundle validate', '`databricks bundle validate --profile hgv-premium`'],
          ['Deploy', '`databricks bundle deploy && databricks bundle run app`'],
          ['E2E smoke', 'Playwright `tests/smoke.spec.ts` — persona header simulation'],
          ['Lint', 'ESLint 9 + AppKit AST-grep (`appkit lint`)'],
        ]}
      />

      <SectionHeading>AppKit Plugin Configuration</SectionHeading>
      <p style={{ fontSize: 11.5, color: 'var(--foreground-muted)', lineHeight: 1.6, margin: 0 }}>
        Active plugins in `createApp()`: <strong>analytics</strong> (120s timeout), <strong>server</strong> (Express, autoStart false),
        <strong> serving</strong> (Model Serving invoke). Declared but not loaded: genie, lakebase, files.
      </p>
      <CodeBlock>{`createApp({
  plugins: [
    analytics({ timeout: 120_000 }),
    server({ autoStart: false }),
    serving(),
  ],
});`}</CodeBlock>

      <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Server size={16} color="var(--primary)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Production URL</div>
          <code style={{ fontSize: 10, wordBreak: 'break-all' }}>
            https://agent-hgv-comp-hub-7474648704018320.aws.databricksapps.com
          </code>
          <p style={{ fontSize: 10.5, color: 'var(--foreground-muted)', marginTop: 8, marginBottom: 0, lineHeight: 1.55 }}>
            MCP app: <code>https://mcp-hgv-comp-hub-7474648704018320.aws.databricksapps.com/mcp</code>.
            Source repo: `hilton-kb-chat/` — monorepo with `client/`, `server/`, `shared/`, `config/queries/`, `data/comp/` migrations.
          </p>
        </div>
      </div>
    </div>
  );
}
