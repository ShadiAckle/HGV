import { MessageCircleQuestion } from 'lucide-react';
import { usePlainLanguage } from '@/hooks/usePlainLanguage';

interface SimpleViewAskButtonsProps {
  prompts: readonly string[];
  onSelect: (prompt: string) => void;
}

/** Big one-tap questions — primary path in Simple View instead of reading tables. */
export function SimpleViewAskButtons({ prompts, onSelect }: SimpleViewAskButtonsProps) {
  const { enabled } = usePlainLanguage();
  if (!enabled || prompts.length === 0) return null;

  const top = prompts.slice(0, 3);

  return (
    <div className="simple-view-ask glass-card border border-gold/25 p-5">
      <div className="mb-3 flex items-center gap-2">
        <MessageCircleQuestion size={15} className="text-gold-light" aria-hidden />
        <span className="text-sm font-bold text-foreground">Ask instead of reading</span>
      </div>
      <p className="mb-4 text-[11px] text-muted-foreground">
        Tap a question — the advisor pulls your live numbers and answers in plain talk.
      </p>
      <div className="flex flex-col gap-2">
        {top.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="rounded-xl border border-primary/25 bg-primary/8 px-4 py-3 text-left text-[12px] font-semibold leading-snug text-foreground transition-all hover:border-primary/45 hover:bg-primary/12"
            onClick={() => onSelect(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
