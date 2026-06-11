import { FlaskConical, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { projectScenario, projectTeamAttainment } from '@shared/scenarioProjection';
import {
  formatCommissionRate,
  formatQuotaDelta,
  formatTourDelta,
  QUOTA_SLIDER,
  quotaPctFromDeltaUsd,
  TOUR_SLIDER,
  tourPctFromDelta,
} from '@shared/scenarioLeverUnits';
import { formatCurrency, formatPercent } from '@/lib/compFormat';
import { KpiCard } from '@/components/comp/KpiCard';

interface TeamRepRow {
  agent_name: string;
  quota_attainment_pct: number;
  total_earnings: number;
}

interface SliderProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  formatValue?: (v: number) => string;
  color?: string;
  onChange: (v: number) => void;
}

function ScenarioSlider({
  id,
  label,
  value,
  min,
  max,
  step,
  formatValue,
  color = 'var(--primary)',
  onChange,
}: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  const display = formatValue ? formatValue(value) : String(value);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
        <label htmlFor={id} style={{ fontWeight: 600, color: 'var(--foreground)' }}>
          {label}
        </label>
        <span className="badge badge-neutral" style={{ fontWeight: 700, fontSize: 10 }}>
          {display}
        </span>
      </div>
      <div style={{ position: 'relative', height: 6, display: 'flex', alignItems: 'center' }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: 4,
            background: 'var(--bg-overlay)',
            borderRadius: 999,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            width: `${pct}%`,
            height: 4,
            background: color,
            borderRadius: 999,
          }}
        />
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            opacity: 0,
            cursor: 'pointer',
            zIndex: 10,
          }}
        />
      </div>
    </div>
  );
}

const DEFAULT_LEVERS = {
  quota_delta_usd: 0,
  commission_rate_pct: 6,
  bonus_rate_change_pct: 0,
  accelerator_change_pct: 0,
  tour_delta: 0,
  conversion_rate_change_pct: 0,
};

export interface TeamScenarioPanelProps {
  teamName: string;
  isMarketing: boolean;
  baselineEarnings: number;
  baselineAttainment: number;
  reportCount: number;
  reps: TeamRepRow[];
}

export function TeamScenarioPanel({
  teamName,
  isMarketing,
  baselineEarnings,
  baselineAttainment,
  reportCount,
  reps,
}: TeamScenarioPanelProps) {
  const [levers, setLevers] = useState(DEFAULT_LEVERS);

  const projection = useMemo(() => {
    const base = Math.max(baselineEarnings, 1);
    return projectScenario(
      quotaPctFromDeltaUsd(levers.quota_delta_usd),
      levers.commission_rate_pct,
      levers.bonus_rate_change_pct,
      levers.accelerator_change_pct,
      tourPctFromDelta(levers.tour_delta),
      levers.conversion_rate_change_pct,
      base,
    );
  }, [baselineEarnings, levers]);

  const projectedAttainment = useMemo(
    () =>
      projectTeamAttainment(
        baselineAttainment,
        quotaPctFromDeltaUsd(levers.quota_delta_usd),
        levers.commission_rate_pct,
        levers.bonus_rate_change_pct,
        levers.accelerator_change_pct,
        tourPctFromDelta(levers.tour_delta),
        levers.conversion_rate_change_pct,
      ),
    [baselineAttainment, levers],
  );

  const earningsMultiplier = projection.projected_payouts / Math.max(baselineEarnings, 1);
  const attainmentMultiplier =
    baselineAttainment > 0 ? projectedAttainment / baselineAttainment : 1;

  const repProjections = useMemo(
    () =>
      reps.map((rep) => ({
        ...rep,
        projected_earnings: Math.round(rep.total_earnings * earningsMultiplier),
        projected_attainment: Math.min(
          130,
          Math.round(rep.quota_attainment_pct * attainmentMultiplier * 10) / 10,
        ),
        earnings_delta: Math.round(rep.total_earnings * earningsMultiplier) - rep.total_earnings,
      })),
    [reps, earningsMultiplier, attainmentMultiplier],
  );

  const hasLevers = Object.entries(levers).some(([key, value]) => {
    if (key === 'commission_rate_pct') return value !== 6;
    return value !== 0;
  });

  return (
    <div className="card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div>
          <h3
            style={{
              fontSize: 13,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              margin: 0,
            }}
          >
            <FlaskConical size={14} color="var(--primary)" />
            Team Scenario Modeler
          </h3>
          <p style={{ fontSize: 11, color: 'var(--foreground-muted)', margin: '0.35rem 0 0', maxWidth: 560 }}>
            Model comp levers against <strong>{teamName}</strong> ({reportCount} direct reports). Projections
            update live from current team earnings ({formatCurrency(baselineEarnings)} QTD) and attainment (
            {formatPercent(baselineAttainment)}). Org-wide saved scenarios live in the{' '}
            <Link to="/admin-console" className="font-semibold text-primary hover:underline">
              Strategy Control Room
            </Link>
            .
          </p>
        </div>
        <button
          type="button"
          onClick={() => setLevers(DEFAULT_LEVERS)}
          disabled={!hasLevers}
          className="btn btn-ghost"
          style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6, opacity: hasLevers ? 1 : 0.5 }}
        >
          <RotateCcw size={12} />
          Reset levers
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 320px) 1fr', gap: '1.5rem', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {isMarketing ? (
            <>
              <ScenarioSlider
                id="team-tour-volume"
                label="Tour volume adjustment"
                value={levers.tour_delta}
                min={TOUR_SLIDER.min}
                max={TOUR_SLIDER.max}
                step={TOUR_SLIDER.step}
                formatValue={formatTourDelta}
                color="var(--gold)"
                onChange={(v) => setLevers((l) => ({ ...l, tour_delta: v }))}
              />
              <ScenarioSlider
                id="team-conversion"
                label="Tour conversion change"
                value={levers.conversion_rate_change_pct}
                min={-10}
                max={20}
                step={1}
                color="var(--success)"
                onChange={(v) => setLevers((l) => ({ ...l, conversion_rate_change_pct: v }))}
              />
              <ScenarioSlider
                id="team-bonus-mkt"
                label="Regional bonus uplift"
                value={levers.bonus_rate_change_pct}
                min={-10}
                max={15}
                step={1}
                onChange={(v) => setLevers((l) => ({ ...l, bonus_rate_change_pct: v }))}
              />
            </>
          ) : (
            <>
              <ScenarioSlider
                id="team-quota"
                label="Quota adjustment (per rep)"
                value={levers.quota_delta_usd}
                min={QUOTA_SLIDER.min}
                max={QUOTA_SLIDER.max}
                step={QUOTA_SLIDER.step}
                formatValue={formatQuotaDelta}
                onChange={(v) => setLevers((l) => ({ ...l, quota_delta_usd: v }))}
              />
              <ScenarioSlider
                id="team-commission"
                label="Commission rate"
                value={levers.commission_rate_pct}
                min={3}
                max={12}
                step={0.5}
                formatValue={formatCommissionRate}
                color="var(--success)"
                onChange={(v) => setLevers((l) => ({ ...l, commission_rate_pct: v }))}
              />
              <ScenarioSlider
                id="team-accelerator"
                label="Accelerator threshold change"
                value={levers.accelerator_change_pct}
                min={-10}
                max={15}
                step={1}
                color="var(--gold)"
                onChange={(v) => setLevers((l) => ({ ...l, accelerator_change_pct: v }))}
              />
              <ScenarioSlider
                id="team-bonus-sales"
                label="Bonus rate change"
                value={levers.bonus_rate_change_pct}
                min={-10}
                max={15}
                step={1}
                onChange={(v) => setLevers((l) => ({ ...l, bonus_rate_change_pct: v }))}
              />
            </>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
            <KpiCard
              label="Projected Team Payout"
              value={formatCurrency(projection.projected_payouts)}
              subtext={`${projection.budget_impact >= 0 ? '+' : ''}${formatCurrency(projection.budget_impact)} vs current`}
              trend={projection.budget_impact === 0 ? 'neutral' : projection.budget_impact > 0 ? 'negative' : 'positive'}
            />
            <KpiCard
              label="Projected Attainment"
              value={formatPercent(projectedAttainment)}
              subtext={`${projectedAttainment >= baselineAttainment ? '+' : ''}${(projectedAttainment - baselineAttainment).toFixed(1)} pts vs ${formatPercent(baselineAttainment)}`}
              trend={
                projectedAttainment === baselineAttainment
                  ? 'neutral'
                  : projectedAttainment > baselineAttainment
                    ? 'positive'
                    : 'negative'
              }
            />
            <KpiCard
              label="Expected Performance"
              value={`${projection.expected_performance_pct}%`}
              subtext="Modeled team productivity index"
              trend="neutral"
            />
          </div>

          {repProjections.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rep</th>
                    <th style={{ textAlign: 'right' }}>Current</th>
                    <th style={{ textAlign: 'right' }}>Projected</th>
                    <th style={{ textAlign: 'right' }}>Δ Earnings</th>
                    <th style={{ textAlign: 'right' }}>Attainment</th>
                    <th style={{ textAlign: 'right' }}>→ Projected</th>
                  </tr>
                </thead>
                <tbody>
                  {repProjections.map((rep) => (
                    <tr key={rep.agent_name}>
                      <td style={{ fontWeight: 600 }}>{rep.agent_name}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(rep.total_earnings)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(rep.projected_earnings)}</td>
                      <td
                        style={{
                          textAlign: 'right',
                          color:
                            rep.earnings_delta > 0
                              ? 'var(--success)'
                              : rep.earnings_delta < 0
                                ? 'var(--danger)'
                                : 'var(--foreground-muted)',
                          fontWeight: 600,
                        }}
                      >
                        {rep.earnings_delta >= 0 ? '+' : ''}
                        {formatCurrency(rep.earnings_delta)}
                      </td>
                      <td style={{ textAlign: 'right' }}>{formatPercent(rep.quota_attainment_pct)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatPercent(rep.projected_attainment)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
