import { ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { usePlainLanguage } from '@/hooks/usePlainLanguage';

interface SimpleViewCollapsibleProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** When Simple View is on, start collapsed unless true */
  defaultOpen?: boolean;
  className?: string;
}

/** Progressive disclosure — full content always available; collapsed by default in Simple View only. */
export function SimpleViewCollapsible({
  title,
  subtitle,
  children,
  defaultOpen = false,
  className = '',
}: SimpleViewCollapsibleProps) {
  const { enabled } = usePlainLanguage();
  const [open, setOpen] = useState(defaultOpen);

  if (!enabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={`simple-view-collapsible glass-card overflow-hidden ${className}`}>
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-primary/5"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <div className="text-sm font-bold text-foreground">{title}</div>
          {subtitle && <div className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</div>}
        </div>
        <ChevronDown
          size={18}
          className="mt-0.5 shrink-0 text-muted-foreground transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          aria-hidden
        />
      </button>
      {open && <div className="border-t border-border/10 px-5 pb-5 pt-2">{children}</div>}
    </div>
  );
}
