import { BookOpen } from 'lucide-react';
import { usePlainLanguage } from '@/hooks/usePlainLanguage';
import { RepAiInsightsPanel, type RepInsightChannel } from '@/components/comp/RepAiInsightsPanel';

interface SimpleViewPayStoryProps {
  repId: string;
  periodId: string;
  roleTitle: string;
  channel?: RepInsightChannel;
  insightsContext?: string;
  enabled?: boolean;
}

/**
 * Single merged AI summary for Simple View — replaces scattered insight/interpretation panels.
 * When Simple View is off, this component renders nothing (callers show full panels).
 */
export function SimpleViewPayStory(props: SimpleViewPayStoryProps) {
  const { enabled } = usePlainLanguage();
  if (!enabled) return null;

  return (
    <div className="simple-view-pay-story space-y-2">
      <div className="flex items-center gap-2 px-1">
        <BookOpen size={14} className="text-gold-light" aria-hidden />
        <span className="text-xs font-bold text-foreground">Your pay story — one summary</span>
      </div>
      <RepAiInsightsPanel {...props} />
    </div>
  );
}
