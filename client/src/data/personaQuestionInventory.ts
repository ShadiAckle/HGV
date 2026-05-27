/**
 * Field persona question inventory from Biz Ops workshops.
 * Used for copilot prompt catalogs and semantic layer mapping.
 */
export interface PersonaQuestionCategory {
  category: string;
  questions: readonly string[];
}

export interface FieldPersonaQuestionInventory {
  code: string;
  id: 'call_center' | 'marketing_rep' | 'marketing_manager' | 'marketing_director' | 'sales_executive';
  title: string;
  subtitle: string;
  route: string;
  funnelRole: string;
  systemsNote?: string;
  dataNote: string;
  categories: readonly PersonaQuestionCategory[];
}

export const FIELD_PERSONA_QUESTIONS: readonly FieldPersonaQuestionInventory[] = [
  {
    code: 'C1',
    id: 'call_center',
    title: 'Call Center / Telemarketing Rep',
    subtitle: 'Package & tour credit, conversion, lead status',
    route: '/admin-console',
    funnelRole: 'Call center sells packages → feeds marketing tours → on-site sales close',
    systemsNote: 'Voice, Salesforce, Scripter, Cognos, The Hub',
    dataNote:
      'Package and tour credit events, activation dates, and statement lineage from Voice, Salesforce, and comp calc exports.',
    categories: [
      {
        category: 'Package credit',
        questions: ['Did I get credit for package sale PKG-89211?', 'Why is package sale PKG-89104 not credited?'],
      },
      {
        category: 'Activation credit',
        questions: ['Did I get credit for the guest activation of booking BK-77211?', 'Why was BK-77344 activation SPIFF clawed back?'],
      },
      {
        category: 'Tour credit',
        questions: ['Did package buyer guest Guest Alex Chen show for tour T-55104, and what was my credit?', 'What is the status of tour T-55200 for Robert Chen?'],
      },
      {
        category: 'Downstream sale',
        questions: ['Did I receive downstream referral credit for package holder contract CON-90184?'],
      },
      {
        category: 'Conversion',
        questions: ['What is my package conversion rate this month?'],
      },
      {
        category: 'Cost metric',
        questions: ['How is cost per package or cost per tour calculated?'],
      },
      {
        category: 'Pay timing',
        questions: ['When will I be paid for package PKG-89211?'],
      },
      {
        category: 'Lead status',
        questions: ['What is the status of my leads: Jane Miller, Robert Chen, and Sarah Jenkins?'],
      },
      {
        category: 'Global ABC',
        questions: ['How does the guest\'s A/B/C/D score affect booking priority?'],
      },
      {
        category: 'Blue Light process',
        questions: ['Why was this guest placed into a Blue Light queue?'],
      },
      {
        category: 'Tool guidance',
        questions: ['Which system should I check: Voice, Salesforce, Scripter, Cognos, or The Hub?'],
      },
    ],
  },
  {
    code: 'C2a',
    id: 'marketing_rep',
    title: 'Marketing Representative',
    subtitle: 'Tour quality, penetration, SPIFFs, and arrival assignment',
    route: '/admin-console',
    funnelRole: 'Marketing books tours and drives arrivals—paid on booked vs shown vs sold rules vary by plan',
    systemsNote: 'Salesforce, Arrivals DB, Merchandising Portal',
    dataNote:
      'Tour qualification rules, gift/premium cost, penetration denominators, and SPIFF/contest tables from marketing ops feeds.',
    categories: [
      {
        category: 'Booking vs show',
        questions: ['Am I paid on booked tours, shown tours, or sold tours?'],
      },
      {
        category: 'Tour quality',
        questions: ['Did the tour for arrival guest profile ARR-90112 count as a qualified tour?', 'Why did shown tour T-55204 mark non-qualified?'],
      },
      {
        category: 'No-show',
        questions: ['Why did my booked tour for Clark Kent (T-55180) receive $0 payout?'],
      },
      {
        category: 'Premium/gift',
        questions: ['Explain the premium gift chargeback of $50 on my statement (CB-44102).'],
      },
      {
        category: 'Penetration',
        questions: ['How is penetration/conversion calculated for Strip South arrivals?'],
      },
      {
        category: 'Guest type',
        questions: ['Does guest Bruce Wayne count as owner, non-owner, renter, VIP, or courtesy?'],
      },
      {
        category: 'Downstream sale',
        questions: ['Do I get extra payout if my tour buys?'],
      },
      {
        category: 'SPIFF',
        questions: ['Did my shown tours on the week of 2026-05-15 qualify for the penetration SPIFF?'],
      },
      {
        category: 'Contest',
        questions: ['What do I need to do to qualify for this contest?'],
      },
      {
        category: 'Disputes',
        questions: ['Why was shown tour T-55204 marked non-qualified?'],
      },
      {
        category: 'Schedule / assignment',
        questions: ['Show my assigned arrivals for the weekend shift.'],
      },
    ],
  },
  {
    code: 'C2b',
    id: 'marketing_manager',
    title: 'Marketing Manager',
    subtitle: 'Site-level volume, contribution margins, and team performance tracking',
    route: '/admin-console',
    funnelRole: 'Site marketing leadership; responsible for tour flow, cost per tour, and team coaching',
    systemsNote: 'Salesforce, Arrivals DB, Ingestion Pipeline, Finance Ledger',
    dataNote:
      'Site tour volumes, VPG, contribution sheets, and manager override curves from the marketing ops semantic layer.',
    categories: [
      {
        category: 'TCC & Performance',
        questions: [
          'What is the average performer salary at target for a Marketing Manager?',
          'Explain the payout at the 75th-90th percentile for an In-House Manager ($255k-$278k).',
        ],
      },
      {
        category: 'Metrics & Weights',
        questions: [
          'How is Club Penetration Rate weighted in my plan (20%-70%)?',
          'How does LM Net Sales Volume contribute to my Q1 target?',
        ],
      },
      {
        category: 'Payout Curves',
        questions: [
          'What threshold applies to my plan? (75%-80% attainment = 60% payout)',
          'What happens if I achieve 120% target attainment?',
        ],
      },
      {
        category: 'SPIFFs & Governance',
        questions: [
          'Can I roll out a same-day SPIFF for my team, and who needs to approve it?',
          'How do in-year short-term incentives (STIs) get governed under my budget?',
        ],
      },
    ],
  },
  {
    code: 'C2c',
    id: 'marketing_director',
    title: 'Marketing Director',
    subtitle: 'Enterprise VPG, regional Net Sales Volume (NSV), and profitability targets',
    route: '/admin-console',
    funnelRole: 'Strategic marketing leadership; oversees program-level tour flows, margins, and regional profitability',
    systemsNote: 'Unity Catalog, Finance Accruals, Enterprise forecasting',
    dataNote:
      'Overall regional Net Sales Volume (NSV), DC Contribution, and VPG metrics synced from the governed catalog.',
    categories: [
      {
        category: 'TCC & Performance',
        questions: [
          'Explain the difference between HGV\'s Marketing Director target cash ($205k-$250k) vs the market median (~$220k).',
          'What is the top earner upside for Directors/Sr Directors in the 90th percentile ($527k)?',
        ],
      },
      {
        category: 'Metrics & Weights',
        questions: [
          'How is the 40% weight on Total Net Sales Volume (NSV) calculated?',
          'Explain the DC Contribution metric (30% weight) and the Club Pen Rate qualifier.',
        ],
      },
      {
        category: 'Payout Curves',
        questions: [
          'What is the threshold and target payout structure for Marketing Directors?',
          'What is the maximum payout accelerator for reaching 125% target attainment?',
        ],
      },
      {
        category: 'SPIFFs & Governance',
        questions: [
          'Are Directors eligible for short-term incentives, and how do I submit requests?',
          'What happens to payouts when contribution results are audited quarterly?',
        ],
      },
    ],
  },
  {
    code: 'C3',
    id: 'sales_executive',
    title: 'Sales Executive',
    subtitle: 'Track your commissions, closed contracts, goal progress, and rate boosters.',
    route: '/my-compensation',
    funnelRole: 'On-site closing; contract volume and payout rate tracking over active periods.',
    dataNote:
      'Live sales metrics and earnings data synced nightly from verified company systems.',
    categories: [
      {
        category: 'Commissions',
        questions: ['How was my commission calculated on this contract?', 'What is my current payout rate?'],
      },
      {
        category: 'Sales Goals',
        questions: ['What quarterly target am I tracking toward?', 'How much contract volume have I locked in?'],
      },
      {
        category: 'Rate Boosters',
        questions: ['What do I need to sell to hit my next commission booster?', 'How close am I to unlocking a higher tier?'],
      },
      {
        category: 'Recent Sales',
        questions: [
          'Did my deed upgrade from yesterday credit to my dashboard?',
          'Why did CON-90231 pay out at a different rate?',
        ],
      },
      {
        category: 'Line Rotation',
        questions: ['Where am I in the sales line rotation today?', 'How is my tour priority determined?'],
      },
      {
        category: 'Payout Questions',
        questions: [
          'Explain my paycheck and statement in plain English.',
          'Why is there an overage or hold on my statement?',
          'How long does it take for a contract to clear for commission payout?',
        ],
      },
    ],
  },
] as const;

export function getFieldPersonaById(id: FieldPersonaQuestionInventory['id']) {
  return FIELD_PERSONA_QUESTIONS.find((p) => p.id === id);
}

/** Flat list of example questions for copilot quick-prompt chips (deduped, capped). */
export function copilotPromptsForPersona(id: FieldPersonaQuestionInventory['id'], limit = 6): string[] {
  const persona = getFieldPersonaById(id);
  if (!persona) return [];
  return persona.categories
    .flatMap((c) => c.questions)
    .slice(0, limit);
}

export function allQuestionsForPersona(id: FieldPersonaQuestionInventory['id']): string {
  const persona = getFieldPersonaById(id);
  if (!persona) return '';
  return persona.categories
    .map((c) => `### ${c.category}\n${c.questions.map((q) => `- ${q}`).join('\n')}`)
    .join('\n\n');
}
