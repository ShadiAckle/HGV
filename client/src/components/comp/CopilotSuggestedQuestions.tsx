import { ChevronDown, MessageCircleQuestion, Search, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MENU_WIDTH = 340;

function computeMenuPosition(trigger: HTMLElement): { top: number; left: number; width: number } {
  const rect = trigger.getBoundingClientRect();
  const width = Math.min(MENU_WIDTH, window.innerWidth - 16);
  let left = rect.right - width;
  left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
  return { top: rect.bottom + 6, left, width };
}

/** Compact header dropdown — portaled so it is not clipped by sidebar overflow. */
export function CopilotQuestionsMenu({
  prompts,
  disabled = false,
  onSelect,
}: {
  prompts: readonly string[];
  disabled?: boolean;
  onSelect: (prompt: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...prompts];
    return prompts.filter((p) => p.toLowerCase().includes(q));
  }, [prompts, query]);

  useEffect(() => {
    if (!open || !triggerRef.current) return;

    function reposition() {
      if (triggerRef.current) setMenuPos(computeMenuPosition(triggerRef.current));
    }
    reposition();
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
      setQuery('');
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function pick(prompt: string) {
    onSelect(prompt);
    setOpen(false);
    setQuery('');
  }

  if (prompts.length === 0) return null;

  const menu = open && menuPos
    ? createPortal(
        <div
          ref={panelRef}
          role="listbox"
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, width: menuPos.width, zIndex: 9999 }}
          className="overflow-hidden rounded-xl border border-glass-border bg-card shadow-2xl backdrop-blur-xl animate-fade-in-up"
        >
          <div className="border-b border-glass-border/80 bg-muted/20 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" aria-hidden />
              Suggested questions
            </p>
            {prompts.length > 6 && (
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/50" aria-hidden />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter…"
                  className="w-full rounded-lg border border-glass-border bg-background py-1.5 pl-8 pr-2 text-[11px] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
                  autoFocus
                />
              </div>
            )}
          </div>
          <ul className="max-h-64 overflow-y-auto overflow-x-hidden p-2">
            {filtered.length === 0 ? (
              <li className="px-2 py-4 text-center text-[11px] text-muted-foreground">No matches</li>
            ) : (
              filtered.map((prompt) => (
                <li key={prompt}>
                  <button
                    type="button"
                    role="option"
                    onClick={() => pick(prompt)}
                    className="group w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-primary/8"
                  >
                    <span className="block text-[11px] leading-relaxed text-foreground/90 group-hover:text-foreground whitespace-normal break-words">
                      {prompt}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title="Browse suggested questions"
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all disabled:opacity-40 ${
          open
            ? 'border-primary/40 bg-primary/10 text-primary shadow-sm'
            : 'border-glass-border bg-card/30 text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-foreground'
        }`}
      >
        <MessageCircleQuestion className="h-3 w-3 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Questions</span>
        <span className="rounded-full bg-muted/80 px-1.5 py-px text-[9px] font-bold tabular-nums text-muted-foreground">
          {prompts.length}
        </span>
        <ChevronDown className={`h-3 w-3 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {menu}
    </>
  );
}
