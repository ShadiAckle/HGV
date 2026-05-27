import { useNavigate } from 'react-router';
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
import { usePlainLanguage } from '@/hooks/usePlainLanguage';
import { SimpleViewAskButtons, SimpleViewCollapsible } from '@/components/comp/simpleView';

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

const OVERVIEW_ASK_PROMPTS = [
  'What do I need to know about my pay today?',
  'Am I on track for my sales goal this quarter?',
  'How close am I to my next commission pay bump?',
] as const;

export function CompOverviewPage() {
  const { isManager } = useAppContext();
  const { enabled: simpleView } = usePlainLanguage();
  const navigate = useNavigate();

  const viewCards = useMemo<ViewCard[]>(() => {
    const list: ViewCard[] = [
      {
        route: '/my-compensation',
        icon: <TrendingUp className="h-5 w-5 text-emerald-400" />,
        title: simpleView ? 'My Pay & Commissions' : 'My Commission & Sales Earnings',
        description: simpleView
          ? 'See what you earned, how close you are to your goal, and what to do next.'
          : 'Check your active commission rate, review recent closed contracts, and track how close you are to your next big booster.',
        badge: simpleView ? 'Start Here' : 'My Earnings',
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
        title: simpleView ? 'Team Scoreboard' : 'Team Performance Hub',
        description: simpleView
          ? 'See who is ahead or behind on the team sales goal.'
          : "Track your team's total sales, view the active rep leaderboard, and see individual progress.",
        badge: simpleView ? 'Manager' : 'Team Insights',
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
  }, [isManager, simpleView]);

  function handleAsk(prompt: string) {
    try {
      sessionStorage.setItem('hgv_copilot_seed', prompt);
    } catch {
      /* ignore */
    }
    navigate('/my-compensation');
  }

  return (
    <div className="space-y-16 animate-fade-in-up">
      {/* Premium Hero Panel */}
      <div className="relative overflow-hidden rounded-3xl border border-glass-border bg-glass-bg backdrop-blur-xl p-8 sm:p-10 shadow-xl animate-glow-pulse">
        <div className="absolute -right-10 -top-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 bottom-0 h-48 w-48 rounded-full bg-secondary-foreground/5 blur-3xl pointer-events-none" />

        <div className="relative space-y-4 max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-primary border border-primary/20">
            <Sparkles className="h-3 w-3 text-gold-light" />
            {simpleView ? 'IGNITE · SIMPLE VIEW' : 'IGNITE · SALES DASHBOARD'}
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            {simpleView ? (
              <>Your Pay <span className="text-sapphire-gradient">Made Simple</span></>
            ) : (
              <>Sales Compensation <span className="text-sapphire-gradient">Hub</span></>
            )}
          </h1>
          <p className="text-sm sm:text-base leading-relaxed text-muted-foreground font-medium">
            {simpleView
              ? 'Three things matter: what you earned, whether you are on track, and what to do next. Open My Pay or tap a question below.'
              : 'Welcome to your sales earnings hub! Here you can check your closed contracts, track your active commission tier, and watch your paycheck grow as you smash your sales goals.'}
          </p>

          <div className="flex flex-wrap gap-2.5 pt-3">
            <Badge variant="outline" className="gap-1.5 font-semibold text-xs py-1 px-3 border-glass-border bg-background/50">
              <Award className="h-3.5 w-3.5 text-primary" aria-hidden />
              {simpleView ? 'Live Pay Numbers' : 'Live System Sync'}
            </Badge>
            <Badge variant="outline" className="gap-1.5 font-semibold text-xs py-1 px-3 border-glass-border bg-background/50">
              <CheckCircle2 className="h-3.5 w-3.5 text-success-foreground" aria-hidden />
              Earnings Synced Daily
            </Badge>
          </div>
        </div>
      </div>

      <SimpleViewAskButtons prompts={OVERVIEW_ASK_PROMPTS} onSelect={handleAsk} />

      {/* View Cards Grid */}
      <section aria-labelledby="views-heading" className="space-y-6">
        <div className="flex items-center justify-between border-b border-border/10 pb-4">
          <h3
            id="views-heading"
            className="text-xs font-black uppercase tracking-[0.25em] text-muted-foreground"
          >
            {simpleView ? 'Where to Go' : 'My Sales Tools'}
          </h3>
          <span className="text-[11px] font-medium text-muted-foreground/60">
            {simpleView ? 'Pick one — details stay available if you need them' : 'Select a section to open your dashboard'}
          </span>
        </div>

        <div className={`grid gap-8 ${simpleView ? 'sm:grid-cols-1 lg:max-w-xl' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
          {(simpleView ? viewCards.filter((c) => c.isSpecial) : viewCards).map((card) => (
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
                  {simpleView ? 'Open My Pay' : 'Open Dashboard'}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden />
                </Link>
              </div>
            </div>
          ))}
        </div>

        {simpleView && isManager && viewCards.length > 1 && (
          <SimpleViewCollapsible title="Manager tools" subtitle="Team coaching and strategy rooms">
            <div className="grid gap-4 sm:grid-cols-2">
              {viewCards.filter((c) => !c.isSpecial).map((card) => (
                <Link
                  key={card.route}
                  to={card.route}
                  className="glass-card block p-5 transition-colors hover:border-primary/30"
                >
                  <div className="font-bold text-foreground">{card.title}</div>
                  <p className="mt-2 text-xs text-muted-foreground">{card.description}</p>
                </Link>
              ))}
            </div>
          </SimpleViewCollapsible>
        )}
      </section>

      <SimpleViewCollapsible title="Tips for using the app" subtitle="Optional — how commissions and boosters work">
      {/* Platform Pillars */}
      <section
        aria-labelledby="pillars-heading"
        className="space-y-8"
      >
        <div className="border-b border-border/10 pb-4">
          <h3
            id="pillars-heading"
            className="text-xs font-black uppercase tracking-[0.25em] text-muted-foreground"
          >
            {simpleView ? 'Quick Tips' : 'Sales Rep Guidance'}
          </h3>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          <div
            className="glass-card flex flex-col justify-between"
            style={{ padding: '2rem 1.75rem' }}
          >
            <div>
              <h4 className="text-base font-bold text-foreground mb-3">
                {simpleView ? 'See Your Pay' : 'Clear Commissions'}
              </h4>
              <p className="text-sm leading-relaxed text-muted-foreground font-medium">
                {simpleView
                  ? 'Every dollar ties to a deal you closed. If something looks wrong, ask the advisor.'
                  : 'See exactly how every closed contract translates into dollars on your paycheck. Zero guesswork.'}
              </p>
            </div>
            <div className="mt-6 text-xs uppercase font-bold tracking-wider text-primary">
              {simpleView ? 'Check My Pay' : 'Easy Review'}
            </div>
          </div>

          <div
            className="glass-card flex flex-col justify-between"
            style={{ padding: '2rem 1.75rem' }}
          >
            <div>
              <h4 className="text-base font-bold text-foreground mb-3">
                {simpleView ? 'Hit Your Next Level' : 'Commission Boosters'}
              </h4>
              <p className="text-sm leading-relaxed text-muted-foreground font-medium">
                {simpleView
                  ? 'The app shows how much more you need to sell to bump your pay rate.'
                  : 'Know exactly how close you are to stepping up your commission rate and unlocking higher payouts.'}
              </p>
            </div>
            <div className="mt-6 text-xs uppercase font-bold tracking-wider text-primary">
              {simpleView ? 'Watch the Green Bar' : 'Maximize Earnings'}
            </div>
          </div>

          <div
            className="glass-card flex flex-col justify-between"
            style={{ padding: '2rem 1.75rem' }}
          >
            <div>
              <h4 className="text-base font-bold text-foreground mb-3">
                {simpleView ? 'Just Ask' : 'Instant Payout Answers'}
              </h4>
              <p className="text-sm leading-relaxed text-muted-foreground font-medium">
                {simpleView
                  ? 'Tap a question instead of reading tables — the advisor uses your real numbers.'
                  : 'Ask our built-in AI Copilot anything about your payouts, missing credits, or how to hit your next tier.'}
              </p>
            </div>
            <div className="mt-6 text-xs uppercase font-bold tracking-wider text-primary">
              {simpleView ? 'Use the Buttons Above' : 'AI Payout Advisor'}
            </div>
          </div>
        </div>
      </section>
      </SimpleViewCollapsible>

      <SimpleViewCollapsible title="About your official earnings record" subtitle="How numbers stay accurate and secure">
      {/* Governance Banner */}
      <div
        className="rounded-2xl border border-glass-border bg-glass-bg backdrop-blur-md"
        style={{ padding: '2.25rem 2rem' }}
      >
        <div className="flex items-start gap-5">
          <div className="p-3.5 bg-primary/10 rounded-xl text-primary border border-primary/20 flex-shrink-0">
            <ShieldCheck className="h-6 w-6" aria-hidden />
          </div>
          <div className="space-y-2">
            <h4 className="text-base font-bold text-foreground">Official Earnings Record</h4>
            <p className="text-sm leading-relaxed text-muted-foreground font-medium">
              {simpleView
                ? 'Your pay numbers sync every night from official sales records — same source as payroll.'
                : 'Your commission data is synced nightly from official sales records, ensuring 100% verified and secure payout tracking.'}
            </p>
          </div>
        </div>
      </div>
      </SimpleViewCollapsible>
    </div>
  );
}
