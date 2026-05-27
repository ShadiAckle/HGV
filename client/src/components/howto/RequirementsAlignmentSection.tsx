import { REQUIREMENTS_ALIGNMENT, requirementStats, type RequirementStatus } from '@/data/requirementsAlignment';

function StatusBadge({ status }: { status: RequirementStatus }) {
  const styles =
    status === 'built'
      ? { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', color: 'var(--success)', label: 'Built' }
      : { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', color: 'var(--warning)', label: 'Partial' };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        padding: '0.2rem 0.55rem',
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        background: styles.bg,
        border: `1px solid ${styles.border}`,
        color: styles.color,
        flexShrink: 0,
      }}
    >
      {styles.label}
    </span>
  );
}

function CoverageBar({ built, total }: { built: number; total: number }) {
  const pct = total > 0 ? Math.round((built / total) * 100) : 0;
  return (
    <div style={{ minWidth: 160 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--foreground-muted)' }}>
          Coverage
        </span>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--success)' }}>{pct}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: 999,
            background: 'linear-gradient(90deg, var(--success) 0%, rgba(16,185,129,0.65) 100%)',
            transition: 'width 0.4s ease',
          }}
        />
      </div>
    </div>
  );
}

export function RequirementsAlignmentSection() {
  const stats = requirementStats(REQUIREMENTS_ALIGNMENT);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div
        className="card"
        style={{
          padding: '1.25rem 1.5rem',
          background: 'linear-gradient(135deg, rgba(26,109,255,0.08) 0%, rgba(212,175,55,0.06) 100%)',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.25rem' }}>
          <div style={{ flex: '1 1 320px' }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)' }}>
              Product Requirements Traceability
            </div>
            <h4 style={{ fontSize: 15, fontWeight: 800, color: 'var(--foreground)', marginTop: 6, marginBottom: 4 }}>
              IGNITE Compensation Hub — Live Alignment Matrix
            </h4>
            <p style={{ fontSize: 12, lineHeight: 1.65, color: 'var(--foreground-muted)', maxWidth: 640 }}>
              Each row traces a business requirement to its production surface area and governing Unity Catalog objects.
              Status reflects live wiring in the deployed Databricks App — not slide references or static mocks.
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem' }}>
            <CoverageBar built={stats.built} total={stats.total} />
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              {[
                { label: 'Total', value: stats.total, color: 'var(--foreground)' },
                { label: 'Built', value: stats.built, color: 'var(--success)' },
                { label: 'Partial', value: stats.partial, color: 'var(--warning)' },
              ].map((s) => (
                <div
                  key={s.label}
                  style={{
                    minWidth: 72,
                    textAlign: 'center',
                    padding: '0.625rem 0.875rem',
                    borderRadius: 10,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--foreground-muted)', marginTop: 4 }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) auto minmax(0, 2.5fr)',
          gap: '0.75rem 1rem',
          padding: '0 0.25rem',
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--foreground-muted)',
        }}
      >
        <span>Requirement</span>
        <span style={{ textAlign: 'center' }}>Status</span>
        <span>Implementation</span>
      </div>

      {REQUIREMENTS_ALIGNMENT.map((group) => (
        <div key={group.id} className="card" style={{ padding: '1.25rem 1.5rem', overflow: 'hidden' }}>
          <div style={{ marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)' }}>{group.title}</div>
            <div style={{ fontSize: 11.5, color: 'var(--foreground-muted)', marginTop: 4, lineHeight: 1.5 }}>{group.subtitle}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {group.items.map((item) => (
              <div
                key={item.requirement}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 2fr) auto minmax(0, 2.5fr)',
                  gap: '0.75rem 1rem',
                  alignItems: 'start',
                  padding: '0.875rem 1rem',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.45 }}>
                  {item.requirement}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 2 }}>
                  <StatusBadge status={item.status} />
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--foreground-muted)',
                    lineHeight: 1.55,
                    paddingLeft: 10,
                    borderLeft: '2px solid var(--primary)',
                  }}
                >
                  {item.how}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
