import { Sparkles } from 'lucide-react';
import { usePlainLanguage } from '@/hooks/usePlainLanguage';

/** Global header toggle — Simple View: same data, zero finance jargon. */
export function SimpleViewToggle() {
  const { enabled, toggle } = usePlainLanguage();

  return (
    <button
      type="button"
      id="nav-simple-view-toggle"
      role="switch"
      aria-checked={enabled}
      aria-label={enabled ? 'Simple View on' : 'Simple View off'}
      title={
        enabled
          ? 'Simple View is on — tap for standard comp labels'
          : 'Simple View — same numbers, zero MBA speak'
      }
      onClick={toggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.375rem',
        background: enabled ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-elevated)',
        border: enabled ? '1px solid rgba(34, 197, 94, 0.45)' : '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '0.3125rem 0.625rem',
        fontSize: 11,
        fontWeight: 600,
        color: enabled ? '#16A34A' : 'var(--foreground-muted)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'all 0.2s',
      }}
    >
      <Sparkles size={13} aria-hidden />
      <span>Simple View</span>
      <span
        style={{
          width: 28,
          height: 16,
          borderRadius: 999,
          background: enabled ? '#22C55E' : 'var(--border)',
          position: 'relative',
          flexShrink: 0,
          transition: 'background 0.2s',
        }}
        aria-hidden
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: enabled ? 14 : 2,
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
            transition: 'left 0.2s',
          }}
        />
      </span>
    </button>
  );
}
