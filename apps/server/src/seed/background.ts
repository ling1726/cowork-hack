import type {
  Alert,
  AlertStatus,
  Category,
  Desk,
  Highlight,
  ResolutionOutcome,
  Severity,
  TimelineEvent,
} from '@app/domain';
import type { Faker } from '@faker-js/faker';
import { D, H, MIN, type SeedCtx, type SeedPart } from './context.ts';
import { BACKGROUND_RULE, rule } from './rules.ts';
import { STORY_IDS } from './story.ts';

const TRADERS = [
  ['T-0101', 'Anna Keller'],
  ['T-0107', 'Luca Ferrari'],
  ['T-0115', 'Sofia Martin'],
  ['T-0123', 'Hugo Dubois'],
  ['T-0131', 'Ingrid Berg'],
  ['T-0144', 'Mateo Garcia'],
  ['T-0152', 'Chloe Bernard'],
  ['T-0166', 'Jonas Weber'],
  ['T-0178', 'Nadia Haddad'],
  ['T-0189', 'Oliver Grant'],
  ['T-0197', 'Yuki Tanaka'],
  ['T-0204', 'Carlos Ruiz'],
] as const;

const INSTRUMENTS: Record<Desk, Array<[string, string, string]>> = {
  'eu-equities': [
    ['AIR FP', 'Airbus SE', 'equity'],
    ['MC FP', 'LVMH Moet Hennessy', 'equity'],
    ['ENEL IM', 'Enel SpA', 'equity'],
    ['ADS GY', 'Adidas AG', 'equity'],
  ],
  'us-equities': [
    ['AAPL UW', 'Apple Inc', 'equity'],
    ['MSFT UW', 'Microsoft Corp', 'equity'],
    ['JPM UN', 'JPMorgan Chase & Co', 'equity'],
    ['XOM UN', 'Exxon Mobil Corp', 'equity'],
  ],
  'us-rates': [
    ['UST 10Y', 'US Treasury 10Y', 'rates'],
    ['UST 2Y', 'US Treasury 2Y', 'rates'],
    ['UST 30Y', 'US Treasury 30Y', 'rates'],
  ],
  fx: [
    ['USDJPY', 'US Dollar / Japanese Yen', 'fx'],
    ['EURGBP', 'Euro / British Pound', 'fx'],
    ['AUDUSD', 'Australian Dollar / US Dollar', 'fx'],
  ],
  commodities: [
    ['CL1 Comdty', 'WTI Crude Future', 'commodity'],
    ['GC1 Comdty', 'Gold Future', 'commodity'],
    ['NG1 Comdty', 'Natural Gas Future', 'commodity'],
  ],
  credit: [
    ['CDX IG S42', 'CDX North America IG', 'credit'],
    ['ITRX XOVER S42', 'iTraxx Crossover', 'credit'],
    ['BAC 4.2 2030', 'Bank of America 4.2% 2030', 'credit'],
  ],
};

const DESKS = Object.keys(INSTRUMENTS) as Desk[];
const CATEGORIES: Category[] = [
  'spoofing_layering',
  'wash_trade',
  'position_limit',
  'best_execution',
  'restricted_list',
  'late_reporting',
  'insider_dealing',
  'marking_the_close',
];
const ANALYSTS = ['U-01', 'U-02', 'U-03', 'U-06'];

const CLOSE_NOTES: Record<ResolutionOutcome, string[]> = {
  false_positive: [
    'Pattern consistent with legitimate market-making activity.',
    'Reviewed order flow; no manipulative intent found.',
    'Desk head confirmed the activity was client-driven.',
  ],
  true_positive: ['Confirmed breach; reported to the compliance lead.'],
  duplicate: ['Duplicate of an earlier alert on the same instrument.'],
  other: ['Closed after desk review; no further action required.'],
};

interface Draft {
  title: string;
  summary: string;
  description: string;
  highlights: Highlight[];
}

function draft(
  f: Faker,
  category: Category,
  symbol: string,
  traderId: string,
  traderName: string,
): Draft {
  const pct = (lo: number, hi: number) => `${f.number.int({ min: lo, max: hi })}%`;
  const notional = `€${f.number.float({ min: 0.8, max: 24, fractionDigits: 1 })}m`;
  const orders = f.number.int({ min: 12, max: 90 });
  const base = (title: string, summary: string, metrics: Highlight[]): Draft => ({
    title,
    summary,
    description: `${summary}\n\n- Trader: ${traderId} ${traderName}\n- Instrument: ${symbol}\n- Orders reviewed: ${orders}`,
    highlights: [...metrics, { label: 'Notional', value: notional, tone: 'neutral' }],
  });
  switch (category) {
    case 'spoofing_layering':
      return base(
        `Possible spoofing in ${symbol} by ${traderId}`,
        `Short-lived quotes in ${symbol} were cancelled in bursts with little execution.`,
        [{ label: 'Cancelled share', value: pct(91, 99), tone: 'warning' }],
      );
    case 'wash_trade':
      return base(
        `Potential wash trades in ${symbol} by ${traderId}`,
        `Matched prints between linked accounts in ${symbol} within a short window.`,
        [{ label: 'Self-matched volume', value: pct(21, 40), tone: 'warning' }],
      );
    case 'position_limit':
      return base(
        `Position limit utilisation above threshold in ${symbol}`,
        `Net position in ${symbol} approached the regulatory limit.`,
        [{ label: 'Limit utilisation', value: pct(91, 99), tone: 'warning' }],
      );
    case 'best_execution':
      return base(
        `Best-execution slippage on ${symbol} orders`,
        `Fills on ${symbol} orders slipped beyond the arrival-price threshold.`,
        [
          {
            label: 'Slippage',
            value: `${f.number.int({ min: 16, max: 40 })} bps`,
            tone: 'warning',
          },
        ],
      );
    case 'restricted_list':
      return base(
        `Watch list activity: ${symbol} traded by ${traderId}`,
        `A watch-listed instrument, ${symbol}, was traded by ${traderName}.`,
        [{ label: 'Watch list hit', value: 'Yes', tone: 'warning' }],
      );
    case 'late_reporting':
      return base(
        `Late trade report for ${symbol}`,
        `A ${symbol} trade was reported outside the permitted window.`,
        [
          {
            label: 'Reporting delay',
            value: `${f.number.int({ min: 16, max: 60 })} min`,
            tone: 'warning',
          },
        ],
      );
    case 'insider_dealing':
      return base(
        `Unusual pre-announcement trading in ${symbol}`,
        `${traderName} traded ${symbol} shortly before a corporate announcement.`,
        [
          {
            label: 'Days before announcement',
            value: `${f.number.int({ min: 1, max: 4 })}`,
            tone: 'warning',
          },
        ],
      );
    case 'marking_the_close':
      return base(
        `Elevated closing-auction activity in ${symbol}`,
        `${traderName} accounted for a high share of ${symbol} closing-auction volume.`,
        [{ label: 'Closing auction share', value: pct(31, 55), tone: 'warning' }],
      );
  }
}

function activityTab(f: Faker, ctx: SeedCtx, createdAt: string) {
  const start = new Date(createdAt).getTime() - 2 * H;
  const price = f.number.float({ min: 20, max: 400, fractionDigits: 2 });
  return {
    id: 'activity',
    title: 'Activity',
    columns: [
      { key: 'time', label: 'Time', type: 'datetime' as const },
      { key: 'side', label: 'Side', type: 'string' as const },
      { key: 'price', label: 'Price', type: 'currency' as const },
      { key: 'qty', label: 'Qty', type: 'number' as const },
    ],
    rows: Array.from({ length: 6 }, (_, i) => ({
      time: new Date(Math.min(start + i * 7 * MIN, ctx.now.getTime())).toISOString(),
      side: f.helpers.arrayElement(['BUY', 'SELL']),
      price: Number(
        (price + f.number.float({ min: -0.5, max: 0.5, fractionDigits: 2 })).toFixed(2),
      ),
      qty: f.number.int({ min: 1, max: 40 }) * 100,
    })),
  };
}

export function buildBackground(ctx: SeedCtx, f: Faker, count: number): SeedPart {
  const story = new Set<string>(STORY_IDS);
  const alerts: Alert[] = [];
  const timeline: TimelineEvent[] = [];
  let n = 900;
  while (alerts.length < count) {
    const id = `ALT-${String(n++).padStart(4, '0')}`;
    if (story.has(id)) continue;

    const category = f.helpers.arrayElement(CATEGORIES);
    const desk = f.helpers.arrayElement(DESKS);
    let severity: Severity = f.helpers.weightedArrayElement([
      { value: 'low' as const, weight: 3 },
      { value: 'medium' as const, weight: 5 },
      { value: 'high' as const, weight: 3 },
      { value: 'critical' as const, weight: 1 },
    ]);
    const status: AlertStatus = f.helpers.weightedArrayElement([
      { value: 'open' as const, weight: 35 },
      { value: 'in_progress' as const, weight: 25 },
      { value: 'closed' as const, weight: 40 },
    ]);
    // Keeps the rehearsal's "open + high + EU Equities" set to the three story alerts.
    if (desk === 'eu-equities' && severity === 'high' && status === 'open') severity = 'medium';

    const [traderId, traderName] = f.helpers.arrayElement(TRADERS);
    const [symbol, name, assetClass] = f.helpers.arrayElement(INSTRUMENTS[desk]);
    const primaryId = f.helpers.arrayElement(ANALYSTS);
    const backupId = f.helpers.arrayElement(ANALYSTS.filter((u) => u !== primaryId));

    // Background alerts are at least two days old so they never touch "today" activity.
    const createdMs = ctx.now.getTime() - 2 * D - f.number.int({ min: 0, max: 88 * 24 * 60 }) * MIN;
    const createdAt = new Date(createdMs).toISOString();
    const text = draft(f, category, symbol, traderId, traderName);
    const events: TimelineEvent[] = [
      ctx.event({ type: 'created', alertId: id, at: createdAt, actorId: 'system', via: 'app' }),
    ];
    let resolution: Alert['resolution'];
    let t = createdMs;
    if (status !== 'open') {
      t += f.number.int({ min: 30, max: 6 * 60 }) * MIN;
      events.push(
        ctx.event({
          type: 'status_changed',
          alertId: id,
          at: new Date(t).toISOString(),
          actorId: primaryId,
          via: 'app',
          from: 'open',
          to: 'in_progress',
        }),
      );
    }
    if (status === 'closed') {
      const outcome = f.helpers.weightedArrayElement([
        { value: 'false_positive' as const, weight: 7 },
        { value: 'true_positive' as const, weight: 1 },
        { value: 'duplicate' as const, weight: 1 },
        { value: 'other' as const, weight: 1 },
      ]);
      const note = f.helpers.arrayElement(CLOSE_NOTES[outcome]);
      t += f.number.int({ min: 30, max: 6 * 60 }) * MIN;
      events.push(
        ctx.event({
          type: 'comment',
          alertId: id,
          at: new Date(t).toISOString(),
          actorId: primaryId,
          via: 'app',
          body: note,
        }),
      );
      t += MIN;
      const closedAt = new Date(t).toISOString();
      events.push(
        ctx.event({
          type: 'status_changed',
          alertId: id,
          at: closedAt,
          actorId: primaryId,
          via: 'app',
          from: 'in_progress',
          to: 'closed',
          reason: note,
        }),
      );
      resolution = { outcome, note, closedBy: primaryId, closedAt };
    }

    alerts.push({
      id,
      ...text,
      status,
      severity,
      category,
      rule: rule(BACKGROUND_RULE[category]),
      desk,
      trader: { id: traderId, name: traderName },
      instrument: { symbol, name, assetClass },
      assignees: { primaryId, backupId, escalatedTo: [] },
      dataTabs: [activityTab(f, ctx, createdAt)],
      links: [],
      attachments: [],
      ...(resolution ? { resolution } : {}),
      createdAt,
      updatedAt: new Date(t).toISOString(),
    });
    timeline.push(...events);
  }
  return { alerts, timeline, attachments: [] };
}
