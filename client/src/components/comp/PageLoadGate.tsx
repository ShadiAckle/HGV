import type { ReactNode } from 'react';
import { LuxeDbLoader } from '@/components/comp/LuxeDbLoader';
import type { LoadingStep } from '@/lib/loadingSteps';

interface PageLoadGateProps {
  loading: boolean;
  steps?: LoadingStep[];
  title?: string;
  minHeight?: number | string;
  children: ReactNode;
}

/** Blocks page chrome + content until data prerequisites are satisfied (avoids hard-refresh flash). */
export function PageLoadGate({
  loading,
  steps,
  title = 'Loading',
  minHeight = 500,
  children,
}: PageLoadGateProps) {
  if (loading) {
    return (
      <div
        className="animate-fade-in"
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          minHeight,
        }}
      >
        <LuxeDbLoader loading steps={steps} title={title} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 90, borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
        <div className="skeleton" style={{ height: 400, borderRadius: 'var(--radius-lg)' }} />
      </div>
    );
  }

  return <>{children}</>;
}
