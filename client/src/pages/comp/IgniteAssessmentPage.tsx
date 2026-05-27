import { useState, useEffect, useRef } from 'react';
import { Badge } from '@databricks/appkit-ui/react';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronRight, 
  Info, 
  ArrowRight, 
  ArrowLeft,
  Briefcase,
  Shield,
  Monitor,
  Flame,
  Check,
  X
} from 'lucide-react';
import { CompCopilot } from '@/components/comp/CompCopilot';

// Survey Quote Types
interface Quote {
  text: string;
  role: string;
  location: string;
}

const SURVEY_QUOTES: Quote[] = [
  {
    text: "The reputation in the industry is that our product is number one and our pay is not.",
    role: "Sales Rep",
    location: "US East (Orlando)"
  },
  {
    text: "Quotas are set above achievable levels... Lead and tour quality is highly recycled, making current targets difficult to reach.",
    role: "Action Line Sales Rep",
    location: "US West (Las Vegas)"
  },
  {
    text: "Amazing company to work for and I absolutely love HGV, but base pay is too low in high cost of living markets.",
    role: "Marketing Coordinator",
    location: "US West"
  },
  {
    text: "Current plans are too complex with too many tiers and measures. Changing targets monthly dilutes our trust in what we can earn.",
    role: "Telemarketing Rep",
    location: "US Midwest"
  },
  {
    text: "Varicent Phase 1 does not support Telemarketing or Marketing. Management has no real-time team dashboards or budget modeling.",
    role: "Sales Director",
    location: "Corporate Office"
  }
];

// Operating Model Gaps Types
interface Gap {
  id: number;
  category: 'Compensation Design' | 'Employee Experience' | 'Governance' | 'Technology';
  title: string;
  impact: string;
  solution: string;
}

const OPERATING_GAPS: Gap[] = [
  {
    id: 1,
    category: 'Compensation Design',
    title: 'Disjointed incentives across sales funnel',
    impact: 'Conflicting incentives across Marketing, Telemarketing, and Sales (volume vs. quality) drive poor handoffs, lower conversion, and suboptimal funnel performance.',
    solution: 'Unity Catalog unifies raw touchpoints across the funnel. This app provides joint team conversion dashboards and shared KPIs that cross-reference Marketing lead generation and Sales close volume in real time.'
  },
  {
    id: 2,
    category: 'Compensation Design',
    title: 'Complex compensation design (excessive tiers)',
    impact: 'Excessive commission tiers and measure counts on plans dilute seller/marketer focus. Monthly target changes reduce seller trust and predictability of earnings.',
    solution: 'Our governance engine standardizes all compensation rules in clean, central SQL. This app provides transparent, interactive visual target progress bars and calculated earnings forecasts, returning clarity and trust to the seller.'
  },
  {
    id: 3,
    category: 'Compensation Design',
    title: 'Proliferation of comp plans (175+)',
    impact: 'Site-level plan variations and continued separation of Bluegreen and legacy HGV plans drive administration complexity and reduce enterprise consistency.',
    solution: 'The Scenario Analysis what-if simulator allows plan designers to run centralized simulation models, test Bluegreen/HGV convergence, and view enterprise budget implications before deploying plans.'
  },
  {
    id: 4,
    category: 'Employee Experience',
    title: 'Poor ramp-up support for new hires',
    impact: 'Inconsistent ramp-up support for early-tenure sales roles (especially Action Line) leads to low pay stability and high attrition within the first 6–12 months.',
    solution: 'Managers can flag early-tenure reps in the Team Performance dashboard and simulate tiered ramp-up SPIFFs, modeling the payout safety net required to retain talent.'
  },
  {
    id: 5,
    category: 'Employee Experience',
    title: 'Lack of pay stability (high volatility)',
    impact: 'Heavy reliance on variable pay and extreme income volatility increases attrition risk, makes roles less competitive, and shifts focus to short-term outcomes over sustained performance.',
    solution: 'The My Compensation dashboard provides active compensation path guidance and calculates expected commission, helping reps visually map out their earnings path and smooth out volatility concerns.'
  },
  {
    id: 6,
    category: 'Employee Experience',
    title: 'Undefined career paths',
    impact: 'Lack of visible progression paths and differentiated role economics reduces retention of top performers, causing them to seek growth opportunities outside HGV.',
    solution: 'This app integrates tier attainment visual paths. Reps see precisely how close they are to the next tier thresholds (e.g. FFS threshold gap) and their historical performance trajectories.'
  },
  {
    id: 7,
    category: 'Governance',
    title: 'Lack of compensation planning standardization',
    impact: 'Site-specific planning, target-setting approaches, and operational nuances (e.g. equitable rep rotations) create inconsistency and high administrative burden.',
    solution: 'Standardizes target-setting and payout logic globally using Serverless SQL Warehouses, eliminating manual spreadsheet-driven discrepancies between regional sites.'
  },
  {
    id: 8,
    category: 'Governance',
    title: 'Undefined & inconsistent decision rights',
    impact: 'Unclear decision ownership across cross-functional teams drives inconsistent plan designs and limits enterprise-level control across HGV and Bluegreen.',
    solution: 'This app roles-out governed views based on Unity Catalog entitlements, aligning Sales Executives, Business Operations, Finance, and IT under a single source of truth.'
  },
  {
    id: 9,
    category: 'Technology',
    title: 'Fragmented data ecosystem & source of truth',
    impact: 'Disconnected systems (Salesforce, Varicent, spreadsheets) and manually stitched data limit insight generation and lack a unified source of truth.',
    solution: 'Our solution aggregates Salesforce logs, Varicent calculations, and inventory data into a single Lakehouse schema (`workspace.hgv_comp`), serving as the governed gold standard.'
  },
  {
    id: 10,
    category: 'Technology',
    title: 'Manual spreadsheet processes expose risk',
    impact: 'Spreadsheet-driven processes create material risk of errors, reduce seller trust in outputs, limit transparency and auditability, and cause delays in compensation reporting.',
    solution: 'All calculation formulas are stored in managed Unity Catalog views rather than local sheets. RunSql calls query this direct to database, offering instant, audited calculations.'
  }
];

// Varicent Gaps Gaps Types
interface VaricentRow {
  capability: string;
  leading: string;
  varicentPhase1: 'supported' | 'partial' | 'unsupported';
  databricksApp: 'supported' | 'partial';
}

const VARICENT_GAPS: VaricentRow[] = [
  {
    capability: 'Leadership / Managerial Reporting',
    leading: 'Fully automated real-time cross-team reports',
    varicentPhase1: 'unsupported',
    databricksApp: 'supported'
  },
  {
    capability: 'Real-time Integration Capabilities',
    leading: 'Instant pipeline and commission syncing',
    varicentPhase1: 'unsupported',
    databricksApp: 'supported'
  },
  {
    capability: 'Target Setting / Quota Management',
    leading: 'Governed target setting and adjustments',
    varicentPhase1: 'unsupported',
    databricksApp: 'supported'
  },
  {
    capability: 'Team Performance Insights',
    leading: 'Visual team dashboards and rankings',
    varicentPhase1: 'unsupported',
    databricksApp: 'supported'
  },
  {
    capability: 'Incentive / Expense Forecasting',
    leading: 'What-if scenarios and budget impact',
    varicentPhase1: 'unsupported',
    databricksApp: 'supported'
  },
  {
    capability: 'Marketing & Telemarketing Support',
    leading: 'Full comp calculations for C1/C2 roles',
    varicentPhase1: 'unsupported',
    databricksApp: 'supported'
  },
  {
    capability: 'Payout Validation & Audit logs',
    leading: 'Lineage tracing and adjustment tracking',
    varicentPhase1: 'unsupported',
    databricksApp: 'supported'
  },
  {
    capability: 'Sales Executive Goal Tracking',
    leading: 'Macro enterprise progress charts',
    varicentPhase1: 'partial',
    databricksApp: 'supported'
  }
];

export function IgniteAssessmentPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'gaps' | 'survey' | 'varicent' | 'deck-map'>('overview');
  const [selectedGap, setSelectedGap] = useState<number | null>(null);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const carouselTimer = useRef<NodeJS.Timeout | null>(null);

  // Auto-rotating Survey Quotes Carousel
  useEffect(() => {
    carouselTimer.current = setInterval(() => {
      setCurrentQuoteIndex((prev) => (prev + 1) % SURVEY_QUOTES.length);
    }, 6000);

    return () => {
      if (carouselTimer.current) clearInterval(carouselTimer.current);
    };
  }, []);

  const handleNextQuote = () => {
    if (carouselTimer.current) clearInterval(carouselTimer.current);
    setCurrentQuoteIndex((prev) => (prev + 1) % SURVEY_QUOTES.length);
  };

  const handlePrevQuote = () => {
    if (carouselTimer.current) clearInterval(carouselTimer.current);
    setCurrentQuoteIndex((prev) => (prev - 1 + SURVEY_QUOTES.length) % SURVEY_QUOTES.length);
  };

  const IGNITE_DATA_CONTEXT = `
  === HGV IGNITE COMPENSATION ASSESSMENT (MAY 2026) SUMMARY ===
  
  THE 10 OPERATING MODEL GAPS:
  1. Compensation Design - Disjointed incentives across sales funnel (Conflicting goals between Marketing, Telemarketing, and Sales lead to poor handoffs).
  2. Compensation Design - Complex compensation design (Excessive tiers and measures, monthly target changes dilute seller trust).
  3. Compensation Design - Proliferation of comp plans (175+ site-level plans and separation of legacy HGV and Bluegreen).
  4. Employee Experience - Poor ramp up support for new hires (Leads to early tenure attrition in Action Line).
  5. Employee Experience - Lack of pay stability (Heavy reliance on variable pay and income volatility).
  6. Employee Experience - Undefined career paths (Lack of progression paths pushes high performers to leave).
  7. Governance - Lack of compensation planning standardization (Site-specific Nuances create huge administrative burden).
  8. Governance - Undefined and inconsistent decision rights (Unclear decision ownership limits enterprise-level control).
  9. Technology - Fragmented data ecosystem (Disconnected Salesforce, Varicent, and spreadsheet systems).
  10. Technology - Manual processes expose risk (Spreadsheet calculations create errors, lack auditing, delay reporting).
  
  EMPLOYEE SURVEY SENTIMENT SCORES (1.0 to 5.0 scale):
  Strengths:
  - Role Clarity: 4.41
  - Pride in HGV: 4.42
  - HGV Market Leadership: 4.42
  - Training Adequacy: 3.88
  
  Opportunities for Improvement:
  - Quota Fairness: 3.02
  - Compensation Competitiveness: 3.09
  - Pay Mix Comfort: 3.05
  - Lead Quality: 3.16
  
  SALES FUNCTION SENTIMENT LAG:
  Sales employees are far more negative on incentive-related topics than Marketing & Telemarketing:
  - Sales Lead Quality: 2.92 (0.39 lower than Marketing/Telemarketing average)
  - Sales Quota Fairness: 2.84 (0.29 lower than Marketing/Telemarketing average)
  - Sales Comp Competitiveness: 2.83 (0.41 lower than Marketing/Telemarketing average)
  - Sales Pay Mix Comfort: 2.86 (0.31 lower than Marketing/Telemarketing average)
  
  BLUEGREEN DIFFERENTIAL:
  - Quota Fairness satisfaction score is +0.43 higher for Bluegreen sellers compared to legacy HGV sellers, representing better quota baseline setting.
  
  VARICENT PHASE 1 ICM ROADMAP GAPS (ROADMAP ASSESSMENT):
  Current Varicent roadmap acts only as an advanced calculator and is completely manual/unsupported (red 'X') for:
  - Leadership and managerial reporting
  - Real-time integration capabilities
  - Target setting & Quota management
  - Team performance insights
  - Incentive forecasting & scenario what-if modeling
  - Full support for Telemarketing (C1) and Marketing (C2)
  - Compensation expense forecasting, budget alignment, and payout validation.
  
  How the Databricks App Extension bridges these Varicent gaps:
  - The Databricks app queries Unity Catalog real-time views directly, bypassing calculator latency.
  - Adds Team Performance Dashboard with automated FFS mix indicators, rep rankings, and attainment tracking.
  - Adds Scenario what-if analyzer with real-time projected cost and budget impact levers for Finance and executive strategy planning.
  - Incorporates dynamic lookup using @ mentions (@rep, @team, @scenario, @deal) to provide immediate transparent credit data.
  `;

  return (
    <div className="space-y-8 animate-fade-in-up">

      {/* Modern Tab Pill Bar */}
      <div className="flex flex-wrap gap-1.5 rounded-xl bg-muted/30 p-1 border border-border/10">
        <button
          onClick={() => setActiveTab('overview')}
          className={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
            activeTab === 'overview'
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]'
              : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
          }`}
        >
          Assessment Overview
        </button>
        <button
          onClick={() => setActiveTab('gaps')}
          className={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
            activeTab === 'gaps'
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]'
              : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
          }`}
        >
          10 Operating Gaps
        </button>
        <button
          onClick={() => setActiveTab('survey')}
          className={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
            activeTab === 'survey'
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]'
              : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
          }`}
        >
          Survey &amp; Sentiment
        </button>
        <button
          onClick={() => setActiveTab('varicent')}
          className={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
            activeTab === 'varicent'
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]'
              : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
          }`}
        >
          Varicent Roadmaps
        </button>
        <button
          onClick={() => setActiveTab('deck-map')}
          className={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
            activeTab === 'deck-map'
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]'
              : 'text-muted-foreground hover:bg-primary/10 hover:text-primary'
          }`}
        >
          Requirements Alignment
        </button>
      </div>

      {/* Grid Layout: Left Content, Right AI Sidebar */}
      <div className="grid gap-6 lg:grid-cols-3">
        
        {/* Main Content Area */}
        <div className="space-y-6 lg:col-span-2">
          
          {/* TAB 1: Assessment Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fade-in-up">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="glass-card flex flex-col justify-between" style={{ padding: '2.25rem 2rem' }}>
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold flex items-center gap-2 text-foreground">
                      <Flame className="h-4 w-4 text-amber-500" />
                      Assessment Scope
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                      HGV surveyed employees across incentive plans on <strong>Compensation Design</strong>, <strong>Employee Experience</strong>, <strong>Governance</strong>, and <strong>Technology</strong>.
                    </p>
                    <ul className="text-xs text-muted-foreground/80 list-disc list-inside space-y-1.5 font-medium">
                      <li>557 Marketing Respondents</li>
                      <li>341 Telemarketing Respondents</li>
                      <li>548 Sales Respondents</li>
                      <li>All major HGV/BG regional sites represented</li>
                    </ul>
                  </div>
                  <div className="mt-4 text-[10px] uppercase font-bold tracking-wider text-hgv-gold-light">2026 Compensation Assessment</div>
                </div>

                <div className="glass-card flex flex-col justify-between" style={{ padding: '2.25rem 2rem' }}>
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold flex items-center gap-2 text-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      Databricks App Objective
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                      While Varicent remains the core batch payout calculator, this app is the **intelligent real-time extension** bridging operational gaps.
                    </p>
                    <ul className="text-xs text-muted-foreground/80 list-disc list-inside space-y-1.5 font-medium">
                      <li>Real-time Unity Catalog target calculations</li>
                      <li>Cross-funnel leads-to-deals transparency</li>
                      <li>Dynamic scenario forecasting for executive strategy</li>
                      <li>Interactive transparency for field and call centers</li>
                    </ul>
                  </div>
                  <div className="mt-4 text-[10px] uppercase font-bold tracking-wider text-primary">Lakehouse Extension</div>
                </div>
              </div>

              {/* Voice of the Employee Carousel */}
              <div className="glass-card-gold relative overflow-hidden" style={{ padding: '2.25rem 2rem' }}>
                <div className="absolute top-0 right-0 h-12 w-12 pointer-events-none opacity-20">
                  <Info className="h-10 w-10 text-hgv-gold" />
                </div>
                <div className="space-y-4">
                  <h4 className="text-xs uppercase tracking-widest text-hgv-gold font-extrabold flex items-center gap-2">
                    Authentic Voice of the Employee
                  </h4>
                  <div className="min-h-[6.5rem] flex flex-col justify-between">
                    <p className="text-sm italic text-foreground/90 leading-relaxed font-serif pt-1">
                      &ldquo;{SURVEY_QUOTES[currentQuoteIndex].text}&rdquo;
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground pt-3 border-t border-hgv-gold/10">
                      <div>
                        <span className="font-bold text-foreground">{SURVEY_QUOTES[currentQuoteIndex].role}</span> — {SURVEY_QUOTES[currentQuoteIndex].location}
                      </div>
                      <div className="flex gap-2">
                        <button 
                          className="h-7 w-7 rounded-lg border border-glass-border hover:bg-card flex items-center justify-center transition-colors" 
                          onClick={handlePrevQuote}
                        >
                          <ArrowLeft className="h-3 w-3" />
                        </button>
                        <button 
                          className="h-7 w-7 rounded-lg border border-glass-border hover:bg-card flex items-center justify-center transition-colors" 
                          onClick={handleNextQuote}
                        >
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Key findings */}
              <div className="glass-card space-y-4" style={{ padding: '2.25rem 2rem' }}>
                <h4 className="text-sm font-bold text-foreground">Key Assessment Findings</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 text-xs font-black">1</span>
                      <h5 className="text-xs font-bold text-foreground">Extreme Volatility Reliance</h5>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                      Sellers experience highly volatile monthly checks due to lead changes and hard-to-hit commission accelerators, leading to high turnover of Action Line sellers within 12 months.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 text-xs font-black">2</span>
                      <h5 className="text-xs font-bold text-foreground">Technology / Tool Gap limits Trust</h5>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                      Varicent is locked as a monthly batch ledger. Spreadsheet-driven targets and lack of clear team credit dashboards lead to disputable commission outputs and zero day-to-day payee transparency.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 10 Operating Model Gaps */}
          {activeTab === 'gaps' && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="flex items-center justify-between border-b border-border/10 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-foreground">10 Identified Gaps &amp; Interactive Solutions</h4>
                  <p className="text-xs text-muted-foreground font-medium">Select a gap to see exactly how this Databricks app bridges the assessment finding.</p>
                </div>
                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider px-2 border-glass-border">Industry Gap Assessment</Badge>
              </div>

              <div className="grid gap-3">
                {OPERATING_GAPS.map((gap) => {
                  const isExpanded = selectedGap === gap.id;
                  const getCategoryIcon = (cat: string) => {
                    if (cat === 'Compensation Design') return <Briefcase className="h-4 w-4 text-emerald-400" />;
                    if (cat === 'Employee Experience') return <Users className="h-4 w-4 text-blue-400" />;
                    if (cat === 'Governance') return <Shield className="h-4 w-4 text-purple-400" />;
                    return <Monitor className="h-4 w-4 text-amber-400" />;
                  };

                  return (
                    <div 
                      key={gap.id} 
                      className={`rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden ${
                        isExpanded 
                          ? 'border-primary bg-primary/5 shadow-md shadow-primary/5' 
                          : 'border-glass-border hover:border-primary/20 bg-muted/10'
                      }`}
                      onClick={() => setSelectedGap(isExpanded ? null : gap.id)}
                    >
                      <div className="flex items-center justify-between gap-3" style={{ padding: '1.25rem 1.5rem' }}>
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-card border border-glass-border">
                            {getCategoryIcon(gap.category)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">{gap.category}</span>
                              <span className="text-[8px] font-black bg-primary/10 text-primary border border-primary/20 rounded px-1">GAP #{gap.id}</span>
                            </div>
                            <h5 className="text-sm font-bold mt-0.5 text-foreground">{gap.title}</h5>
                          </div>
                        </div>
                        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${isExpanded ? 'rotate-90 text-primary' : ''}`} />
                      </div>
                      
                      {isExpanded && (
                        <div className="border-t border-border/5 bg-card/20 text-xs space-y-3 animate-fade-in-up" style={{ padding: '0.5rem 1.5rem 1.5rem 1.5rem' }}>
                          <div className="pt-2">
                            <span className="font-extrabold text-destructive flex items-center gap-1">
                              <AlertTriangle className="h-3.5 w-3.5" /> Assessment Impact:
                            </span>
                            <p className="mt-1 text-muted-foreground leading-relaxed font-medium">{gap.impact}</p>
                          </div>
                          <div className="p-3.5 rounded-xl border border-primary/10 bg-primary/10">
                            <span className="font-extrabold text-primary flex items-center gap-1">
                              <CheckCircle2 className="h-4 w-4 text-primary" /> Databricks App Governance Solution:
                            </span>
                            <p className="mt-1 text-foreground/90 leading-relaxed font-semibold">{gap.solution}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: Survey & Sentiment */}
          {activeTab === 'survey' && (
            <div className="space-y-6 animate-fade-in-up">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-foreground">Incentive Employee Survey Sentiment</h4>
                <p className="text-xs text-muted-foreground font-medium">Perspectives captured across Marketing, Telemarketing, and Sales on a 1.0 to 5.0 scale.</p>
              </div>

              {/* Heatmap Grid */}
              <div className="grid gap-4 sm:grid-cols-2">
                
                {/* Strengths */}
                <div className="glass-card overflow-hidden">
                  <div className="bg-emerald-500/10 border-b border-emerald-500/10 flex items-center gap-1.5" style={{ padding: '1rem 1.5rem' }}>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <h5 className="text-xs uppercase font-extrabold text-emerald-400 tracking-wider">Strengths (Overall Strong)</h5>
                  </div>
                  <div className="space-y-4" style={{ padding: '2.25rem 2rem' }}>
                    <div className="flex justify-between items-center rounded-xl bg-card border border-glass-border" style={{ padding: '0.875rem 1.25rem' }}>
                      <span className="text-xs text-foreground font-medium">Pride in Hilton Grand Vacations</span>
                      <Badge className="bg-emerald-500 text-emerald-foreground font-mono font-bold">4.42</Badge>
                    </div>
                    <div className="flex justify-between items-center rounded-xl bg-card border border-glass-border" style={{ padding: '0.875rem 1.25rem' }}>
                      <span className="text-xs text-foreground font-medium">HGV Market Leadership View</span>
                      <Badge className="bg-emerald-500 text-emerald-foreground font-mono font-bold">4.42</Badge>
                    </div>
                    <div className="flex justify-between items-center rounded-xl bg-card border border-glass-border" style={{ padding: '0.875rem 1.25rem' }}>
                      <span className="text-xs text-foreground font-medium">Role and Responsibilities Clarity</span>
                      <Badge className="bg-emerald-500 text-emerald-foreground font-mono font-bold">4.41</Badge>
                    </div>
                    <div className="flex justify-between items-center rounded-xl bg-card border border-glass-border" style={{ padding: '0.875rem 1.25rem' }}>
                      <span className="text-xs text-foreground font-medium">Adequacy of Training</span>
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/5 font-mono font-bold">3.88</Badge>
                    </div>
                  </div>
                </div>

                {/* Opportunities */}
                <div className="glass-card overflow-hidden">
                  <div className="bg-rose-500/10 border-b border-rose-500/10 flex items-center gap-1.5" style={{ padding: '1rem 1.5rem' }}>
                    <AlertTriangle className="h-4 w-4 text-rose-400" />
                    <h5 className="text-xs uppercase font-extrabold text-rose-400 tracking-wider">Key Gaps (Opportunities)</h5>
                  </div>
                  <div className="space-y-4" style={{ padding: '2.25rem 2rem' }}>
                    <div className="flex justify-between items-center rounded-xl bg-card border border-glass-border" style={{ padding: '0.875rem 1.25rem' }}>
                      <span className="text-xs text-foreground font-medium">Lead / Tour Quality Score</span>
                      <Badge variant="outline" className="border-rose-500/30 text-rose-400 bg-rose-500/5 font-mono font-bold">3.16</Badge>
                    </div>
                    <div className="flex justify-between items-center rounded-xl bg-card border border-glass-border" style={{ padding: '0.875rem 1.25rem' }}>
                      <span className="text-xs text-foreground font-medium">Incentive Plan Competitiveness</span>
                      <Badge variant="outline" className="border-rose-500/30 text-rose-400 bg-rose-500/5 font-mono font-bold">3.09</Badge>
                    </div>
                    <div className="flex justify-between items-center rounded-xl bg-card border border-glass-border" style={{ padding: '0.875rem 1.25rem' }}>
                      <span className="text-xs text-foreground font-medium">Pay Mix Comfort (Base vs Var)</span>
                      <Badge variant="outline" className="border-rose-500/30 text-rose-400 bg-rose-500/5 font-mono font-bold">3.05</Badge>
                    </div>
                    <div className="flex justify-between items-center rounded-xl bg-card border border-glass-border" style={{ padding: '0.875rem 1.25rem' }}>
                      <span className="text-xs text-foreground font-medium">Sales Quota Target Fairness</span>
                      <Badge variant="outline" className="border-rose-500/30 text-rose-400 bg-rose-500/5 font-mono font-bold">3.02</Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sales Lag Comparison Card */}
              <div className="glass-card overflow-hidden">
                <div className="border-b border-border/10" style={{ padding: '2.25rem 2rem' }}>
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                    <h5 className="text-xs uppercase font-extrabold text-hgv-gold tracking-wider flex items-center gap-1.5">
                      <TrendingDown className="h-4 w-4 text-hgv-gold" />
                      Sales Sentiment Lag vs. Marketing/Telemarketing
                    </h5>
                    <Badge variant="outline" className="text-[9px] uppercase font-bold border-rose-500/20 text-rose-400 bg-rose-500/5">Attrition Risk Warning</Badge>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground font-medium">
                    Sentiment feedback analysis shows Sales roles score significantly lower in comp-related topics.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-muted/40 text-[9px] uppercase font-bold text-muted-foreground tracking-wider border-b border-border/10">
                      <tr>
                        <th style={{ padding: '1rem 1.25rem' }}>Sentiment Factor</th>
                        <th className="text-center" style={{ padding: '1rem 1.25rem' }}>Marketing/Tele Average</th>
                        <th className="text-center" style={{ padding: '1rem 1.25rem' }}>Sales Average</th>
                        <th className="text-center" style={{ padding: '1rem 1.25rem' }}>Delta / Lag</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/5 font-medium">
                      <tr>
                        <td className="text-foreground font-bold" style={{ padding: '1.125rem 1.25rem' }}>Incentive Plan Competitiveness</td>
                        <td className="text-center font-mono" style={{ padding: '1.125rem 1.25rem' }}>3.24</td>
                        <td className="text-center font-mono text-rose-400 font-extrabold" style={{ padding: '1.125rem 1.25rem' }}>2.83</td>
                        <td className="text-center font-mono text-rose-400 bg-rose-500/5" style={{ padding: '1.125rem 1.25rem' }}>- 0.41</td>
                      </tr>
                      <tr>
                        <td className="text-foreground font-bold" style={{ padding: '1.125rem 1.25rem' }}>Lead &amp; Tour Quality</td>
                        <td className="text-center font-mono" style={{ padding: '1.125rem 1.25rem' }}>3.31</td>
                        <td className="text-center font-mono text-rose-400 font-extrabold" style={{ padding: '1.125rem 1.25rem' }}>2.92</td>
                        <td className="text-center font-mono text-rose-400 bg-rose-500/5" style={{ padding: '1.125rem 1.25rem' }}>- 0.39</td>
                      </tr>
                      <tr>
                        <td className="text-foreground font-bold" style={{ padding: '1.125rem 1.25rem' }}>Pay Mix Comfort (Variable reliance)</td>
                        <td className="text-center font-mono" style={{ padding: '1.125rem 1.25rem' }}>3.17</td>
                        <td className="text-center font-mono text-rose-400 font-extrabold" style={{ padding: '1.125rem 1.25rem' }}>2.86</td>
                        <td className="text-center font-mono text-rose-400 bg-rose-500/5" style={{ padding: '1.125rem 1.25rem' }}>- 0.31</td>
                      </tr>
                      <tr>
                        <td className="text-foreground font-bold" style={{ padding: '1.125rem 1.25rem' }}>Sales Quota Target Fairness</td>
                        <td className="text-center font-mono" style={{ padding: '1.125rem 1.25rem' }}>3.13</td>
                        <td className="text-center font-mono text-rose-400 font-extrabold" style={{ padding: '1.125rem 1.25rem' }}>2.84</td>
                        <td className="text-center font-mono text-rose-400 bg-rose-500/5" style={{ padding: '1.125rem 1.25rem' }}>- 0.29</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                
                {/* BG Quota delta highlight */}
                <div className="border-t border-border/10 bg-emerald-500/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs font-semibold" style={{ padding: '1rem 1.25rem' }}>
                  <span className="font-extrabold text-emerald-400 flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5" /> Bluegreen Differential Highlight:
                  </span>
                  <span className="text-muted-foreground">
                    Quota Fairness is <strong className="text-emerald-400 font-bold">+0.43</strong> higher for Bluegreen than legacy HGV.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Varicent Phase 1 Gaps */}
          {activeTab === 'varicent' && (
            <div className="space-y-4 animate-fade-in-up">
              <div className="flex items-center justify-between border-b border-border/10 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-foreground">Varicent Roadmap Capability Gaps Matrix</h4>
                  <p className="text-xs text-muted-foreground font-medium">The assessment shows Varicent is missing core capabilities. We show how this Databricks app bridges them.</p>
                </div>
                <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-500/5 text-[9px] uppercase font-bold tracking-wider px-2">Roadmap Assessment</Badge>
              </div>

              <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-muted/40 text-[9px] uppercase font-bold text-muted-foreground tracking-wider border-b border-border/10">
                      <tr>
                        <th style={{ padding: '1rem 1.25rem' }}>Key Capability Gap</th>
                        <th style={{ padding: '1rem 1.25rem' }}>Leading Companies Standard</th>
                        <th className="text-center" style={{ padding: '1rem 1.25rem' }}>Varicent Phase 1</th>
                        <th className="text-center text-primary font-bold" style={{ padding: '1rem 1.25rem' }}>Databricks App Extension</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/5 font-medium">
                      {VARICENT_GAPS.map((row, idx) => (
                        <tr key={idx} className="hover:bg-muted/5 transition-colors">
                          <td className="text-foreground font-bold" style={{ padding: '1.125rem 1.25rem' }}>{row.capability}</td>
                          <td className="text-muted-foreground font-medium" style={{ padding: '1.125rem 1.25rem' }}>{row.leading}</td>
                          <td className="text-center" style={{ padding: '1.125rem 1.25rem' }}>
                            {row.varicentPhase1 === 'unsupported' ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] font-bold px-2 py-0.5 uppercase tracking-wide">
                                <X className="h-2.5 w-2.5" /> Unsupported
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-bold px-2 py-0.5 uppercase tracking-wide">
                                <Info className="h-2.5 w-2.5" /> Basic Calc
                              </span>
                            )}
                          </td>
                          <td className="text-center bg-primary/5" style={{ padding: '1.125rem 1.25rem' }}>
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold px-2 py-0.5 uppercase tracking-wide">
                              <Check className="h-2.5 w-2.5 font-bold" /> Fully Solved
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-border/10 bg-muted/20 text-xs text-muted-foreground leading-relaxed font-semibold" style={{ padding: '1.25rem 1.5rem' }}>
                  <strong>Assessment Verdict:</strong> Current Varicent roadmap will only act as an advanced compensation calculator once integrated. 
                  This Databricks App Extension is critical to make sure HGV realizes the full value of compensation intelligence, adding quota management, 
                  incentive forecasting, team insights, and direct seller-facing transparency.
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Requirements Alignment Map */}
          {activeTab === 'deck-map' && (
            <div className="space-y-6 animate-fade-in-up">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/10 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-foreground">IGNITE Assessment Alignment Matrix</h4>
                  <p className="text-xs text-muted-foreground font-medium">Exhaustive audit tracking industry assessment themes to live Lakehouse app features.</p>
                </div>
                <Badge variant="outline" className="border-primary/20 text-primary bg-primary/5 text-[9px] uppercase font-bold tracking-wider px-2">Full Requirements Audit</Badge>
              </div>

              {/* Spectacular Grid showing the 9 key sections */}
              <div className="space-y-4">
                {[
                  {
                    title: "1. Executive Summary & 10 Core Gaps",
                    scope: 'Part 1 · Executive Summary',
                    focus: "Operating flaws across Comp Design, Employee Experience, Governance, and Technology.",
                    finding: "Disjointed incentives, plan complexity, poor ramp-up, pay volatility, manual calculation errors.",
                    solved: "✨ Ignite Assessment: Displays all 10 gaps as glass cards with severity badges and specific Unity Catalog-backed solutions."
                  },
                  {
                    title: "2. Comp Design Approach & Benchmarks",
                    scope: 'Part 2 · Comp Design',
                    focus: "Competitive median benchmarks, TCC Positioning, and HGV's 8-point Design Framework.",
                    finding: "HGV pay mix is more variable-heavy than direct competitors; Director+ levels lag compared to broader market.",
                    solved: "⚡ Scenario Modeler: Standardized default projected payout parameters around this $14.2M baseline. Allows rebalancing mix side-by-side."
                  },
                  {
                    title: "3. Marketing Compensation Assessment",
                    scope: 'Part 3 · Marketing Comp',
                    focus: "Community/Off-Premise (OPC), In-House, site-level leadership, and Director/VP compensations.",
                    finding: "OPC is volume-heavy (40/60 mix) vs market (60/40 base-heavy); lead volume emphasis dilutes downstream quality.",
                    solved: "🎭 Marketing Sandbox: Renders custom marketing models with the dynamic Lead Quality Calculator to test showed rates, VPG, and A-Leads."
                  },
                  {
                    title: "4. Telemarketing Compensation Assessment",
                    scope: 'Part 4 · Telemarketing',
                    focus: "Call Center (C1), Inbound/Outbound agents, Activations/Reservations, and Concierges.",
                    finding: "Outbound package volume focus hurts tour quality; early-tenure income volatility drives extreme call center attrition.",
                    solved: "📞 Call Center Sandbox: Evaluates inbound package conversion curves and show rates, grounding the AI Copilot in policy rules."
                  },
                  {
                    title: "5. Sales Compensation & Takeovers",
                    scope: 'Part 5 · Sales & Takeovers',
                    focus: "Action Line, In-House, VIP Sales Executives, Player Coaches, and site-level Sales Managers/Directors.",
                    finding: "Frontline reps have high variable volatility; player-coaches step in for takeovers (TOs) and need exception authority.",
                    solved: "👥 Team Workspace: Sorting leaderboard highlights at-risk reps. Triggering 'Intervene' prompts the AI and deal takeover panel."
                  },
                  {
                    title: "6. Compensation Governance & CoE",
                    scope: 'Part 6 · Governance',
                    focus: "Site autonomy, localized SPIFF/STI creation, and shift to a centralized Center of Excellence (CoE).",
                    finding: "Same role gets different comp across sites; localized SPIFFs erode rep trust and lack corporate budget governance.",
                    solved: "💼 Comp Admin Desk: Enforces strict SPIFF budget ladders (Regional Dir <$15k, VP <$30k). Ingests audit logs with signature blocks."
                  },
                  {
                    title: "7. Enterprise Value Mapping & Data",
                    scope: 'Part 7 · Data & Security',
                    focus: "Integration between Salesforce, inventory, Callidus/Varicent monthly statements, and data security.",
                    finding: "Vite client/server disconnected; manual spreadsheet stitching exposes major risk of error and delayed reporting.",
                    solved: "📥 Varicent Ingestion: Config-driven manual flat-file ETL portal runs schema mapping and syncs rows straight to Delta Lake."
                  },
                  {
                    title: "8. Voice of the Employee (VotE) Survey",
                    scope: 'Part 8 · Voice of Employee',
                    focus: "Full-scale sentiment analysis representing 1,446 respondents across all management levels and seniority.",
                    finding: "Sales satisfaction lags by -0.41 lower competitiveness comfort; qualitative employee transcripts express target fatigue.",
                    solved: "📊 Sentiment Heatmap: Renders detailed Strengths (Clarity 4.41) vs Gaps (Quotas 3.02) with a beautiful Survey Quote Carousel."
                  },
                  {
                    title: "9. Technical Appendix & Reference Material",
                    scope: 'Part 9 · Appendix',
                    focus: "Stakeholder interview rosters, site process flows, full compensation catalog details, and detailed VotE charts.",
                    finding: "175+ plan variations require absolute standardization. Full audit lineage is required for governance compliance.",
                    solved: "🧬 Semantic Metrics: Lists governed Hilton Grand Vacations metadata metrics and previews the exact managed SQL views logic."
                  }
                ].map((sec, idx) => (
                  <div key={idx} className="glass-card flex flex-col justify-between hover:border-primary/20 transition-all duration-300" style={{ padding: '1.5rem 1.75rem' }}>
                    <div className="space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                        <h5 className="text-xs uppercase font-extrabold text-hgv-gold tracking-widest">{sec.title}</h5>
                        <span className="font-mono text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">{sec.scope}</span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3 text-xs leading-relaxed pt-2 border-t border-border/5">
                        <div>
                          <span className="font-bold text-foreground">Assessment Focus Area:</span>
                          <p className="mt-0.5 text-muted-foreground font-medium">{sec.focus}</p>
                        </div>
                        <div>
                          <span className="font-bold text-destructive">Audited Challenge:</span>
                          <p className="mt-0.5 text-muted-foreground font-medium">{sec.finding}</p>
                        </div>
                        <div className="sm:col-span-1 rounded-lg bg-primary/5 border border-primary/10 p-2.5">
                          <span className="font-bold text-primary">Fully Solved Feature:</span>
                          <p className="mt-0.5 text-foreground font-semibold">{sec.solved}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: IGNITE AI Corporate Analyst */}
        <div className="space-y-4">
          <div className="glass-card overflow-hidden">
            <div className="bg-primary/5 p-4 border-b border-border/10">
              <h4 className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                <Flame className="h-4 w-4 text-amber-500" />
                IGNITE Corporate Copilot
              </h4>
              <p className="text-[11px] mt-1 text-muted-foreground leading-relaxed font-medium">
                This analyst is fully grounded in the HGV IGNITE compensation assessment, including the 10 gaps, survey scores, employee quotes, and Varicent roadmap comparison.
              </p>
            </div>
            <div className="p-4">
              <CompCopilot
                title="IGNITE AI Analyst"
                description="Grounded in HGV - IGNITE assessment findings."
                personaLabel="Hilton Grand Vacations Compensation Analyst"
                dataContext={IGNITE_DATA_CONTEXT}
                storageKey="ignite_hub_analyst"
                examplePrompts={[
                  "What were the main Sales complaints?",
                  "Explain the Varicent ICM roadmap gaps",
                  "Compare HGV and Bluegreen comp sentiment",
                  "How does this app solve Gap #10?"
                ]}
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

