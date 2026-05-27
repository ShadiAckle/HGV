import { useState, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Search, User, Users, Landmark, Briefcase, Plus, BookOpen, X } from 'lucide-react';
import { formatCurrency } from '@/lib/compFormat';

interface VisualMentionLibraryProps {
  onSelectMention: (tag: string) => void;
  onClose?: () => void;
}

interface UnifiedMentionItem {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  details: string;
  category: 'Reps' | 'Teams' | 'Scenarios' | 'Deals';
  icon: typeof User;
  badgeClass: string;
  borderClass: string;
}

export function VisualMentionLibrary({ onSelectMention, onClose }: VisualMentionLibraryProps) {
  const { metadata, loadingMetadata } = useAppContext();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'rep' | 'team' | 'scenario' | 'deal'>('all');

  // Map warehouse metadata into unified mention entities (no offline mock fallbacks).
  const unifiedItems = useMemo<UnifiedMentionItem[]>(() => {
    const list: UnifiedMentionItem[] = [];

    (metadata?.reps ?? []).forEach((r) => {
      list.push({
        id: r.rep_id,
        tag: `rep:${r.rep_id}`,
        title: r.rep_name,
        subtitle: r.rep_id,
        details: `Level ${r.level_code} · ${r.region} Region`,
        category: 'Reps',
        icon: User,
        badgeClass: 'bg-primary/10 text-primary border-primary/20',
        borderClass: 'hover:border-primary/45 hover:shadow-primary/5',
      });
    });

    (metadata?.teams ?? []).forEach((t) => {
      list.push({
        id: t.team_id,
        tag: `team:${t.team_id}`,
        title: t.team_name,
        subtitle: t.team_id,
        details: `${t.region} Territory`,
        category: 'Teams',
        icon: Users,
        badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        borderClass: 'hover:border-emerald-500/40 hover:shadow-emerald-500/5',
      });
    });

    (metadata?.scenarios ?? []).forEach((s) => {
      list.push({
        id: s.scenario_id,
        tag: `scenario:${s.scenario_id}`,
        title: s.scenario_name,
        subtitle: s.scenario_id,
        details: `Period: ${s.period_id}`,
        category: 'Scenarios',
        icon: Landmark,
        badgeClass: 'bg-amber-500/10 text-hgv-gold border-amber-500/20',
        borderClass: 'hover:border-amber-500/40 hover:shadow-amber-500/5',
      });
    });

    (metadata?.deals ?? []).forEach((d) => {
      const formattedAmt = typeof d.amount === 'number' ? formatCurrency(d.amount) : `$${Number(d.amount || 0).toLocaleString()}`;
      list.push({
        id: d.deal_id,
        tag: `deal:${d.deal_id}`,
        title: d.description || 'Villas Contract Credit',
        subtitle: d.deal_id,
        details: `${formattedAmt} · Status: ${d.status}`,
        category: 'Deals',
        icon: Briefcase,
        badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        borderClass: 'hover:border-purple-500/40 hover:shadow-purple-500/5',
      });
    });

    return list;
  }, [metadata]);

  // Filtering based on search query and active tab selection
  const filteredItems = useMemo(() => {
    return unifiedItems.filter((item) => {
      // Tab matching
      if (activeTab === 'rep' && item.category !== 'Reps') return false;
      if (activeTab === 'team' && item.category !== 'Teams') return false;
      if (activeTab === 'scenario' && item.category !== 'Scenarios') return false;
      if (activeTab === 'deal' && item.category !== 'Deals') return false;

      // Search matching
      const query = search.trim().toLowerCase();
      if (!query) return true;

      return (
        item.title.toLowerCase().includes(query) ||
        item.subtitle.toLowerCase().includes(query) ||
        item.details.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
      );
    });
  }, [unifiedItems, activeTab, search]);

  const counts = useMemo(() => {
    const list = unifiedItems;
    return {
      all: list.length,
      rep: list.filter((i) => i.category === 'Reps').length,
      team: list.filter((i) => i.category === 'Teams').length,
      scenario: list.filter((i) => i.category === 'Scenarios').length,
      deal: list.filter((i) => i.category === 'Deals').length,
    };
  }, [unifiedItems]);

  return (
    <div className="flex flex-col h-full min-h-[22rem] max-h-[36rem] rounded-xl border border-glass-border bg-glass-bg/60 backdrop-blur-xl shadow-lg w-full text-foreground overflow-hidden">
      {/* Drawer Header */}
      <div className="flex items-center justify-between border-b border-glass-border bg-gradient-to-r from-primary/5 to-transparent px-5 py-4 shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h5 className="text-xs font-bold text-foreground">Mention Library</h5>
          <span className="text-[9px] font-black bg-primary/10 text-primary border border-primary/20 rounded px-1 uppercase">
            Live catalog
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close mention library"
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted/10 hover:text-foreground transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Discover Search bar */}
      <div className="p-4 border-b border-glass-border space-y-3.5 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rep names, scenarios, deal IDs…"
            className="w-full rounded-lg border border-glass-border bg-card/20 pl-8 pr-3 py-1.5 text-xs outline-none placeholder:text-muted-foreground/40 focus:border-primary/50 focus:bg-card/30 focus:ring-1 focus:ring-primary/20 transition-all font-medium"
          />
        </div>

        {/* Categories Tab selector bar */}
        <div className="flex gap-1 overflow-x-auto pb-0.5 no-scrollbar">
          {(['all', 'rep', 'team', 'scenario', 'deal'] as const).map((tab) => {
            const label = tab === 'all' ? 'All' : tab === 'rep' ? 'Reps' : tab === 'team' ? 'Teams' : tab === 'scenario' ? 'Scenarios' : 'Deals';
            const count = counts[tab];
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-lg px-2 py-1 text-[10px] font-bold shrink-0 transition-all uppercase tracking-wider border ${
                  active
                    ? 'bg-primary border-primary/30 text-primary-foreground shadow-md shadow-primary/10'
                    : 'border-glass-border hover:bg-muted/15 text-muted-foreground'
                }`}
              >
                {label} <span className="opacity-60">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid listing */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 chat-scroll bg-card/5">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-6 space-y-1.5 h-full">
            <Search className="h-6 w-6 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground font-semibold">No entities found</p>
            <p className="text-[10px] text-muted-foreground/60">Try searching for a different keyword or tab.</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.tag}
                type="button"
                onClick={() => onSelectMention(item.tag)}
                className={`w-full text-left rounded-xl border border-glass-border bg-card/30 p-3 flex items-center justify-between gap-3 transition-all ${item.borderClass} group hover:bg-primary/5`}
              >
                <div className="min-w-0 flex-1 flex items-start gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-card/65 border border-glass-border text-muted-foreground group-hover:text-primary transition-colors">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-mono text-muted-foreground bg-muted/30 px-1 border border-glass-border rounded uppercase">
                        @{item.tag}
                      </span>
                      <span className="text-[10px] text-muted-foreground/75 truncate">{item.details}</span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1.5">
                  <span className={`text-[8px] font-black border rounded-full px-2 py-0.5 uppercase tracking-wider ${item.badgeClass}`}>
                    {item.category}
                  </span>
                  <div className="h-6 w-6 rounded-lg border border-glass-border bg-card/75 text-muted-foreground flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 hover:bg-primary hover:text-white">
                    <Plus className="h-3.5 w-3.5" />
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {loadingMetadata && (
        <div className="absolute inset-0 bg-[#090d16]/30 backdrop-blur-sm flex items-center justify-center">
          <div className="flex items-center gap-2 rounded-xl border border-glass-border bg-card p-3 shadow-lg text-xs font-bold">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
            Synchronizing catalog…
          </div>
        </div>
      )}
    </div>
  );
}
