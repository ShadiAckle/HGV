import { useMemo, useState } from 'react';
import { BookOpen, Database, Filter, Layers, Link2, Search } from 'lucide-react';
import type { DataDomainTag } from '@/data/marketingDataModel';
import { GOVERNED_SEMANTIC_METRICS, type GovernedMetric } from '@/data/governedSemanticMetrics';

const CATEGORY_COLORS: Record<string, string> = {
  KPI: 'bg-primary/10 text-primary border-primary/20',
  Measure: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  Dimension: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
  Calculated: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
};

function MetricCard({ metric }: { metric: GovernedMetric }) {
  const colorClass = CATEGORY_COLORS[metric.category] ?? 'bg-muted text-muted-foreground border-border/10';

  return (
    <div className="glass-card space-y-3" style={{ padding: '1.5rem 1.25rem' }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${colorClass}`}>
              {metric.category}
            </span>
            <span className="font-mono text-[9px] text-muted-foreground/60">{metric.metricId}</span>
          </div>
          <h4 className="mt-1.5 text-sm font-extrabold text-foreground">{metric.displayName}</h4>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{metric.description}</p>
        </div>
      </div>

      <div className="rounded-xl border border-glass-border bg-card/30 px-3 py-2">
        <div className="text-[9px] font-bold uppercase text-muted-foreground/70">SQL / Expression</div>
        <p className="mt-1 font-mono text-[10px] leading-relaxed text-foreground/80 break-all">{metric.sqlExpression}</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 text-[10px]">
        <div>
          <div className="mb-1 flex items-center gap-1 font-bold uppercase tracking-wider text-muted-foreground/70">
            <Database className="h-3 w-3" /> Source Tables
          </div>
          {metric.sourceTables.map((t) => (
            <div key={t} className="font-mono text-primary/90">{t}</div>
          ))}
          <div className="mt-1 text-muted-foreground/60">Grain: {metric.grain}</div>
        </div>
        <div>
          <div className="mb-1 flex items-center gap-1 font-bold uppercase tracking-wider text-muted-foreground/70">
            <Link2 className="h-3 w-3" /> Wired To
          </div>
          <div className="font-mono text-emerald-400/90">{metric.apiEndpoint}</div>
          <div className="mt-2 flex flex-wrap gap-1">
            {metric.uiSurfaces.map((ui) => (
              <span key={ui} className="rounded bg-muted/30 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                {ui}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SemanticLayerPage() {
  const [activeDomain, setActiveDomain] = useState<DataDomainTag>('Marketing');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'All' | GovernedMetric['category']>('All');

  const metrics = useMemo(() => {
    return GOVERNED_SEMANTIC_METRICS.filter((m) => {
      if (m.domain !== activeDomain) return false;
      if (category !== 'All' && m.category !== category) return false;
      const q = search.toLowerCase();
      if (!q) return true;
      return (
        m.displayName.toLowerCase().includes(q) ||
        m.metricId.toLowerCase().includes(q) ||
        m.sourceTables.some((t) => t.toLowerCase().includes(q)) ||
        m.apiEndpoint.toLowerCase().includes(q)
      );
    });
  }, [activeDomain, category, search]);

  const categories = ['All', 'KPI', 'Measure', 'Dimension', 'Calculated'] as const;

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="relative overflow-hidden rounded-3xl border border-border/15 glass-panel p-8">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-500/10 via-transparent to-primary/10 opacity-50" />
        <div className="relative z-10 max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/25 bg-sky-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-400">
            <BookOpen className="h-3.5 w-3.5" /> Governed Semantic Layer
          </span>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-foreground">Semantic Metrics Catalog</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Every metric below maps to a Delta table column contract, a live API route, and an existing UI surface.
            When you build production imports, populate the source tables documented in{' '}
            <strong className="text-foreground">Data Model & Ingestion</strong> — these metrics will resolve automatically.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2 p-1.5 rounded-2xl bg-muted/20 border border-border/10 w-fit">
          {(['Marketing', 'Finance', 'Sales', 'Call Center'] as DataDomainTag[]).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveDomain(tag)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                activeDomain === tag
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              {tag}
            </button>
          ))}
        </div>

        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search metrics, tables, APIs…"
            className="w-full rounded-xl border border-border/15 bg-card/40 py-2.5 pl-10 pr-4 text-xs outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide cursor-pointer transition-colors ${
              category === cat ? 'bg-primary text-primary-foreground' : 'bg-muted/30 text-muted-foreground hover:text-foreground'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {activeDomain !== 'Marketing' && activeDomain !== 'Finance' ? (
        <div className="rounded-3xl border border-dashed border-border/25 py-16 text-center text-muted-foreground">
          {activeDomain} semantic metrics will be added when that domain goes live.
        </div>
      ) : metrics.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">No metrics match your filters.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {metrics.map((m) => (
            <MetricCard key={m.metricId} metric={m} />
          ))}
        </div>
      )}

      <div className="rounded-xl border border-border/15 bg-muted/10 px-4 py-3 text-[11px] text-muted-foreground">
        <strong className="text-foreground">Registry note:</strong> Custom definitions can still be stored in{' '}
        <code className="font-mono text-primary">workspace.hgv_comp.semantic_definitions</code> for AI copilot grounding,
        but all production UI KPIs are driven by the governed catalog above and the Data Model table contracts.
      </div>
    </div>
  );
}
