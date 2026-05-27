import { Compass, Sparkles, BarChart3, Cpu, Database, ClipboardCheck, TrendingUp, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router';

interface OperatingRequirementsMatrixProps {
  onNavigateTab: (tabId: 'ignite' | 'scenarios' | 'semantic' | 'personas' | 'data-model' | 'roadmap', subTabId?: 'call_center' | 'marketing_rep' | 'marketing_manager' | 'marketing_director') => void;
}

export function OperatingRequirementsMatrix({ onNavigateTab }: OperatingRequirementsMatrixProps) {
  const navigate = useNavigate();

  const requirements = [
    {
      category: 'Operating Model Gaps & Benchmarks',
      items: [
        {
          tag: 'Executive Gaps',
          title: '10 Core Operating Gaps',
          desc: 'Ten key gaps across compensation design, employee experience, governance, and technology.',
          solution: 'Ignite Assessment: Gaps Panel. Visualizes the 10 gaps (disjointed incentives, poor ramp-up support, moving targets) as interactive severity-coded cards with business impacts.',
          linkText: 'View Gaps Dashboard',
          icon: Sparkles,
          onClick: () => onNavigateTab('ignite'),
        },
        {
          tag: 'Market Assessment',
          title: 'TCC Market Differentials',
          desc: 'Base pay for reps and directors is below competitor percentiles, driving high commission-risk sentiment.',
          solution: 'Scenario Modeler: Lever Simulations. Enables interactive What-If rebalancing of pay mix (base vs variable) with a comparative baseline budget matrix.',
          linkText: 'Open Scenario Planner',
          icon: BarChart3,
          onClick: () => onNavigateTab('scenarios'),
        },
        {
          tag: 'Organization',
          title: 'Fragmented Governance Model',
          desc: 'Site-level autonomy and inconsistent brand rules (Bluegreen vs HGV) weaken transparency and alignment.',
          solution: 'Ignite Assessment: CoE blueprint. Renders the strategic future-state CoE structure under corporate standard guidelines.',
          linkText: 'View Governance Model',
          icon: Sparkles,
          onClick: () => onNavigateTab('ignite'),
        },
      ],
    },
    {
      category: 'Employee Survey Sentiment',
      items: [
        {
          tag: 'Voice of Employee',
          title: 'Qualitative Survey Testimonials',
          desc: "Frontline employee verbatims highlighting 'recycled leads', low pay-comfort, and uncompetitive earnings.",
          solution: 'Ignite Assessment: Quote Carousel. A custom gold-accented testimonials carousel showing frontline representative perspectives.',
          linkText: 'Read Representative Quotes',
          icon: Sparkles,
          onClick: () => onNavigateTab('ignite'),
        },
        {
          tag: 'Voice of Employee',
          title: 'Sales Sentiment Lag',
          desc: 'Sales employee sentiment lags marketing and telemarketing by significant margins across pay metrics.',
          solution: 'Ignite Assessment: Gaps tab. Side-by-side comparison tables highlighting the Sales Sentiment Lag delta.',
          linkText: 'Analyze Sentiment Lag',
          icon: Sparkles,
          onClick: () => onNavigateTab('ignite'),
        },
      ],
    },
    {
      category: 'Compensation Design & Drivers',
      items: [
        {
          tag: 'Design Drivers',
          title: '3-Tier Funnel Attribution',
          desc: 'Disjointed incentives across Sales (timeshare close), Marketing (tours), and Call Center (packages).',
          solution: 'Persona Compensation Agents: 3-tier funnel Q&A grounded in governed plan rules and warehouse metrics for Call Center, Marketing, and Sales roles.',
          linkText: 'Open Persona Agents',
          icon: Cpu,
          onClick: () => onNavigateTab('personas', 'marketing_rep'),
        },
        {
          tag: 'Design Drivers',
          title: 'Lead Quality VPG Incentives',
          desc: 'Community marketing representatives were paid strictly on volume rather than tour showed quality.',
          solution: 'Marketing Compensation view and persona agent: warehouse-backed tour quality, VPG, and lead-source metrics with policy-grounded coaching.',
          linkText: 'Open Marketing Comp',
          icon: Cpu,
          onClick: () => onNavigateTab('personas', 'marketing_rep'),
        },
        {
          tag: 'Market Assessment',
          title: 'Marketing Pay Benchmarks',
          desc: 'Marketing OPC reps are aligned at $76k TCC but with a highly volatile 40/60 variable pay mix.',
          solution: 'Marketing Persona Agent: answers comp questions using governed datasets, benchmark pay mix rules, and Unity Catalog marketing facts.',
          linkText: 'Open Marketing Agent',
          icon: Cpu,
          onClick: () => onNavigateTab('personas', 'marketing_rep'),
        },
        {
          tag: 'Market Assessment',
          title: 'Telemarketing Role Drivers',
          desc: 'Inbound call center reps ($52k TCC) and Outbound package sales ($45k TCC) require role-specific comp guidance.',
          solution: 'Call Center Persona Agent: policy and warehouse-grounded answers for telemarketing conversion rules and package payout logic.',
          linkText: 'Open Call Center Agent',
          icon: Cpu,
          onClick: () => onNavigateTab('personas', 'call_center'),
        },
        {
          tag: 'Governance & Audit',
          title: 'SPIFF Policy Governance',
          desc: 'Autonomy in site SPIFF creation drives compliance risks and questions of pay equity.',
          solution: 'Governance Desks: Comp Admin & Finance. Integrates official manager approval rules and SPIFF effectiveness ROI metrics.',
          linkText: 'Open Comp Admin',
          icon: ClipboardCheck,
          onClick: () => navigate('/comp-admin'),
        },
      ],
    },
    {
      category: 'Technology & Ingestion Pipeline',
      items: [
        {
          tag: 'Technology Gaps',
          title: 'Data Model & Ingestion Pipeline',
          desc: 'Legacy Varicent acts only as a calculation engine, missing governed data models, ingestion, leadership visibility, and audits.',
          solution: 'Data Model & Ingestion: Lucid-style star schema blueprint with domain tabs, ETL lineage, join topology, and live flat-file ingest console.',
          linkText: 'Open Data Model',
          icon: Database,
          onClick: () => onNavigateTab('data-model'),
        },
        {
          tag: 'Technology Gaps',
          title: 'Comp Accruals & Forecasting',
          desc: 'Varicent completely misses downstream financial reporting, cost forecasting, and accrual audits.',
          solution: 'Finance Intelligence Dashboard. Surfaces cost summaries, variable comp ratios, open reserve liabilities, and accruals.',
          linkText: 'Open Finance Desk',
          icon: TrendingUp,
          onClick: () => navigate('/finance'),
        },
      ],
    },
  ];

  return (
    <div className="space-y-10 animate-fade-in-up">
      <div className="p-6 rounded-2xl bg-card/45 border border-border/15" style={{ padding: '1.75rem' }}>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-xl">
            <Compass size={20} className="text-hgv-gold animate-spin-slow" />
          </div>
          <div>
            <h3 className="text-md font-bold text-foreground">Requirements Verification Matrix</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review and verify operating model gaps and requirements alongside their integrated solution in this hub.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {requirements.map((cat, catIdx) => (
          <div key={catIdx} className="space-y-4">
            <h4 className="text-xs font-black text-hgv-gold uppercase tracking-[0.2em] border-b border-border/10 pb-2">
              {cat.category}
            </h4>

            <div className="grid gap-6 md:grid-cols-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
              {cat.items.map((item, itemIdx) => {
                const Icon = item.icon;
                return (
                  <div
                    key={itemIdx}
                    className="glass-card flex flex-col justify-between group hover:border-primary/20 hover:bg-card/45 transition-all duration-300"
                    style={{ padding: '1.75rem', borderRadius: 'var(--radius-xl)' }}
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-primary/10 text-primary font-mono text-[9px] font-bold">
                          {item.tag}
                        </span>
                        <div className="text-muted-foreground/30 group-hover:text-primary/40 transition-colors">
                          <Icon size={14} />
                        </div>
                      </div>

                      <div>
                        <h5 className="text-sm font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">
                          {item.title}
                        </h5>
                        <p className="text-[11px] text-muted-foreground leading-relaxed mt-1 font-medium">
                          <strong className="text-rose-300/80">Gap:</strong> {item.desc}
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed mt-2 font-medium">
                          <strong className="text-emerald-400">Solution:</strong> {item.solution}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 pt-3 border-t border-border/5">
                      <button
                        onClick={item.onClick}
                        className="inline-flex items-center gap-1 text-[10.5px] font-extrabold text-hgv-gold-light hover:text-hgv-gold hover:gap-1.5 transition-all duration-200 cursor-pointer"
                      >
                        Verify Solution
                        <span className="text-[9px] font-bold">➔</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="p-5 rounded-2xl bg-primary/5 border border-primary/10 text-[10.5px] text-muted-foreground leading-relaxed flex items-start gap-3" style={{ padding: '1.25rem' }}>
        <HelpCircle size={16} className="text-primary shrink-0 mt-0.5" />
        <span>
          <strong>Audit Compliance Verification:</strong> Every item listed in this matrix is linked to an active, warehouse-backed dashboard tab or persona agent. Clicking the <strong>Verify Solution</strong> links will focus your workspace on the corresponding production feature module.
        </span>
      </div>
    </div>
  );
}
