import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Database,
  GitBranch,
  Layers,
  Sparkles,
  Table2,
  Workflow,
  AlertTriangle,
  CheckCircle2,
  Link2,
} from 'lucide-react';
import {
  DATA_DOMAIN_MODELS,
  type DataDomainTag,
  type ModelTable,
  type EtlStage,
} from '@/data/marketingDataModel';
import { API_UI_BINDINGS } from '@/data/governedSemanticMetrics';

const LAYER_STYLE: Record<ModelTable['layer'], { bg: string; border: string; badge: string; label: string }> = {
  dimension: {
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.35)',
    badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    label: 'Dimension',
  },
  fact: {
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.35)',
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    label: 'Fact',
  },
  reference: {
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.35)',
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    label: 'Reference',
  },
  scenario: {
    bg: 'rgba(168,85,247,0.08)',
    border: 'rgba(168,85,247,0.35)',
    badge: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    label: 'Scenario',
  },
};

function PipelineStage({ stage, index, total }: { stage: EtlStage; index: number; total: number }) {
  return (
    <div className="flex items-stretch gap-0 min-w-0 flex-1">
      <div
        className={`relative flex-1 rounded-2xl border p-5 transition-all duration-300 ${
          stage.highlight
            ? 'border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-primary/5 shadow-lg shadow-amber-500/5'
            : 'border-border/20 bg-card/40'
        }`}
      >
        {stage.highlight && (
          <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-400">
            <Sparkles className="h-3 w-3" /> Data Engineering Core
          </span>
        )}
        <div className="mb-3 flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black"
            style={{
              background: stage.highlight ? 'linear-gradient(135deg, var(--gold), var(--gold-light))' : 'var(--primary-muted)',
              color: stage.highlight ? '#000' : 'var(--primary)',
            }}
          >
            {index + 1}
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">{stage.title}</div>
            <div className="text-[10px] text-muted-foreground">{stage.subtitle}</div>
          </div>
        </div>
        <div className="space-y-2.5">
          <PipelineList label="Inputs" items={stage.inputs} color="var(--primary)" />
          <PipelineList label="Transforms" items={stage.transforms} color="var(--gold)" />
          <PipelineList label="Outputs" items={stage.outputs} color="var(--success)" />
        </div>
      </div>
      {index < total - 1 && (
        <div className="flex shrink-0 items-center px-2 text-muted-foreground/40">
          <ArrowRight className="h-5 w-5" />
        </div>
      )}
    </div>
  );
}

function PipelineList({ label, items, color }: { label: string; items: string[]; color: string }) {
  return (
    <div>
      <div className="mb-1 text-[9px] font-bold uppercase tracking-wider" style={{ color }}>
        {label}
      </div>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-1.5 text-[10px] leading-snug text-muted-foreground">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: color }} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EntityCard({
  table,
  selected,
  onSelect,
}: {
  table: ModelTable;
  selected: boolean;
  onSelect: () => void;
}) {
  const style = LAYER_STYLE[table.layer];
  const isPlanAssignment = table.id === 'fact_plan_eligibility';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group w-full rounded-xl border text-left transition-all duration-200 cursor-pointer ${
        selected ? 'ring-2 ring-primary/50 scale-[1.02]' : 'hover:scale-[1.01] hover:shadow-md'
      } ${isPlanAssignment ? 'ring-1 ring-amber-500/40' : ''}`}
      style={{ background: style.bg, borderColor: isPlanAssignment ? 'rgba(245,158,11,0.5)' : style.border, padding: '0.875rem 1rem' }}
    >
      {isPlanAssignment && (
        <span className="mb-2 inline-flex rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[8px] font-bold uppercase text-amber-400">
          Rep to Plan mapping
        </span>
      )}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-mono text-[11px] font-bold text-foreground">{table.name}</div>
          <div className="mt-0.5 text-[9px] text-muted-foreground">{table.grain}</div>
        </div>
        <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[8px] font-bold uppercase ${style.badge}`}>
          {style.label}
        </span>
      </div>
      <div className="space-y-0.5 border-t border-border/10 pt-2">
        {table.columns.slice(0, 4).map((col) => (
          <div key={col.name} className="flex items-center justify-between gap-2 font-mono text-[9px]">
            <span className="truncate text-foreground/90">
              {col.key === 'PK' && <span className="mr-1 text-amber-400">PK</span>}
              {col.key === 'FK' && <span className="mr-1 text-blue-400">FK</span>}
              {col.name}
            </span>
            <span className="shrink-0 text-muted-foreground/60">{col.type}</span>
          </div>
        ))}
      </div>
    </button>
  );
}

function TableDetailPanel({ table }: { table: ModelTable }) {
  const style = LAYER_STYLE[table.layer];
  return (
    <div className="rounded-2xl border border-border/15 bg-card/45 p-5 animate-fade-in-up">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className={`inline-flex rounded-md border px-2 py-0.5 text-[9px] font-bold uppercase ${style.badge}`}>
            {style.label}
          </span>
          <h4 className="mt-2 font-mono text-base font-bold text-foreground">{table.name}</h4>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">{table.purpose}</p>
        </div>
        <div className="rounded-lg border border-border/15 bg-muted/20 px-3 py-2 text-right">
          <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Seeded By</div>
          <div className="font-mono text-[10px] text-primary">{table.seededBy}</div>
        </div>
      </div>
      {(table.apiEndpoints?.length || table.uiSurfaces?.length) ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {table.apiEndpoints && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="mb-1 text-[9px] font-bold uppercase text-primary">API Endpoints</div>
              {table.apiEndpoints.map((ep) => (
                <div key={ep} className="font-mono text-[10px] text-foreground/90">{ep}</div>
              ))}
            </div>
          )}
          {table.uiSurfaces && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="mb-1 text-[9px] font-bold uppercase text-amber-400">UI Surfaces</div>
              {table.uiSurfaces.map((ui) => (
                <div key={ui} className="text-[10px] text-foreground/90">{ui}</div>
              ))}
            </div>
          )}
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-border/10">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border/10 bg-muted/20">
              <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Column</th>
              <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Type</th>
              <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Key</th>
              <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Notes</th>
            </tr>
          </thead>
          <tbody>
            {table.columns.map((col) => (
              <tr key={col.name} className="border-b border-border/5 hover:bg-muted/10">
                <td className="px-3 py-2 font-mono text-[11px] text-foreground">{col.name}</td>
                <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{col.type}</td>
                <td className="px-3 py-2">
                  {col.key && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                        col.key === 'PK' ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400'
                      }`}
                    >
                      {col.key}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-[10px] text-muted-foreground">{col.note ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DataModelIngestionPage() {
  const [activeDomain, setActiveDomain] = useState<DataDomainTag>('Marketing');
  const [selectedTableId, setSelectedTableId] = useState<string>('fact_plan_eligibility');

  const domain = useMemo(() => DATA_DOMAIN_MODELS.find((d) => d.tag === activeDomain)!, [activeDomain]);
  const selectedTable = domain.tables.find((t) => t.id === selectedTableId) ?? domain.tables[0];

  const dims = domain.tables.filter((t) => t.layer === 'dimension');
  const facts = domain.tables.filter((t) => t.layer === 'fact');
  const refs = domain.tables.filter((t) => t.layer === 'reference' || t.layer === 'scenario');

  const domainBindings = API_UI_BINDINGS.filter((b) =>
    domain.tables.some((t) => b.table.includes(t.name)),
  );

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="relative overflow-hidden rounded-3xl border border-border/15 glass-panel p-8">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-amber-500/10 opacity-60" />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
              <Workflow className="h-3.5 w-3.5" /> Data Model Reference
            </span>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-foreground">Compensation Star Schema Blueprint</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Import pipelines must populate these Delta tables with the documented column contracts. Existing API routes
              and UI surfaces are already wired — no new hooks at go-live.
            </p>
            {domain.planAssignmentTable && (
              <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
                <strong>Rep to plan:</strong> <code className="font-mono">{domain.planAssignmentTable}</code> joined to{' '}
                <code className="font-mono">dim_plan_version</code> on <code className="font-mono">plan_version_id</code>.
                Marketing rollups also carry denormalized <code className="font-mono">plan_id</code> on{' '}
                <code className="font-mono">fact_marketing_rep_period</code>.
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 lg:max-w-xs">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-bold">Warehouse Seed</span>
            </div>
            <p className="text-[10px] leading-relaxed text-muted-foreground">SQL/bootstrap seeds populate reference data in Unity Catalog.</p>
            <div className="my-1 h-px bg-border/20" />
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-bold">Go-Live</span>
            </div>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              TRUNCATE facts, reload production ETL, validate API payload shapes match this reference.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 p-1.5 rounded-2xl bg-muted/20 border border-border/10 w-fit">
        {DATA_DOMAIN_MODELS.map((d) => (
          <button
            key={d.tag}
            type="button"
            onClick={() => {
              setActiveDomain(d.tag);
              setSelectedTableId(d.tables[0]?.id ?? 'fact_plan_eligibility');
            }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
              activeDomain === d.tag
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            {d.tag}
            {d.status === 'planned' && (
              <span className="rounded-full bg-muted/50 px-1.5 py-0.5 text-[8px] font-bold uppercase">Soon</span>
            )}
          </button>
        ))}
      </div>

      {domain.status === 'planned' ? (
        <div className="rounded-3xl border border-dashed border-border/25 py-16 text-center text-muted-foreground">
          {domain.tag} domain model coming soon — use Marketing as the reference pattern.
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {domain.rawSources.map((src) => (
              <div key={src.name} className="rounded-xl border border-border/15 bg-card/35 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">{src.name}</span>
                </div>
                <div className="mb-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{src.format}</div>
                <div className="flex flex-wrap gap-1">
                  {src.examples.map((ex) => (
                    <span key={ex} className="rounded bg-muted/30 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                      {ex}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
              <GitBranch className="h-4 w-4 text-amber-500" />
              Data Engineering Pipeline
            </h3>
            <div className="flex flex-col gap-4 xl:flex-row">
              {domain.pipeline.map((stage, i) => (
                <PipelineStage key={stage.id} stage={stage} index={i} total={domain.pipeline.length} />
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
              <Table2 className="h-4 w-4 text-primary" />
              Entity Relationship Model
            </h3>
            <div className="rounded-3xl border border-border/15 bg-gradient-to-b from-card/30 to-muted/10 p-6 space-y-6">
              {[
                { label: 'Dimensions', items: dims, color: 'text-blue-400' },
                { label: 'Facts', items: facts, color: 'text-emerald-400' },
                { label: 'Reference & Scenarios', items: refs, color: 'text-amber-400' },
              ].map(({ label, items, color }) =>
                items.length ? (
                  <div key={label}>
                    <div className={`mb-3 text-[10px] font-black uppercase tracking-[0.2em] ${color}`}>{label}</div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {items.map((t) => (
                        <EntityCard
                          key={t.id}
                          table={t}
                          selected={selectedTableId === t.id}
                          onSelect={() => setSelectedTableId(t.id)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null,
              )}
            </div>
          </div>

          {selectedTable && <TableDetailPanel table={selectedTable} />}

          <div className="rounded-2xl border border-border/15 bg-card/40 p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
              <GitBranch className="h-4 w-4 text-primary" />
              Join Topology
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {domain.joins.map((j) => (
                <div
                  key={`${j.from}-${j.to}`}
                  className="flex items-center gap-2 rounded-lg border border-border/10 bg-muted/15 px-3 py-2.5 font-mono text-[10px]"
                >
                  <span className="truncate text-emerald-400">{j.from}</span>
                  <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="truncate text-blue-400">{j.to}</span>
                  <span className="ml-auto shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary">
                    ON {j.on}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-foreground">
              <Link2 className="h-4 w-4 text-primary" />
              API to UI Binding Contract
            </h3>
            <p className="mb-4 text-xs text-muted-foreground">
              Production imports must preserve these payload shapes. The app already consumes them — no UI changes required.
            </p>
            <div className="space-y-2">
              {domainBindings.map((b) => (
                <div key={b.endpoint + b.table} className="rounded-lg border border-border/10 bg-card/40 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-primary">{b.endpoint}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="font-mono text-[10px] text-emerald-400">{b.table}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {b.uiSurfaces.map((ui) => (
                      <span key={ui} className="rounded bg-muted/30 px-2 py-0.5 text-[9px] text-muted-foreground">
                        {ui}
                      </span>
                    ))}
                  </div>
                  {b.payloadKeys && (
                    <div className="mt-2 font-mono text-[9px] text-muted-foreground/80">
                      Keys: {b.payloadKeys.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{domain.productionNote}</p>
          </div>
        </>
      )}
    </div>
  );
}
