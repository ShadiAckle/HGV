import { Info, HelpCircle, X } from 'lucide-react';

import { useEffect, useState } from 'react';

import { useLocation } from 'react-router';
import { usePlainLanguage } from '@/hooks/usePlainLanguage';

const PAGE_GUIDE: Record<string, { title: string; detail: string; hasLiveData: boolean }> = {

  '/': {

    title: 'Overview',

    detail: 'Welcome to your sales hub. Track your earnings, view your tools, and get instant answers about your commission and goals.',

    hasLiveData: false,

  },

  '/my-compensation': {

    title: 'My Compensation',

    detail: 'Track your closed contracts, current commission rate, target milestone progress, and projected earnings.',

    hasLiveData: true,

  },

  '/team': {

    title: 'Team Performance',

    detail: 'Manager dashboard tracking team sales goals, monthly contract volumes, and representative leaderboards.',

    hasLiveData: true,

  },

  '/admin-console': {

    title: 'Strategy & Governance Control Room',

    detail: 'Review the governed data model reference, semantic metric catalog, and run what-if scenario models.',

    hasLiveData: true,

  },

  '/comp-admin': {

    title: 'Comp Admin',

    detail: 'Review plan eligibility, payout trails, chargebacks, audit logs, and payroll previews for the active rep and period.',

    hasLiveData: true,

  },

  '/finance': {

    title: 'Finance',

    detail: 'Analyze comp cost vs budget, tour quality, SPIFF ROI, accruals, and scenario financial impact.',

    hasLiveData: true,

  },

  '/how-to': {

    title: 'How To',

    detail: 'Operations guide for navigation, copilot usage, and how SQL-backed KPIs connect to Unity Catalog.',

    hasLiveData: false,

  },

};

const PLAIN_PAGE_GUIDE: Record<string, { title: string; detail: string }> = {
  '/': {
    title: 'Home',
    detail: 'Your pay dashboard. See what you earned, check your goal, and ask questions the easy way.',
  },
  '/my-compensation': {
    title: 'My Pay',
    detail: 'See your deals, your commission rate, how close you are to your goal, and what you should earn.',
  },
  '/team': {
    title: 'Team Scoreboard',
    detail: 'See how your team is doing on sales goals and who is leading the pack.',
  },
  '/admin-console': {
    title: 'Plan Rules Room',
    detail: 'Look up official pay rules, test what-if changes, and see how numbers are defined.',
  },
  '/comp-admin': {
    title: 'Pay Admin',
    detail: 'Check who qualifies for the plan, payout history, clawbacks, and paycheck previews.',
  },
  '/finance': {
    title: 'Company Pay Costs',
    detail: 'See how much the company spends on pay vs budget, tour results, and bonus payback.',
  },
  '/how-to': {
    title: 'Help',
    detail: 'How to use the app, ask the AI advisor questions, and where the numbers come from.',
  },
};

const STORAGE_PREFIX = 'hgv_guide_dismissed_';



export function PageGuide() {

  const { pathname } = useLocation();
  const { enabled: plainEnglish } = usePlainLanguage();

  const guide = PAGE_GUIDE[pathname];
  const plainGuide = PLAIN_PAGE_GUIDE[pathname];
  const displayTitle = plainEnglish && plainGuide ? plainGuide.title : guide?.title;
  const displayDetail = plainEnglish && plainGuide ? plainGuide.detail : guide?.detail;

  

  const [isDismissed, setIsDismissed] = useState(true);



  // Check storage on path change

  useEffect(() => {

    if (!guide) return;

    const dismissed = localStorage.getItem(STORAGE_PREFIX + pathname) === 'true';

    setIsDismissed(dismissed);

  }, [pathname, guide]);



  if (!guide) return null;



  function handleDismiss() {

    localStorage.setItem(STORAGE_PREFIX + pathname, 'true');

    setIsDismissed(true);

  }



  function handleRestore() {

    localStorage.removeItem(STORAGE_PREFIX + pathname);

    setIsDismissed(false);

  }



  if (isDismissed) {

    return (

      <div className="mx-auto mb-4 flex max-w-7xl justify-end">

        <button

          type="button"

          onClick={handleRestore}

          className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline bg-primary/5 px-2.5 py-1 rounded-full border border-primary/20"

        >

          <HelpCircle className="h-3 w-3" />

          Show Page Guide

        </button>

      </div>

    );

  }



  return (

    <div className="mx-auto mb-4 flex max-w-7xl gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs animate-fade-in-up relative">

      <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />

      <div className="pr-6">

        <p className="font-semibold text-foreground">

          Guide: {displayTitle ?? guide.title}

          {guide.hasLiveData ? (

            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary uppercase">

              {plainEnglish ? 'Live Numbers' : 'Live SQL Data'}

            </span>

          ) : (

            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold text-muted-foreground uppercase">

              {plainEnglish ? 'Help & Tips' : 'Reference / Policy Q&A'}

            </span>

          )}

        </p>

        <p className="mt-1 leading-relaxed text-muted-foreground">{displayDetail ?? guide.detail}</p>

      </div>

      <button

        type="button"

        onClick={handleDismiss}

        className="absolute top-3 right-3 p-0.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50"

        title="Dismiss guide"

      >

        <X className="h-3.5 w-3.5" />

      </button>

    </div>

  );

}


