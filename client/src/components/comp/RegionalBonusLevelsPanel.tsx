import { useCallback, useEffect, useState } from 'react';
import { LuxeDbLoader } from '@/components/comp/LuxeDbLoader';
import { getBonusArea } from '@shared/bonusLevelsJan2025';
import { useAppContext } from '@/context/AppContext';
import { deriveLoadingSteps } from '@/lib/loadingSteps';
import { LOADING } from '@/lib/loadingStepLabels';

interface BonusTierRow {
  level: number;
  salespeople_count: number;
  avg_tier_volume: number;
  total_tier_volume: number;
  total_cmi: number;
  cost_pct: number;
}

interface RegionalBonusPayload {
  area_id: string;
  period_id: string;
  site_line: string;
  smt_volume: number;
  budget_volume: number;
  volume_var_pct: number;
  tiers: BonusTierRow[];
}

interface RegionalBonusLevelsPanelProps {
  areaId?: string;
  periodId?: string;
  title?: string;
}

function catalogPayload(areaId: string, periodId: string): RegionalBonusPayload | null {
  const area = getBonusArea(areaId);
  if (!area) return null;
  return {
    area_id: area.areaId,
    period_id: periodId,
    site_line: area.siteLine,
    smt_volume: area.smtVolume,
    budget_volume: area.budgetVolume,
    volume_var_pct: area.volumeVarPct,
    tiers: area.tiers.map((t) => ({
      level: t.level,
      salespeople_count: t.salespeopleCount,
      avg_tier_volume: t.avgTierVolume,
      total_tier_volume: t.totalTierVolume,
      total_cmi: t.totalCmi,
      cost_pct: t.costPct,
    })),
  };
}

export function RegionalBonusLevelsPanel({
  areaId = 'LV-HGV-AL',
  periodId,
  title,
}: RegionalBonusLevelsPanelProps) {
  const { activePeriodId } = useAppContext();
  const resolvedPeriodId = periodId ?? activePeriodId ?? '2026-Q2';
  const [data, setData] = useState<RegionalBonusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/comp/benchmarks/regional-bonus?area_id=${encodeURIComponent(areaId)}&period_id=${encodeURIComponent(resolvedPeriodId)}`,
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        const fallback = catalogPayload(areaId, resolvedPeriodId);
        if (fallback) {
          setData(fallback);
          return;
        }
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const payload = (await res.json()) as RegionalBonusPayload;
      setData(payload.tiers?.length ? payload : catalogPayload(areaId, resolvedPeriodId));
    } catch (e) {
      const fallback = catalogPayload(areaId, resolvedPeriodId);
      if (fallback) {
        setData(fallback);
        setError(null);
      } else {
        setError(e instanceof Error ? e.message : 'Failed to load regional bonus levels');
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  }, [areaId, resolvedPeriodId]);

  useEffect(() => { void load(); }, [load]);

  const loaderSteps = deriveLoadingSteps([
    {
      id: 'regional-bonus',
      label: LOADING.regionalBonus,
      loading,
      done: !!data,
      error: !!error,
    },
  ]);

  if (loading) {
    return (
      <div className="glass-card overflow-hidden" style={{ padding: '1.5rem' }}>
        <LuxeDbLoader loading variant="inline" steps={loaderSteps} title="Regional bonus levels" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="glass-card overflow-hidden p-4 text-sm text-destructive">
        {error ?? 'No regional bonus data'}
        <button type="button" onClick={() => void load()} className="ml-2 text-xs underline">Retry</button>
      </div>
    );
  }

  const maxCount = Math.max(...data.tiers.map((t) => t.salespeople_count), 1);

  return (
    <div className="glass-card overflow-hidden" style={{ padding: '1.5rem' }}>
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gold">Jan 2025 Bonus Levels by Area</div>
      <h3 className="mb-1 text-sm font-bold">{title ?? data.site_line}</h3>
      <p className="mb-4 text-[11px] text-muted-foreground">
        Unity Catalog · PDF 3/9/2025 — SMT ${(data.smt_volume / 1_000_000).toFixed(1)}M vs budget ${(data.budget_volume / 1_000_000).toFixed(1)}M ({data.volume_var_pct}%)
      </p>

      <div className="mb-4 flex items-end gap-1" style={{ minHeight: 100 }}>
        {data.tiers.map((t) => (
          <div key={t.level} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[9px] font-bold text-primary">{t.salespeople_count}</span>
            <div
              style={{
                width: '100%',
                height: `${Math.max(4, (t.salespeople_count / maxCount) * 80)}px`,
                background: t.level >= 6 ? 'var(--gold)' : t.level >= 3 ? 'var(--primary)' : 'var(--foreground-faint)',
                borderRadius: '3px 3px 0 0',
                opacity: 0.85,
              }}
              title={`Level ${t.level}: ${t.salespeople_count} reps · avg vol ${t.avg_tier_volume.toLocaleString()}`}
            />
            <span className="text-[8px] text-muted-foreground">L{t.level}</span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="data-table w-full text-left text-[10px]">
          <thead>
            <tr>
              <th>Level</th>
              <th style={{ textAlign: 'right' }}># Reps</th>
              <th style={{ textAlign: 'right' }}>Avg Tier Vol</th>
              <th style={{ textAlign: 'right' }}>CMI Cost %</th>
            </tr>
          </thead>
          <tbody>
            {data.tiers.filter((t) => t.salespeople_count > 0).map((t) => (
              <tr key={t.level}>
                <td className="font-bold">Level {t.level}</td>
                <td style={{ textAlign: 'right' }}>{t.salespeople_count}</td>
                <td style={{ textAlign: 'right' }}>${Math.round(t.avg_tier_volume).toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>{t.cost_pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
