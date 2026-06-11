import { useState } from 'react';
import {
  BookOpen,
  Users,
  Sparkles,
  Sliders,
  Wallet,
  CheckCircle2,
  Compass,
  ClipboardCheck,
  Award,
  Database,
  Activity,
  Shield,
  AtSign,
  Video,
  Download,
  FileText,
  X,
  Copy,
  Check,
  Cpu,
  Plug,
} from 'lucide-react';
import { AgentMcpSection } from '@/components/howto/AgentMcpSection';
import { RequirementsAlignmentSection } from '@/components/howto/RequirementsAlignmentSection';
import { TechnologyDeepDiveSection } from '@/components/howto/TechnologyDeepDiveSection';

interface Section {
  id: string;
  icon: React.ReactNode;
  label: string;
  color: string;
  audience: 'all' | 'rep' | 'manager';
}

const SECTIONS: Section[] = [
  { id: 'overview',             icon: <BookOpen size={16} />,      label: 'Overview Tab',             color: 'var(--primary)', audience: 'all' },
  { id: 'walkthrough-library',  icon: <Video size={16} />,         label: 'Video Demo & Library',     color: 'var(--gold)',    audience: 'all' },
  { id: 'my-comp',              icon: <Wallet size={16} />,        label: 'My Compensation Tab',      color: 'var(--primary)', audience: 'rep' },
  { id: 'team-ws',              icon: <Users size={16} />,         label: 'Team Workspace Tab',       color: 'var(--success)', audience: 'manager' },
  { id: 'strategy-room',        icon: <Compass size={16} />,       label: 'Strategy Control Room Tab',color: 'var(--gold)',    audience: 'manager' },
  { id: 'comp-admin',           icon: <ClipboardCheck size={16} />,label: 'Comp Admin Tab',           color: 'var(--warning)', audience: 'manager' },
  { id: 'finance',              icon: <Activity size={16} />,      label: 'Finance Intelligence Tab', color: 'var(--primary)', audience: 'manager' },
  { id: 'ai-copilot',           icon: <Sparkles size={16} />,      label: 'AI Copilot & Grounding',   color: 'var(--gold)',    audience: 'all' },
  { id: 'mentions',             icon: <AtSign size={16} />,        label: '@ Mentions & Lookup',      color: 'var(--primary)', audience: 'all' },
  { id: 'operating-gaps',       icon: <Shield size={16} />,        label: 'Operating Model Gaps',     color: 'var(--danger)',  audience: 'manager' },
  { id: 'identity',             icon: <Sliders size={16} />,       label: 'Identity & Permissions',   color: 'var(--gold)',    audience: 'manager' },
  { id: 'technology-deep-dive', icon: <Cpu size={16} />,           label: 'Technology Deep Dive',     color: 'var(--primary)', audience: 'all' },
  { id: 'agent-mcp',            icon: <Plug size={16} />,          label: 'Agent MCP Integration',    color: 'var(--success)', audience: 'all' },
  { id: 'requirements-alignment', icon: <CheckCircle2 size={16} />, label: 'Requirements Alignment', color: 'var(--success)', audience: 'all' },
];

interface TipCardProps {
  icon: React.ReactNode;
  color: string;
  title: string;
  children: React.ReactNode;
}

function TipCard({ icon, color, title, children }: TipCardProps) {
  return (
    <div
      className="card"
      style={{
        padding: '1.25rem 1.5rem',
        borderLeft: `3px solid ${color}`,
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'flex-start',
        marginBottom: '1rem',
      }}
    >
      <div style={{ color, marginTop: 2, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--foreground-muted)', lineHeight: 1.6 }}>{children}</div>
      </div>
    </div>
  );
}

interface StepProps {
  number: number;
  title: string;
  children: React.ReactNode;
}

function Step({ number, title, children }: StepProps) {
  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '1rem' }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: 'var(--primary)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 900,
          flexShrink: 0,
          marginTop: 2,
          boxShadow: '0 2px 8px rgba(26,109,255,0.35)',
        }}
      >
        {number}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--foreground-muted)', lineHeight: 1.6 }}>{children}</div>
      </div>
    </div>
  );
}

interface DatabaseReferenceProps {
  endpoint: string;
  sql: string;
  tables: string[];
}

function DatabaseReference({ endpoint, sql, tables }: DatabaseReferenceProps) {
  return (
    <div style={{
      background: 'rgba(9, 13, 22, 0.6)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      padding: '1.25rem',
      marginTop: '1rem',
      marginBottom: '1rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <Database size={14} color="var(--primary)" />
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Database Lineage & API Integration
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: 10, background: 'var(--primary-muted)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 100, fontWeight: 700, fontFamily: 'monospace' }}>
          {endpoint}
        </span>
        {tables.map(t => (
          <span key={t} style={{ fontSize: 10, background: 'rgba(229,169,60,0.12)', color: 'rgba(229,169,60,0.9)', padding: '2px 8px', borderRadius: 100, fontWeight: 700, fontFamily: 'monospace' }}>
            {t}
          </span>
        ))}
      </div>
      <pre style={{
        background: '#04060b',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 8,
        padding: '0.875rem 1.125rem',
        fontSize: 10.5,
        fontFamily: 'monospace',
        color: '#a9b2c3',
        overflowX: 'auto',
        margin: 0,
        lineHeight: 1.5,
      }}>{sql}</pre>
    </div>
  );
}

const getSectionContent = (
  handleViewDoc: (filename: string, title: string) => void
): Record<string, React.ReactNode> => ({
  'walkthrough-library': (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--foreground-muted)' }}>
        Welcome to the <strong style={{ color: 'var(--foreground)' }}>IGNITE Premium Walkthrough & Artifacts Library</strong>. 
        Here you can watch the interactive system walkthrough demonstrating the end-to-end capabilities of the HGV Compensation Hub, and download or view the full strategic playbooks, dictionaries, and specifications.
      </p>

      {/* Video Hero Player */}
      <div className="card animate-fade-in-up" style={{ padding: '1.5rem', background: 'rgba(9, 13, 22, 0.45)', border: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--gold)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Video size={16} color="var(--gold)" /> Interactive E2E System Walkthrough Video
        </h3>
        <p style={{ fontSize: 11.5, color: 'var(--foreground-muted)', marginBottom: '1.25rem' }}>
          This full high-definition video walkthrough showcases how each of the 120+ requirements, operating model gaps, database models, and persona sandboxes are mapped, verified, and running on the live platform.
        </p>
        <div style={{
          position: 'relative',
          width: '100%',
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid var(--border)',
          background: '#020306',
          aspectRatio: '16/9',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
          marginBottom: '0.5rem'
        }}>
          <video 
            src="/hgv_ignite_live_demo.webm" 
            controls 
            style={{ width: '100%', height: '100%', display: 'block' }}
            preload="metadata"
          />
        </div>
        <div style={{ fontSize: 10, color: 'var(--foreground-muted)', textAlign: 'center', fontStyle: 'italic', marginTop: '0.5rem' }}>
          Video file size: 5.05 MB (format: WebM HD). Use player controls to expand full screen or adjust volume.
        </div>
      </div>

      {/* Artifact Library Download Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--foreground)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Download size={16} color="var(--primary)" /> Strategic Artifacts & Playbooks Library
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {[
            {
              title: 'HGV IGNITE Strategic Playbook',
              filename: 'hgv_ignite_playbook.md',
              desc: 'The master strategic guide outlining compensation rebalancing, governance, and operational policies.',
              size: '14.5 KB',
            },
            {
              title: 'Requirements Alignment Matrix',
              filename: 'slide_requirements_plan.md',
              desc: 'Comprehensive mapping aligning industry assessment themes with live app features.',
              size: '16.1 KB',
            },
            {
              title: 'Visual & Database Element Dictionary',
              filename: 'visual_element_dictionary.md',
              desc: 'Exhaustive dictionary mapping every single chart, button, filter, and Delta Lake table lineage.',
              size: '22.9 KB',
            },
            {
              title: 'E2E Interactive Walkthrough Log',
              filename: 'walkthrough.md',
              desc: 'Chronological test scripts and alignment checklists verifying the complete live execution.',
              size: '5.8 KB',
            }
          ].map(doc => (
            <div key={doc.filename} className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem', borderLeft: '3px solid var(--gold)' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--foreground)' }}>{doc.title}</span>
                  <span style={{ fontSize: 9, color: 'var(--gold)', background: 'rgba(229,169,60,0.1)', border: '1px solid rgba(229,169,60,0.2)', padding: '1px 5px', borderRadius: 4, fontFamily: 'monospace', fontWeight: 700 }}>
                    {doc.size}
                  </span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--foreground-muted)', lineHeight: 1.5 }}>{doc.desc}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <a 
                  href={`/${doc.filename}`} 
                  download={doc.filename}
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    textDecoration: 'none',
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--primary)',
                    background: 'var(--primary-muted)',
                    border: '1px solid var(--primary-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(26,109,255,0.2)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'var(--primary-muted)';
                  }}
                >
                  Download .MD
                </a>
                <button
                  type="button"
                  onClick={() => handleViewDoc(doc.filename, doc.title)}
                  style={{
                    flex: 1,
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--foreground)',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'var(--border)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'var(--bg-elevated)';
                  }}
                >
                  View In-App
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  ),

  overview: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--foreground-muted)' }}>
        <strong style={{ color: 'var(--foreground)' }}>Overview Tab</strong> is your front porch landing portal.
        It connects directly to your Unity Catalog data warehouse to welcome you by name, displaying your active role, team assignment, and quick actions tailored to your permissions.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {[
          { icon: <Wallet size={18} />, title: 'Personal Payouts Link', desc: 'Provides frontline sellers direct routing to their My Compensation portal.' },
          { icon: <Users size={18} />, title: 'Management Hub Link', desc: 'Renders conditionally for managers (L9+) to open the Team Workspace page.' },
          { icon: <BookOpen size={18} />, title: 'Strategic Playbook Link', desc: 'Direct access to this consolidated user manual.' },
        ].map(({ icon, title, desc }) => (
          <div key={title} className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <div style={{ color: 'var(--primary)' }}>{icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
            <div style={{ fontSize: 11.5, color: 'var(--foreground-muted)', lineHeight: 1.5 }}>{desc}</div>
          </div>
        ))}
      </div>

      <TipCard icon={<Award size={14} />} color="var(--gold)" title="Role-Based Access Control (RBAC)">
        The application automatically resolves access permissions. Normal sales reps are locked strictly to their personal compensation views, while managers and administrators are granted strategic compensation analytics and admin workflows.
      </TipCard>

      <h4 style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', marginTop: '0.5rem' }}>Core Interface Shell Elements</h4>
      <ul style={{ listStyleType: 'disc', paddingLeft: '1.25rem', fontSize: 11.5, color: 'var(--foreground-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <li><strong>Sticky Glass Header:</strong> Standardized float navbar with 24px backdrop blur. Includes the brand badge, active page anchors, and period/persona filters.</li>
        <li><strong>Period Picker:</strong> Allows switching database queries between historical and active quarters (e.g. Q2 2026). Built with solid dropdown layers to prevent Windows rendering errors.</li>
        <li><strong>Impersonation Selector (Admin-only):</strong> Temporarily maps your active session to any selected representative to preview their workspace.</li>
        <li><strong>Live LED Status Indicator:</strong> Pulsing green LED dot indicating real-time websocket and delta warehouse connection.</li>
        <li><strong>Sticky Data Lineage Footer:</strong> Displayed globally, verifying active schemas (`workspace.hgv_comp` inside Unity Catalog) and the LLM endpoint status.</li>
      </ul>

      <DatabaseReference
        endpoint="GET /api/comp/metadata"
        tables={['dim_rep', 'dim_period']}
        sql={`-- Fetches active representative records and periods on shell mount
SELECT rep_id, rep_name, level_code FROM workspace.hgv_comp.dim_rep ORDER BY rep_name ASC;
SELECT period_id, period_label FROM workspace.hgv_comp.dim_period ORDER BY period_id ASC;`}
      />
    </div>
  ),

  'operating-gaps': (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--foreground-muted)' }}>
        Before implementation of the IGNITE Compensation Hub, Hilton Grand Vacations (HGV) was plagued by **10 Core Operating Model Gaps** identified through the compensation assessment. Here is how they are structurally solved:
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {[
          { num: 1, title: 'Disjointed Funnel Incentives', gap: 'Siloed marketing, telemarketing, and sales targets incentivized raw volume over downstream transaction quality.', solution: 'Solved by the Finance Tour Quality Matrix, tracking showed/closed rates and VPG across OPC lead score profiles (A, B, C, D).' },
          { num: 2, title: 'Excessive Comp Complexity', gap: 'Multi-tiered plans with too many metrics diluted seller focus and eroded trust.', solution: 'Standardized onto governed commission and rate booster milestones in the dim_plan_version table.' },
          { num: 3, title: 'Plan Proliferation', gap: 'Over 175+ site-specific plan variations created massive administrative overhead.', solution: 'Unified onto governed plan version mappings monitored in the Eligibility desk.' },
          { num: 4, title: 'Poor New Hire Ramp-Up', gap: 'Extreme first-year attrition, particularly for frontline Action Line sellers.', solution: 'Addressed with granular proration tracking (e.g. 58.33% mid-period setting for rep D. Lee) and team manager intervention drawer tools.' },
          { num: 5, title: 'Income Volatility', gap: 'Over-reliance on volatile variable pay mixes created severe frontline financial stress.', solution: 'Visualized through the Pay-Mix Volatility bar on My Comp, rebalancing base salary splits.' },
          { num: 6, title: 'Undefined Career Paths', gap: 'Lack of transparent progression caused top performers to leave.', solution: 'Visualized via active Quota Attainment rate booster target cards to motivate performers.' },
          { num: 7, title: 'Lack of Planning Standards', gap: 'Local spreadsheet-driven target setting created regional pay inequities.', solution: 'Solved by the Scenario Modeler, establishing consistent parameter rules in Delta Lake.' },
          { num: 8, title: 'Undefined Decision Rights', gap: 'Lack of Centralized ownership led to localized comp overrides and leakage.', solution: 'Enforced strictly via sticky glass RBAC locks and session avatar permission filters.' },
          { num: 9, title: 'Fragmented Data Systems', gap: 'Disconnected Salesforce CRM, legacy Callidus/Varicent, and local sheets.', solution: 'Centralized into the Unity Catalog workspace.hgv_comp star schema.' },
          { num: 10, title: 'Manual Calculation Exposure', gap: 'Spreadsheet calculations introduced payroll errors and sync delays.', solution: 'Automated via the Comp Admin audit timeline, payroll preview, and warehouse-backed payout trails.' },
        ].map(g => (
          <div key={g.num} className="card" style={{ padding: '1rem', borderLeft: '3px solid var(--danger)' }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--foreground)' }}>
              Gap #{g.num}: {g.title}
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--foreground-muted)', marginTop: 4, lineHeight: 1.5 }}>
              <strong>The Gap:</strong> {g.gap}
            </p>
            <p style={{ fontSize: 11.5, color: 'var(--success)', marginTop: 3, lineHeight: 1.5 }}>
              <strong>IGNITE Solution:</strong> {g.solution}
            </p>
          </div>
        ))}
      </div>
    </div>
  ),

  'my-comp': (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--foreground-muted)' }}>
        The <strong style={{ color: 'var(--foreground)' }}>My Compensation Tab</strong> provides frontline sales representatives with immediate transparency into earnings statements, quota parameters, and deal credits.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <h4 style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)' }}>How to Use This Page:</h4>
        <Step number={1} title="Audit Your KPI Summary Cards">
          Inspect the cards at the top of the portal. Ensure your current earnings, closed counts, and quota progress reflect your active transactions.
        </Step>
        <Step number={2} title="Analyze Your Pay-Mix Volatility">
          Use the horizontal breakdown bar to see the ratio of your guaranteed base salary (grey) compared to variable commissions (blue) and performance boosters (gold).
        </Step>
        <Step number={3} title="Track Quota Achievements Over Time">
          Read the monthly vertical bar chart to identify seasonal sales curves. Hover bars to see detailed monthly values.
        </Step>
        <Step number={4} title="Review Specific Deal Credits">
          Scroll down to the Recent Contracts & Credits table. Double-check property brands (HGV, Diamond, Bluegreen) and credit payout percentages for each deal.
        </Step>
        <Step number={5} title="Marketing Reps: Review Comp Statement Impact">
          If you are on a marketing persona, scroll to the <strong>Comp Statement Impact</strong> panel. It maps industry benchmark gaps (TCC, pay mix, commission rates, NOI weight) to estimated dollar impact on your statement and feeds the AI insights context.
        </Step>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}>
        <h4 style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)' }}>How to Interpret the Visual Outputs:</h4>
        <ul style={{ listStyleType: 'disc', paddingLeft: '1.25rem', fontSize: 11.5, color: 'var(--foreground-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <li><strong>Guaranteed vs. Volatile Ratio:</strong> If the blue variable commission segment is extremely wide compared to your grey base salary, you have high volatility exposure, meaning your earnings depend heavily on closing deals in the current quarter.</li>
          <li><strong>Quota Progress Warnings:</strong> The card dynamically alerts performance posture. At or above 100% renders aligned (green), 80-99% flags caution (amber), and below 80% marks critical gaps (red).</li>
          <li><strong>Contracts Log:</strong> Green rows indicate finalized and audited deals. Amber rows denote pending transactions undergoing ingestion validation.</li>
          <li><strong>Comp Statement Impact (Marketing):</strong> Each benchmark area shows whether you are above or below market and the estimated dollar delta if plans were aligned to competitor medians.</li>
        </ul>
      </div>

      <DatabaseReference
        endpoint="GET /api/comp/rep/:repId/deals"
        tables={['fact_deal_credit']}
        sql={`-- Fetches raw closed deals credited to the active representative
SELECT deal_id, close_date, brand, sales_volume, credit_amount, status 
FROM workspace.hgv_comp.fact_deal_credit 
WHERE payee_id = :repId AND period_id = :periodId 
ORDER BY close_date DESC;`}
      />
    </div>
  ),

  'kpi-cards': (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--foreground-muted)' }}>
        KPI summary cards translate raw, complex database records into simple, actionable visual metrics. 
        Each card has a harmonized color outline, hover animations, and dynamic calculations.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
        {[
          {
            title: 'My Earnings (Gold Accent)',
            howToUse: 'Use this to verify your total period earnings and reconcile your paycheck against base pay guarantees.',
            howToInterpret: 'Displays base salary + commission payouts + rate booster bonuses. The subtext compares paid-to-date cash (paid out on the 15th) vs. accrued reserves.',
            math: 'total_earnings = base_pay + commission_pay + bonus_pay',
            source: 'fact_payout'
          },
          {
            title: 'Quota Attainment (Reactive Status Accent)',
            howToUse: 'Audit this card to verify that your credited sales volume is aligned with your quarterly quota target.',
            howToInterpret: 'Green signals you have crossed target quota. Amber warning indicators tell you that you are within closing range. Red indicates a high risk of missing period commission multipliers.',
            math: 'attainment_pct = (credited_amount / quota_amount) * 100',
            source: 'fact_quota_attainment'
          },
          {
            title: 'Contracts Closed (Sapphire Accent)',
            howToUse: 'Use this card to reconcile your transaction log. Make sure every single sale credited to your name is tallied here.',
            howToInterpret: 'Indicates the absolute count of approved contract records in the active period. If a deal is missing, its status is likely still pending in Varicent.',
            math: 'deals_count = COUNT(deal_id) WHERE status = "APPROVED"',
            source: 'fact_deal_credit'
          },
          {
            title: 'Next Rate Booster (Emerald Accent)',
            howToUse: 'Read this card to calculate the fastest way to increase your commission rate and maximize payout.',
            howToInterpret: 'Shows the next available commission accelerator tier (e.g. 100% quota) and the exact dollar credit gap remaining to unlock it.',
            math: 'booster_gap = next_tier_threshold - credited_amount',
            source: 'dim_plan_version'
          }
        ].map(card => (
          <div key={card.title} className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)' }}>{card.title}</span>
              <span style={{ fontSize: 9, background: 'var(--bg-overlay)', padding: '2px 6px', borderRadius: 3, fontFamily: 'monospace', color: 'var(--foreground-muted)' }}>{card.source}</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--foreground-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p><strong>How to Use:</strong> {card.howToUse}</p>
              <p><strong>How to Interpret:</strong> {card.howToInterpret}</p>
              <p style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.02)', padding: '4px 8px', borderRadius: 4, display: 'inline-block', width: 'fit-content' }}>
                <span style={{ color: 'var(--primary)' }}>Formula:</span> {card.math}
              </p>
            </div>
          </div>
        ))}
      </div>

      <DatabaseReference
        endpoint="GET /api/comp/rep/:repId/summary"
        tables={['fact_quota_attainment']}
        sql={`-- Reconciles quota targets and credited amounts for KPI cards
SELECT quota_amount, credited_amount, (credited_amount / quota_amount * 100) AS attainment_pct 
FROM workspace.hgv_comp.fact_quota_attainment 
WHERE rep_id = :repId AND period_id = :periodId;`}
      />
    </div>
  ),

  charts: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--foreground-muted)' }}>
        Charts provide a clear, visual overview of performance trend calculations, product allocations, and budget progress.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
        {[
          {
            name: 'Guaranteed vs. Commission Pay-Mix Breakdown Bar',
            page: 'My Comp',
            howToUse: 'Audit this segmented bar chart regularly to see what percentage of your period paycheck is secure vs. variable.',
            howToInterpret: 'Proportions shift reactively. If the gold segment (Rate Booster) is thick, you are capitalizing on accelerators. A thick grey segment means base salary guarantees dominate your pay-mix.',
            source: 'fact_payout'
          },
          {
            name: 'Monthly Quota Achievement Bar Chart',
            page: 'My Comp',
            howToUse: 'Check this chart to track month-over-month volume progression and spot seasonal shifts.',
            howToInterpret: 'Blue columns map verified database records. Grey columns outline fallback estimates. Compare heights to see which month yielded the highest commission credits.',
            source: 'fact_deal_credit'
          },
          {
            name: 'Team Attainment Distribution Chart',
            page: 'Team Workspace',
            howToUse: 'Managers use this grouped bar chart to analyze overall team performance distribution.',
            howToInterpret: 'Reps are grouped into Below 70% (red), 70-100% (amber), and 100%+ (green) bands. A high density of red bars suggests a need for targeted coaching or quota adjustments.',
            source: 'fact_quota_attainment'
          },
          {
            name: 'FFS Product Mix Share Donut & Budget Gauge',
            page: 'Team Workspace',
            howToUse: 'Use this donut and semi-circular gauge to track high-margin FFS sales against the period target.',
            howToInterpret: 'The donut shows the share of FFS products (gold) vs. standard inventory. The gauge arc fills with gold as you approach the budget target, signaling progress toward the goal.',
            source: 'fact_team_snapshot'
          }
        ].map(chart => (
          <div key={chart.name} className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: 13, fontWeight: 800 }}>{chart.name}</span>
              <span className="badge badge-blue" style={{ fontSize: 9 }}>{chart.page}</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--foreground-muted)', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <p><strong>How to Use:</strong> {chart.howToUse}</p>
              <p><strong>How to Interpret:</strong> {chart.howToInterpret}</p>
              <p style={{ fontSize: 10, color: 'var(--foreground-muted)' }}><strong>Source Table:</strong> {chart.source}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  ),

  'ai-copilot': (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--foreground-muted)' }}>
        The <strong style={{ color: 'var(--foreground)' }}>AI Compensation Copilot</strong> is a natural-language analytics assistant on Databricks Model Serving.
        It connects directly to your database, ensuring every answer is grounded in real-time records.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <h4 style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)' }}>How to Use the Copilot:</h4>
        <Step number={1} title="Click 'Insights' for an Instant Overview">
          Click the <strong>Insights</strong> button in the chat header to auto-generate a comprehensive summary of your active data view.
        </Step>
        <Step number={2} title="Use Quick-Prompt Chips">
          Select any of the suggested questions below the input field to quickly check targets or compare scenarios.
        </Step>
        <Step number={3} title="Perform Governed @ Mentions">
          Type <code style={{ background: 'var(--bg-overlay)', padding: '1px 5px', borderRadius: 3 }}>@</code> to trigger the database mention search, or click the **📚 Mentions** button in the header to browse the library. Select a specific representative, team, scenario, or deal ID.
        </Step>
        <Step number={4} title="Ask Specific Questions">
          Type questions like *"Why is contract DEAL-004 not credited?"* or *"Compare budget costs between SCN-BASELINE and SCN-SIM-01"*.
        </Step>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}>
        <h4 style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)' }}>How to Interpret the Responses:</h4>
        <ul style={{ listStyleType: 'disc', paddingLeft: '1.25rem', fontSize: 11.5, color: 'var(--foreground-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <li><strong>Data Citations:</strong> The AI will cite exact numbers, contract IDs, and dates directly from the database context. Check these figures against your records.</li>
          <li><strong>Missing Records:</strong> If a deal is not credited, the Copilot will flag it clearly, explaining which table was searched (e.g. `fact_deal_credit`) so you can identify data gaps.</li>
        </ul>
      </div>

      <DatabaseReference
        endpoint="GET /api/comp/copilot/mentions-search?q=:q"
        tables={['dim_rep', 'dim_team', 'scenario_run', 'fact_deal_credit']}
        sql={`-- Searches the database for entities matching the user's @ query
SELECT rep_id AS id, rep_name AS label, 'rep' AS type FROM workspace.hgv_comp.dim_rep WHERE LOWER(rep_name) LIKE '%:q%'
UNION ALL
SELECT team_id AS id, team_name AS label, 'team' AS type FROM workspace.hgv_comp.dim_team WHERE LOWER(team_name) LIKE '%:q%'
UNION ALL
SELECT deal_id AS id, deal_id AS label, 'deal' AS type FROM workspace.hgv_comp.fact_deal_credit WHERE LOWER(deal_id) LIKE '%:q%';`}
      />
    </div>
  ),

  mentions: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--foreground-muted)' }}>
        The <strong style={{ color: 'var(--foreground)' }}>@ Mention system</strong> lets you reference specific database entities in the AI Copilot. When you use a mention, the system performs a live warehouse lookup for that entity and injects its data into the AI's context.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
        {[
          { prefix: '@rep:', color: 'var(--primary)', example: '@rep:REP-JASON', desc: 'Fetches full rep profile, attainment, payouts, and deal history' },
          { prefix: '@team:', color: 'var(--success)', example: '@team:TEAM-WEST', desc: 'Fetches team KPIs, region, and manager info' },
          { prefix: '@scenario:', color: 'var(--warning)', example: '@scenario:SCN-SIM-01', desc: 'Fetches all scenario parameters and projected outputs' },
          { prefix: '@deal:', color: '#8b5cf6', example: '@deal:DEAL-001', desc: 'Fetches deal status, amount, product, and credit details' },
        ].map(({ prefix, color, example, desc }) => (
          <div key={prefix} className="card" style={{ padding: '0.875rem', borderLeft: `3px solid ${color}` }}>
            <div style={{ fontSize: 12, fontWeight: 800, color, marginBottom: 4 }}>{prefix}</div>
            <div style={{ fontSize: 10, fontFamily: 'monospace', background: 'var(--bg-overlay)', padding: '3px 6px', borderRadius: 3, marginBottom: 6, display: 'inline-block' }}>{example}</div>
            <div style={{ fontSize: 11, color: 'var(--foreground-muted)', lineHeight: 1.5 }}>{desc}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <Step number={1} title="Type @ in the copilot input">
          A dropdown appears with database entities matching your query. Use arrow keys to navigate, Enter or Tab to select.
        </Step>
        <Step number={2} title="Or click the 'Mentions' button">
          The Mentions button in the Copilot header opens a full visual library panel on the right side showing all available reps, teams, scenarios, and deals you can reference.
        </Step>
        <Step number={3} title="The entity data is fetched automatically">
          When you send a message containing @mentions, the server fetches detailed data for each mentioned entity from the warehouse and injects it into the AI's system context before generating a response.
        </Step>
      </div>
    </div>
  ),

  'team-ws': (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--foreground-muted)' }}>
        The <strong style={{ color: 'var(--foreground)' }}>Team Workspace Tab</strong> provides sales managers (L9+) with comprehensive site supervision and pipeline intervention tools.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <h4 style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)' }}>How to Use the Leaderboard & Drawer:</h4>
        <Step number={1} title="Audit Team Attainment Metrics">
          Review the KPI cards to track overall team attainment, top performer counts, at-risk reps, and FFS share percentages.
        </Step>
        <Step number={2} title="Sort the Leaderboard Grid">
          Click any column header (Quota Progress, FFS Rate, Earnings) to sort the table and locate top or underperforming representatives.
        </Step>
        <Step number={3} title="Open the Coaching Drawer">
          Click **Intervene** on any rep row. Review the coaching insight (green = top performer, amber = on track, red = at risk).
        </Step>
        <Step number={4} title="Record warehouse levers (optional)">
          Toggle **Record Co-Sell Pricing Authorization** and/or **Record Quota Relief**, then click **Record Levers &amp; Coach**. This writes to `fact_manager_intervention` and `fact_comp_admin_log` — quota relief recalculates effective attainment on the leaderboard; pricing auth appears in Comp Admin audit trail.
        </Step>
        <Step number={5} title="Coach with Copilot">
          Use **Coach Only** for AI guidance without a warehouse write, or **Record Levers &amp; Coach** to persist then open the Team Copilot with rep context.
        </Step>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}>
        <h4 style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)' }}>How to Interpret the Outputs:</h4>
        <ul style={{ listStyleType: 'disc', paddingLeft: '1.25rem', fontSize: 11.5, color: 'var(--foreground-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <li><strong>Red Row Highlights:</strong> Highlights reps whose quota attainment is below 70%, signaling a high risk of attrition and a need for immediate manager coaching.</li>
          <li><strong>Takeover Status:</strong> Activating the takeover switch signals that you are stepping in to help close a deal, allowing you to use margin offsets to protect HGV's profitability.</li>
        </ul>
      </div>

      <DatabaseReference
        endpoint="GET /api/comp/team/:teamId/reps"
        tables={['dim_rep', 'fact_quota_attainment']}
        sql={`-- Fetches the active representative leaderboard for the manager's team
SELECT r.rep_id, r.rep_name, r.location_code, q.attainment_pct, q.ffs_rate_pct, q.total_earnings 
FROM workspace.hgv_comp.dim_rep r 
JOIN workspace.hgv_comp.fact_quota_attainment q ON r.rep_id = q.rep_id 
WHERE r.team_id = :teamId AND q.period_id = :periodId;`}
      />
    </div>
  ),

  'strategy-room': (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--foreground-muted)' }}>
        The <strong style={{ color: 'var(--foreground)' }}>Strategy Control Room Tab</strong> (accessible to managers L9+) contains three governance modules aligned to the live data model:
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', marginBottom: 6 }}>
            Module D1: Data Model Reference
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--foreground-muted)', lineHeight: 1.5 }}>
            <strong>How to Use:</strong> Select the Marketing or Finance domain tab. Review ETL pipeline stages, entity cards, join topology, and the API-to-UI binding contract. For Marketing, click <code>fact_plan_eligibility</code> for rep-to-plan mapping. For Finance, click <code>dim_finance_period</code> for budget/threshold config and <code>fact_comp_admin_log.attributed_nsv</code> for SPIFF ROI wiring.
            <br /><strong>How to Interpret:</strong> Blue = dimensions, green = facts, amber = reference. Finance domain maps to the Finance Intelligence nav tab (cost, tour quality, SPIFF ROI, accruals). All finance thresholds and budgets load from <code>dim_finance_period</code>; production ETL must UPSERT that table each period.
          </p>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', marginBottom: 6 }}>
            Module D2: Semantic Metrics Catalog
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--foreground-muted)', lineHeight: 1.5 }}>
            <strong>How to Use:</strong> Filter by domain and category (KPI, Measure, Dimension, Calculated). Each card shows the source table, SQL expression, API endpoint, and UI surface it powers.
            <br /><strong>How to Interpret:</strong> If a metric appears here and its source table is populated correctly, the corresponding UI will render without code changes at go-live.
          </p>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', marginBottom: 6 }}>
            Module D3: Scenario Modeler & Competitive Benchmarks
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--foreground-muted)', lineHeight: 1.5, marginBottom: 8 }}>
            <strong>How to Use:</strong> Check scenarios in the library to populate the comparison matrix and payouts chart. Adjust tour volume, conversion, commission, quota, bonus, and accelerator levers. Use the Director+ NOI Weight slider in the market standards card.
            <br /><strong>How to Interpret:</strong>
          </p>
          <ul style={{ listStyleType: 'disc', paddingLeft: '1.25rem', fontSize: 11, color: 'var(--foreground-muted)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <li><strong>Area 1 (Below-Market Gaps):</strong> VP and Director target cash gaps vs competitor medians.</li>
            <li><strong>Area 2 (Pay Mix Volatility):</strong> Base/variable cash split for key field roles.</li>
            <li><strong>Area 3 (Commission rates):</strong> Base rates vs competitors.</li>
            <li><strong>Area 4 (Director NOI Balance):</strong> NOI weight corridor 50%-80%.</li>
          </ul>
        </div>
      </div>

      <DatabaseReference
        endpoint="GET /api/comp/scenarios"
        tables={['scenario_run']}
        sql={`-- Fetches saved scenario runs from Unity Catalog
SELECT scenario_id, scenario_name, quota_change_pct, commission_rate_pct, bonus_rate_change_pct, accelerator_change_pct, projected_payouts 
FROM workspace.hgv_comp.scenario_run 
ORDER BY created_at DESC;`}
      />
    </div>
  ),

  'comp-admin': (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--foreground-muted)' }}>
        The <strong style={{ color: 'var(--foreground)' }}>Comp Admin Tab</strong> manages operational payroll validations, plan assignments, audit timeline ledger audits, and chargeback holds.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <h4 style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)' }}>How to Use the Administration Desk:</h4>
        <Step number={1} title="Select Representative for Drill-Down">
          Use the representative selector in the header to filter eligibility records, audit timelines, and payout trails for a specific rep.
        </Step>
        <Step number={2} title="Export Audit Log">
          Go to the **Audit Trail** tab and click **"Export Audit Log"**. The print preview contains warehouse-sourced events from `fact_comp_admin_log`.
        </Step>
        <Step number={3} title="Monitor Held Reserve Liabilities">
          Go to the **Chargebacks** tab to audit held and released commission reserves.
        </Step>
        <Step number={4} title="Review Payroll Preview">
          Go to the **Payroll Preview** tab to review net payable by rep, including manual adjustments from the admin log.
        </Step>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}>
        <h4 style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)' }}>How to Interpret the Visual Outputs:</h4>
        <ul style={{ listStyleType: 'disc', paddingLeft: '1.25rem', fontSize: 11.5, color: 'var(--foreground-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <li><strong>Proration percentage (Eligibility):</strong> Displays prorated plan settings. For example, a rep hired mid-period (e.g. rep D. Lee) will show a prorated `58.33%` calculation to ensure accurate payout credits.</li>
          <li><strong>Reserve schedule:</strong> Tracks standard **12% reserves** held on FFS product sales, schedule-released after 6 months to protect HGV from rescission losses.</li>
          <li><strong>Net payable (Payroll Preview):</strong> Sum of `fact_payout.total_earnings` plus manual adjustments from `fact_comp_admin_log` for the active period.</li>
        </ul>
      </div>

      <DatabaseReference
        endpoint="GET /api/comp/admin/eligibility?rep_id=:id"
        tables={['fact_plan_eligibility']}
        sql={`-- Fetches proration rates and plan assignments for comp administration
SELECT rep_id, period_id, plan_version_id, effective_start, effective_end, proration_pct, eligibility_flag 
FROM workspace.hgv_comp.fact_plan_eligibility 
WHERE rep_id = :id AND period_id = :periodId;`}
      />
    </div>
  ),

  finance: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--foreground-muted)' }}>
        The <strong style={{ color: 'var(--foreground)' }}>Finance Intelligence Tab</strong> tracks variable comp corridors, conversion yields by ABC lead source, SPIFF cost effectiveness, and accrual balances. All KPIs, thresholds, and budget baselines are sourced from Unity Catalog — no hardcoded finance constants in the application layer.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <h4 style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)' }}>How to Use the Finance Dashboard:</h4>
        <Step number={1} title="Monitor Variable Cost of Sales (Cost Analysis)">
          Compare actual incentive spend from <code>fact_payout</code> against the period budget in <code>dim_finance_period.budget_comp</code>. Corridor thresholds come from the same table.
        </Step>
        <Step number={2} title="Evaluate Tour Conversions (Tour Quality)">
          Review conversion metrics from <code>fact_tour_quality</code> by lead source and ABC score.
        </Step>
        <Step number={3} title="Audit SPIFF ROI Thresholds (SPIFF / ROI)">
          ROI numerator is <code>SUM(attributed_nsv)</code> on SPIFF events; denominator is SPIFF cost. Threshold is <code>dim_finance_period.spiff_roi_threshold</code>.
        </Step>
        <Step number={4} title="Validate Accrual Booking Allocations (Accruals)">
          Accrual = earned minus paid from <code>fact_payout</code>; lock date and policy from <code>dim_finance_period</code>; open reserve from <code>fact_chargeback</code>.
        </Step>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}>
        <h4 style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)' }}>How to Interpret the Visual Outputs:</h4>
        <ul style={{ listStyleType: 'disc', paddingLeft: '1.25rem', fontSize: 11.5, color: 'var(--foreground-muted)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <li><strong>Variable Comp Corridor:</strong> Target min/max % of NSV from <code>dim_finance_period</code>. Exceeding max flags overpayment risk.</li>
          <li><strong>SPIFF ROI warnings:</strong> Campaigns below <code>spiff_roi_threshold</code> are flagged — both ratio inputs are warehouse-backed per event.</li>
          <li><strong>Accrual true-ups:</strong> <code>total_earnings − total_paid</code> from payout facts; reserve liability from chargeback facts.</li>
        </ul>
      </div>

      <DatabaseReference
        endpoint="GET /api/comp/finance/cost-summary"
        tables={['fact_payout', 'fact_tour_quality', 'dim_finance_period']}
        sql={`-- Variable comp % of NSV vs period budget (Finance → Cost Analysis)
SELECT fp.budget_comp,
       SUM(p.total_earnings) AS total_comp,
       SUM(t.net_sales_volume) AS total_nsv,
       ROUND(100.0 * SUM(p.total_earnings) / NULLIF(SUM(t.net_sales_volume), 0), 2) AS var_comp_pct_of_nsv,
       fp.var_comp_target_min_pct, fp.var_comp_target_max_pct
FROM workspace.hgv_comp.dim_finance_period fp
LEFT JOIN workspace.hgv_comp.fact_payout p ON p.period_id = fp.period_id
LEFT JOIN workspace.hgv_comp.fact_tour_quality t ON t.period_id = fp.period_id
WHERE fp.period_id = :periodId
GROUP BY fp.budget_comp, fp.var_comp_target_min_pct, fp.var_comp_target_max_pct;`}
      />

      <DatabaseReference
        endpoint="GET /api/comp/finance/tour-quality"
        tables={['fact_tour_quality']}
        sql={`-- Lead source × ABC matrix (Finance → Tour Quality)
SELECT lead_source, abc_score,
       COUNT(*) AS tour_count,
       SUM(CAST(showed_flag AS INT)) AS showed_count,
       SUM(CAST(closed_flag AS INT)) AS closed_count,
       ROUND(AVG(CASE WHEN closed_flag THEN vpg END), 2) AS avg_vpg,
       SUM(net_sales_volume) AS total_nsv
FROM workspace.hgv_comp.fact_tour_quality
WHERE period_id = :periodId
GROUP BY lead_source, abc_score;`}
      />

      <DatabaseReference
        endpoint="GET /api/comp/finance/roi-analysis"
        tables={['fact_comp_admin_log', 'dim_finance_period']}
        sql={`-- SPIFF ROI from attributed NSV per event (Finance → SPIFF / ROI)
SELECT fp.spiff_roi_threshold,
       SUM(ABS(l.amount)) AS total_spiff_cost,
       SUM(COALESCE(l.attributed_nsv, 0)) AS incremental_nsv,
       ROUND(SUM(COALESCE(l.attributed_nsv, 0)) / NULLIF(SUM(ABS(l.amount)), 0), 1) AS roi_ratio
FROM workspace.hgv_comp.fact_comp_admin_log l
JOIN workspace.hgv_comp.dim_finance_period fp ON fp.period_id = l.period_id
WHERE l.period_id = :periodId
  AND l.event_type IN ('SPIFF', 'SPIFF_APPROVAL')
GROUP BY fp.spiff_roi_threshold;`}
      />

      <DatabaseReference
        endpoint="GET /api/comp/finance/accrual-summary"
        tables={['fact_payout', 'fact_chargeback', 'dim_finance_period']}
        sql={`-- Accrual to book and open reserve (Finance → Accruals)
SELECT fp.payroll_lock_date, fp.accrual_basis, fp.ffs_reserve_pct,
       SUM(p.total_earnings) AS total_earned,
       SUM(p.total_paid) AS total_paid,
       SUM(p.total_earnings) - SUM(p.total_paid) AS accrual_to_book,
       SUM(c.reserve_held) - SUM(c.reserve_released) AS open_reserve_liability
FROM workspace.hgv_comp.dim_finance_period fp
LEFT JOIN workspace.hgv_comp.fact_payout p ON p.period_id = fp.period_id
LEFT JOIN workspace.hgv_comp.fact_chargeback c ON c.period_id = fp.period_id
WHERE fp.period_id = :periodId
GROUP BY fp.payroll_lock_date, fp.accrual_basis, fp.ffs_reserve_pct;`}
      />
    </div>
  ),

  identity: (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--foreground-muted)' }}>
        The platform maps your Databricks session headers dynamically to active representative profile IDs to enforce strict **Role-Based Access Controls (RBAC)**.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Step number={1} title="Databricks Identity Headers">
          On mount, the server intercepts Standard Proxy headers (`x-user-username`, `x-forwarded-user`, `x-user-email`) supplied by the workspace.
        </Step>
        <Step number={2} title="Manager Persona Mapping">
          Any session name containing the keywords <code>vance</code>, <code>mgr</code>, <code>admin</code>, or <code>vp</code> maps to the manager persona (<code>REP-MGR-01</code> - M. Vance, L9 Manager), unlocking Team, Admin, and Strategy tabs.
        </Step>
        <Step number={3} title="Field Representative Mapping">
          Other login names automatically map to frontline sales representative profiles in the database (e.g. Jason Morrison <code>REP-JASON</code>).
        </Step>
        <Step number={4} title="Impersonation Views">
          Managers can select any frontline rep from the navbar picker dropdown. This updates the My Comp dashboard queries to display that representative's personal payout structures, without altering manager administrative permissions.
        </Step>
        <Step number={5} title="Root Viewport Redirects">
          The app automatically checks session permissions on the root path (<code>/</code>). Sales representatives are navigated to <code>/my-compensation</code>, while managers are redirected to the team performance dashboard at <code>/team</code>.
        </Step>
      </div>
    </div>
  ),

  'technology-deep-dive': (
    <TechnologyDeepDiveSection />
  ),

  'agent-mcp': (
    <AgentMcpSection />
  ),

  'requirements-alignment': (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--foreground-muted)' }}>
        The <strong style={{ color: 'var(--foreground)' }}>Requirements Alignment</strong> subsection is a living traceability
        matrix for the IGNITE Compensation Hub. It maps each business requirement to its shipped status and the concrete
        API, UI surface, and Delta Lake objects that implement it — so stakeholders can audit coverage without referencing
        slide decks or static mock data.
      </p>

      <TipCard icon={<CheckCircle2 size={14} />} color="var(--success)" title="How to Read the Matrix">
        Each capability row follows a three-column contract: <strong>Requirement</strong> states the business ask;
        <strong> Status</strong> marks whether it is fully wired in production (<em>Built</em>) or has a known gap
        (<em>Partial</em>); <strong>Implementation</strong> names the exact endpoint, component, or table lineage.
        The coverage bar at the top reflects the ratio of Built requirements across all nine capability groups.
      </TipCard>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <h4 style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
          Live Requirements Matrix
        </h4>
        <RequirementsAlignmentSection />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
        <h4 style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)' }}>Recently Wired Capabilities</h4>
        <p style={{ fontSize: 11.5, color: 'var(--foreground-muted)', lineHeight: 1.6, marginBottom: '0.5rem' }}>
          Two capabilities that previously relied on static references or missing schema columns are now fully warehouse-backed:
        </p>
      </div>

      <DatabaseReference
        endpoint="GET /api/comp/plan-assessment?persona_id=&period_id="
        tables={['plan_assessment_profile', 'plan_assessment_segment']}
        sql={`-- HGV vs Market plan design by persona (replaces static client-side tables)
SELECT p.persona_id, p.plan_id, p.role_title, p.channel_code,
       s.attribute, s.side, s.segment_label, s.segment_value
FROM workspace.hgv_comp.plan_assessment_profile p
JOIN workspace.hgv_comp.plan_assessment_segment s
  ON p.persona_id = s.persona_id AND p.effective_period = s.effective_period
WHERE p.persona_id = :personaId AND p.effective_period = :periodId
ORDER BY s.attribute_order, s.side, s.segment_order;`}
      />

      <DatabaseReference
        endpoint="POST /api/comp/scenarios"
        tables={['scenario_run']}
        sql={`-- Scenario levers now include tour volume AND conversion rate adjustments
INSERT INTO workspace.hgv_comp.scenario_run (
  scenario_id, scenario_name, quota_change_pct, commission_rate_pct,
  bonus_rate_change_pct, accelerator_change_pct,
  tour_volume_change_pct, conversion_rate_change_pct, created_by
) VALUES (:id, :name, :quota, :commission, :bonus, :accel, :tourVol, :convRate, :user);`}
      />
    </div>
  ),
});

export function HowToPage() {
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [audienceFilter, setAudienceFilter] = useState<'all' | 'rep' | 'manager'>('all');
  const [viewedDoc, setViewedDoc] = useState<{ filename: string; title: string; content: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleViewDoc = async (filename: string, title: string) => {
    try {
      const res = await fetch(`/${filename}`);
      if (res.ok) {
        const text = await res.text();
        setViewedDoc({ filename, title, content: text });
      } else {
        alert('Failed to load document content');
      }
    } catch (err) {
      console.error(err);
      alert('Error fetching document');
    }
  };

  const handleCopyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const contentMap = getSectionContent(handleViewDoc);

  const filtered = SECTIONS.filter(
    s => audienceFilter === 'all' || s.audience === 'all' || s.audience === audienceFilter
  );

  return (
    <div className="animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="badge badge-blue">
            <BookOpen size={10} style={{ marginRight: 2 }} />
            Documentation
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
            How To <span className="text-sapphire-gradient">Use & Interpret This App</span>
          </h1>
          {/* Audience filter pills */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {(['all', 'rep', 'manager'] as const).map(a => (
              <button
                key={a}
                type="button"
                onClick={() => { setAudienceFilter(a); setActiveSection(a === 'manager' ? 'team-ws' : 'overview'); }}
                style={{
                  padding: '0.3rem 0.875rem',
                  borderRadius: 999,
                  border: `1px solid ${audienceFilter === a ? 'var(--primary-border)' : 'var(--border)'}`,
                  background: audienceFilter === a ? 'var(--primary-muted)' : 'var(--bg-surface)',
                  color: audienceFilter === a ? 'var(--primary)' : 'var(--foreground-muted)',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  transition: 'all 0.2s',
                }}
              >
                {a === 'all' ? 'Everyone' : a === 'rep' ? 'Sales Reps' : 'Managers'}
              </button>
            ))}
          </div>
        </div>
        <p style={{ fontSize: 13, color: 'var(--foreground-muted)', maxWidth: 600 }}>
          Consolidated user playbook and system dictionary detailing how to use, interpret, and trace database lineage for every tab, card, widget, slider, chart, and control.
        </p>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '1.5rem', alignItems: 'start' }}>

        {/* Sidebar nav */}
        <div style={{ position: 'sticky', top: '72px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {filtered.map(section => {
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  padding: '0.5625rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${isActive ? 'var(--primary-border)' : 'transparent'}`,
                  background: isActive ? 'var(--primary-muted)' : 'transparent',
                  color: isActive ? section.color : 'var(--foreground-muted)',
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ color: isActive ? section.color : 'var(--foreground-muted)', flexShrink: 0 }}>{section.icon}</span>
                {section.label}
              </button>
            );
          })}
        </div>

        {/* Content area */}
        <div key={activeSection} className="animate-fade-in-up card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '0' }}>
          {/* Section header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--radius-sm)',
              background: 'var(--primary-muted)', border: '1px solid var(--primary-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: SECTIONS.find(s => s.id === activeSection)?.color ?? 'var(--primary)',
            }}>
              {SECTIONS.find(s => s.id === activeSection)?.icon}
            </div>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 800 }}>
                {SECTIONS.find(s => s.id === activeSection)?.label}
              </h2>
              <div style={{ fontSize: 10, color: 'var(--foreground-muted)', marginTop: 1 }}>
                {SECTIONS.find(s => s.id === activeSection)?.audience === 'manager'
                  ? 'Manager only'
                  : SECTIONS.find(s => s.id === activeSection)?.audience === 'rep'
                  ? 'Sales Rep view'
                  : 'All users'}
              </div>
            </div>
          </div>

          {contentMap[activeSection] ?? (
            <p style={{ color: 'var(--foreground-muted)', fontSize: 13 }}>Section content coming soon.</p>
          )}
        </div>
      </div>

      {/* Footer quick-links */}
      <div className="card" style={{ padding: '1.25rem', display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={15} color="var(--success)" />
          <span style={{ fontSize: 12, fontWeight: 600 }}>All data is sourced from <code style={{ background: 'var(--bg-overlay)', padding: '1px 5px', borderRadius: 3 }}>workspace.hgv_comp</code> Unity Catalog on Databricks.</span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Quick Start: My Comp', id: 'my-comp' },
            { label: 'Quick Start: Team WS', id: 'team-ws' },
            { label: 'Technology Deep Dive', id: 'technology-deep-dive' },
            { label: 'AI Copilot Guide', id: 'ai-copilot' },
          ].map(({ label, id }) => (
            <button
              key={id}
              type="button"
              onClick={() => { setAudienceFilter('all'); setActiveSection(id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              style={{
                fontSize: 11, fontWeight: 700,
                color: 'var(--primary)',
                background: 'var(--primary-muted)',
                border: '1px solid var(--primary-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.3125rem 0.75rem',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Document Viewer Modal */}
      {viewedDoc && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(4, 6, 10, 0.8)',
          backdropFilter: 'blur(8px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}>
          <div className="card" style={{
            width: '100%',
            maxWidth: '900px',
            maxHeight: '85vh',
            background: 'var(--bg-overlay)',
            border: '1px solid var(--border)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255, 255, 255, 0.02)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ color: 'var(--gold)', display: 'flex', alignItems: 'center' }}>
                  <FileText size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>{viewedDoc.title}</h3>
                  <span style={{ fontSize: 10, color: 'var(--foreground-muted)', fontFamily: 'monospace' }}>
                    {viewedDoc.filename}
                  </span>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => handleCopyText(viewedDoc.content)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.4rem 0.75rem',
                    fontSize: 11,
                    fontWeight: 700,
                    color: copied ? 'var(--success)' : 'var(--foreground)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copied!' : 'Copy to Clipboard'}
                </button>
                
                <button
                  type="button"
                  onClick={() => setViewedDoc(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--foreground-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 4,
                    borderRadius: '50%',
                    transition: 'all 0.15s',
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              background: '#04060b',
              padding: '2rem',
              color: '#d1d5db',
              fontFamily: 'monospace',
              fontSize: '11.5px',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}>
              {viewedDoc.content}
            </div>
            
            {/* Modal Footer */}
            <div style={{
              padding: '0.875rem 1.5rem',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.02)',
              fontSize: 10,
              color: 'var(--foreground-muted)',
            }}>
              <span>Format: GFM Markdown (.md)</span>
              <button
                type="button"
                onClick={() => setViewedDoc(null)}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--foreground)',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.375rem 0.875rem',
                  cursor: 'pointer',
                }}
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
