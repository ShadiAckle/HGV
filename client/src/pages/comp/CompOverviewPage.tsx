import { Badge } from '@databricks/appkit-ui/react';
import { Link } from 'react-router';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  Settings,
  ShieldCheck,
  Award,
} from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import { useMemo } from 'react';

interface ViewCard {
  route: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge: string;
  badgeVariant: 'default' | 'secondary' | 'outline' | 'destructive';
  hasLiveData: boolean;
  navId: string;
  isSpecial?: boolean;
}

export function CompOverviewPage() {
  const { isManager } = useAppContext();

  const viewCards = useMemo<ViewCard[]>(() => {
    const list: ViewCard[] = [
      {
        route: '/my-compensation',
        icon: <TrendingUp className="h-5 w-5 text-emerald-400" />,
        title: 'My Commission & Sales Earnings',
        description: 'Check your active commission rate, review recent closed contracts, and track how close you are to your next big booster.',
        badge: 'My Earnings',
        badgeVariant: 'outline',
        hasLiveData: true,
        navId: 'overview-link-my-comp',
        isSpecial: true,
      },
    ];

    if (isManager) {
      list.push({
        route: '/team',
        icon: <BarChart3 className="h-5 w-5 text-sky-400" />,
        title: 'Team Performance Hub',
        description: "Track your team's total sales, view the active rep leaderboard, and see individual progress.",
        badge: 'Team Insights',
        badgeVariant: 'secondary',
        hasLiveData: true,
        navId: 'overview-link-team',
      });
      
      list.push({
        route: '/admin-console',
        icon: <Settings className="h-5 w-5 text-amber-400" />,
        title: 'Plan Designer Controls',
        description: 'Design future commission rates, model sales scenarios, and explore standard metrics.',
        badge: 'Strategy Room',
        badgeVariant: 'default',
        hasLiveData: true,
        navId: 'overview-link-admin-console',
      });
    }

    return list;
  }, [isManager]);

  return (
    <div className="space-y-16 animate-fade-in-up">
      {/* Premium Hero Panel */}
      <div className="relative overflow-hidden rounded-3xl border border-glass-border bg-glass-bg backdrop-blur-xl p-8 sm:p-10 shadow-xl animate-glow-pulse">
        <div className="absolute -right-10 -top-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 h-48 w-48 rounded-full bg-secondary-foreground/5 blur-3xl pointer-events-none" />
        
        <div className="relative space-y-4 max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-primary border border-primary/20">
            <Sparkles className="h-3 w-3 text-gold-light" />
            IGNITE · SALES DASHBOARD
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Sales Compensation <span className="text-sapphire-gradient">Hub</span>
          </h1>
          <p className="text-sm sm:text-base leading-relaxed text-muted-foreground font-medium">
            Welcome to your sales earnings hub! Here you can check your closed contracts, track your active commission tier, and watch your paycheck grow as you smash your sales goals.
          </p>
          
          <div className="flex flex-wrap gap-2.5 pt-3">
            <Badge variant="outline" className="gap-1.5 font-semibold text-xs py-1 px-3 border-glass-border bg-background/50">
              <Award className="h-3.5 w-3.5 text-primary" aria-hidden />
              Live System Sync
            </Badge>
            <Badge variant="outline" className="gap-1.5 font-semibold text-xs py-1 px-3 border-glass-border bg-background/50">
              <CheckCircle2 className="h-3.5 w-3.5 text-success-foreground" aria-hidden />
              Earnings Synced Daily
            </Badge>
          </div>
        </div>
      </div>

      {/* View Cards Grid */}
      <section aria-labelledby="views-heading" className="space-y-6">
        <div className="flex items-center justify-between border-b border-border/10 pb-4">
          <h3
            id="views-heading"
            className="text-xs font-black uppercase tracking-[0.25em] text-muted-foreground"
          >
            My Sales Tools
          </h3>
          <span className="text-[11px] font-medium text-muted-foreground/60">Select a section to open your dashboard</span>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {viewCards.map((card) => (
            <div
              key={card.route}
              className={`group flex flex-col justify-between ${
                card.isSpecial ? 'glass-card-gold ring-1 ring-secondary-foreground/20' : 'glass-card'
              } h-full relative overflow-hidden`}
              style={{ padding: '2.5rem 2rem' }}
            >
              {card.isSpecial && (
                <div className="absolute top-0 right-0 h-16 w-16 pointer-events-none">
                  <div className="absolute top-2 right-[-24px] rotate-45 bg-gradient-to-r from-hgv-gold to-hgv-gold-light text-[8px] font-black text-black py-0.5 px-6 text-center shadow-sm">
                    CORE
                  </div>
                </div>
              )}

              <div className="flex-grow flex flex-col">
                <div className="flex items-start justify-between mb-8">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                      card.hasLiveData
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'bg-muted/40 text-muted-foreground border border-border/10'
                    }`}
                  >
                    {card.icon}
                  </div>
                  <Badge
                    variant={card.badgeVariant}
                    className={`text-[10px] font-extrabold uppercase px-2.5 py-1 tracking-wider ${
                      card.isSpecial 
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' 
                        : ''
                    }`}
                  >
                    {card.badge}
                  </Badge>
                </div>
                <div>
                  <h4 className="text-xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors duration-200">
                    {card.title}
                  </h4>
                  <p className="mt-3.5 text-sm leading-relaxed text-muted-foreground font-medium">
                    {card.description}
                  </p>
                </div>
              </div>

              <div className="mt-8 pt-5 border-t border-border/10">
                <Link
                  id={card.navId}
                  to={card.route}
                  className={`inline-flex items-center gap-1.5 text-xs font-bold transition-all duration-300 ${
                    card.isSpecial 
                      ? 'text-hgv-gold-light hover:text-hgv-gold hover:gap-2.5' 
                      : 'text-primary hover:text-hgv-blue-light hover:gap-2.5'
                  }`}
                >
                  Open Dashboard
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Platform Pillars */}
      <section 
        aria-labelledby="pillars-heading" 
        className="space-y-8"
        style={{ marginTop: '4.5rem' }}
      >
        <div className="border-b border-border/10 pb-4">
          <h3
            id="pillars-heading"
            className="text-xs font-black uppercase tracking-[0.25em] text-muted-foreground"
          >
            Sales Rep Guidance
          </h3>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          <div 
            className="glass-card flex flex-col justify-between"
            style={{ padding: '2rem 1.75rem' }}
          >
            <div>
              <h4 className="text-base font-bold text-foreground mb-3">Clear Commissions</h4>
              <p className="text-sm leading-relaxed text-muted-foreground font-medium">
                See exactly how every closed contract translates into dollars on your paycheck. Zero guesswork.
              </p>
            </div>
            <div className="mt-6 text-xs uppercase font-bold tracking-wider text-primary">Easy Review</div>
          </div>

          <div 
            className="glass-card flex flex-col justify-between"
            style={{ padding: '2rem 1.75rem' }}
          >
            <div>
              <h4 className="text-base font-bold text-foreground mb-3">Commission Boosters</h4>
              <p className="text-sm leading-relaxed text-muted-foreground font-medium">
                Know exactly how close you are to stepping up your commission rate and unlocking higher payouts.
              </p>
            </div>
            <div className="mt-6 text-xs uppercase font-bold tracking-wider text-primary">Maximize Earnings</div>
          </div>

          <div 
            className="glass-card flex flex-col justify-between"
            style={{ padding: '2rem 1.75rem' }}
          >
            <div>
              <h4 className="text-base font-bold text-foreground mb-3">Instant Payout Answers</h4>
              <p className="text-sm leading-relaxed text-muted-foreground font-medium">
                Ask our built-in AI Copilot anything about your payouts, missing credits, or how to hit your next tier.
              </p>
            </div>
            <div className="mt-6 text-xs uppercase font-bold tracking-wider text-primary">AI Payout Advisor</div>
          </div>
        </div>
      </section>

      {/* Governance Banner */}
      <div 
        className="rounded-2xl border border-glass-border bg-glass-bg backdrop-blur-md"
        style={{ padding: '2.25rem 2rem', marginTop: '4.5rem' }}
      >
        <div className="flex items-start gap-5">
          <div className="p-3.5 bg-primary/10 rounded-xl text-primary border border-primary/20 flex-shrink-0">
            <ShieldCheck className="h-6 w-6" aria-hidden />
          </div>
          <div className="space-y-2">
            <h4 className="text-base font-bold text-foreground">Official Earnings Record</h4>
            <p className="text-sm leading-relaxed text-muted-foreground font-medium">
              Your commission data is synced nightly from official sales records, ensuring 100% verified and secure payout tracking.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
