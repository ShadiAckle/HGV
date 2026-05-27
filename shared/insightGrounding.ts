import { formatSlide16Context, formatTeamMarketContext, type TeamMarketPosition } from './compStandards.js';
import { formatIndustryBenchmarkContext } from './benchmarkGrounding.js';

export function appendInsightGrounding(baseContext: string, options?: {
  includeSlide16?: boolean;
  includeTeamMarket?: boolean;
  planAssessmentBlock?: string;
  industryBenchmarks?: Record<string, unknown>[];
  teamMarketPositions?: TeamMarketPosition[];
}): string {
  const parts = [baseContext];
  if (options?.planAssessmentBlock) {
    parts.push('', '## Plan Assessment', options.planAssessmentBlock);
  }
  if (options?.industryBenchmarks?.length) {
    parts.push('', formatIndustryBenchmarkContext(options.industryBenchmarks));
  } else if (options?.includeSlide16 !== false) {
    parts.push('', formatSlide16Context());
  }
  if (options?.includeTeamMarket) {
    parts.push('', formatTeamMarketContext(options.teamMarketPositions ?? []));
  }
  return parts.join('\n');
}
