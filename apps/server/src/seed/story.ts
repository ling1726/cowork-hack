import type { Alert, DataTab, TimelineEvent } from '@app/domain';
import { D, H, MIN, type SeedCtx, type SeedAttachment, type SeedPart } from './context.ts';
import { csvBytes, pdfBytes } from './placeholder-files.ts';
import { rule } from './rules.ts';

export const STORY_IDS = [
  'ALT-0911',
  'ALT-0958',
  'ALT-0987',
  'ALT-1013',
  'ALT-1029',
  'ALT-1033',
  'ALT-1042',
  'ALT-1047',
  'ALT-1049',
  'ALT-1051',
] as const;

const SYSTEM = 'system';

/** Orders for ALT-1042: 68 orders / 2 executions = 34:1, 49 of 68 cancelled fast = 72%. */
function layeringOrders(ctx: SeedCtx): DataTab {
  const start = ctx.now.getTime() - 3 * H;
  const rows: DataTab['rows'] = [];
  let k = 0; // index among the 66 non-filled (layering) orders
  for (let i = 0; i < 68; i++) {
    const time = new Date(start + i * 45_000).toISOString();
    if (i === 20 || i === 48) {
      rows.push({
        time,
        side: 'SELL',
        price: 215.45,
        qty: 800,
        status: 'filled',
        cancelLatencyMs: 0,
      });
      continue;
    }
    const fast = k % 4 !== 3 && k !== 1;
    rows.push({
      time,
      side: 'BUY',
      price: Number((215.4 - 0.05 * (k % 5)).toFixed(2)),
      qty: 4000 + ((k * 350) % 6000),
      status: 'cancelled',
      cancelLatencyMs: fast ? 40 + ((k * 37) % 440) : 600 + ((k * 211) % 4000),
    });
    k++;
  }
  return {
    id: 'orders',
    title: 'Orders',
    columns: [
      { key: 'time', label: 'Time', type: 'datetime' },
      { key: 'side', label: 'Side', type: 'string' },
      { key: 'price', label: 'Price', type: 'currency' },
      { key: 'qty', label: 'Qty', type: 'number' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'cancelLatencyMs', label: 'Cancel latency (ms)', type: 'number' },
    ],
    rows,
  };
}

function executions(orders: DataTab): DataTab {
  const fills = orders.rows.filter((r) => r.status === 'filled');
  return {
    id: 'executions',
    title: 'Executions',
    columns: [
      { key: 'time', label: 'Time', type: 'datetime' },
      { key: 'side', label: 'Side', type: 'string' },
      { key: 'price', label: 'Price', type: 'currency' },
      { key: 'qty', label: 'Qty', type: 'number' },
      { key: 'venue', label: 'Venue', type: 'string' },
    ],
    rows: fills.map((r, i) => ({
      time: String(r.time),
      side: String(r.side),
      price: Number(r.price),
      qty: Number(r.qty),
      venue: i === 0 ? 'XETR' : 'CHIX',
    })),
  };
}

function finish(alert: Alert, events: TimelineEvent[]): Alert {
  const last = Math.max(...events.map((e) => new Date(e.at).getTime()));
  return { ...alert, updatedAt: new Date(last).toISOString() };
}

const noAssignees = (primaryId: string, backupId: string) => ({
  primaryId,
  backupId,
  escalatedTo: [],
});

export function buildStory(ctx: SeedCtx): SeedPart {
  const alerts: Alert[] = [];
  const timeline: TimelineEvent[] = [];
  const attachments: SeedAttachment[] = [];
  const created = (alertId: string, at: string) =>
    ctx.event({ type: 'created', alertId, at, actorId: SYSTEM, via: 'app' });
  const comment = (alertId: string, ms: number, actorId: string, body: string) =>
    ctx.event({ type: 'comment', alertId, at: ctx.ago(ms), actorId, via: 'app', body });
  const status = (
    alertId: string,
    ms: number,
    actorId: string,
    from: 'open' | 'in_progress',
    to: 'in_progress' | 'closed',
    reason?: string,
  ) =>
    ctx.event({
      type: 'status_changed',
      alertId,
      at: ctx.ago(ms),
      actorId,
      via: 'app',
      from,
      to,
      ...(reason ? { reason } : {}),
    });
  const add = (alert: Alert, events: TimelineEvent[]) => {
    alerts.push(finish(alert, events));
    timeline.push(...events);
  };

  // ---- ALT-1042 — the main demo alert (W1, W2, W3, W6) ----
  {
    const orders = layeringOrders(ctx);
    const blotter = csvBytes(
      orders.columns.map((c) => c.key),
      orders.rows,
    );
    const attId = ctx.ids.next('ATT');
    const lnkId = ctx.ids.next('LNK');
    const attAt = ctx.ago(95 * MIN);
    attachments.push({
      meta: {
        id: attId,
        filename: 'order-blotter.csv',
        mimeType: 'text/csv',
        sizeBytes: blotter.length,
        uploadedBy: 'U-03',
        uploadedAt: attAt,
      },
      bytes: blotter,
    });
    const events = [
      created('ALT-1042', ctx.ago(2 * H)),
      ctx.event({
        type: 'link_added',
        alertId: 'ALT-1042',
        at: ctx.ago(100 * MIN),
        actorId: 'U-03',
        via: 'app',
        linkId: lnkId,
      }),
      ctx.event({
        type: 'attachment_added',
        alertId: 'ALT-1042',
        at: attAt,
        actorId: 'U-03',
        via: 'app',
        attachmentId: attId,
      }),
    ];
    add(
      {
        id: 'ALT-1042',
        title: 'Possible layering in SAP GY by T-0412',
        summary:
          'Sixty-eight orders in SAP GY over 51 minutes against two executions, with most large buy orders cancelled within milliseconds of a sell-side fill.',
        description:
          'Surveillance flagged a **layering** pattern in SAP GY (XETR) by trader T-0412 James Whitfield.\n\n' +
          '- 66 large buy orders were placed one to five ticks below the touch.\n' +
          '- Two small sell orders were then filled at the offer.\n' +
          '- Most buy orders were cancelled within 500 ms of the sell fills.\n\n' +
          'Review the order and execution tabs against the rule indicators before deciding on a next step.',
        status: 'open',
        severity: 'high',
        category: 'spoofing_layering',
        rule: rule('MAR-12-1a'),
        desk: 'eu-equities',
        trader: { id: 'T-0412', name: 'James Whitfield' },
        instrument: { symbol: 'SAP GY', name: 'SAP SE', assetClass: 'equity' },
        assignees: noAssignees('U-01', 'U-03'),
        highlights: [
          { label: 'Order-to-trade ratio', value: '34:1', tone: 'danger' },
          { label: 'Fast cancels', value: '72%', tone: 'danger' },
          { label: 'Book imbalance', value: '64%', tone: 'neutral' },
          { label: 'Notional', value: '€18.4m', tone: 'neutral' },
        ],
        dataTabs: [orders, executions(orders)],
        links: [
          {
            id: lnkId,
            title: 'Layering surveillance runbook',
            url: 'https://example.com/runbooks/layering',
            addedBy: 'U-03',
            addedAt: events[1]?.at ?? ctx.ago(100 * MIN),
          },
        ],
        attachments: [
          {
            id: attId,
            filename: 'order-blotter.csv',
            mimeType: 'text/csv',
            sizeBytes: blotter.length,
            uploadedBy: 'U-03',
            uploadedAt: attAt,
          },
        ],
        createdAt: ctx.ago(2 * H),
        updatedAt: ctx.ago(2 * H),
      },
      events,
    );
  }

  // ---- T-0412 history (W3) ----
  const t0412 = { id: 'T-0412', name: 'James Whitfield' };
  add(
    {
      id: 'ALT-0911',
      title: 'Possible layering in BMW GY by T-0412',
      summary: 'Repeated one-sided order stacking in BMW GY ahead of two small sell executions.',
      description:
        'Surveillance flagged order stacking in BMW GY by T-0412. Cancel timing was inconsistent with market-making quote refreshes.',
      status: 'closed',
      severity: 'medium',
      category: 'spoofing_layering',
      rule: rule('MAR-12-1a'),
      desk: 'eu-equities',
      trader: t0412,
      instrument: { symbol: 'BMW GY', name: 'Bayerische Motoren Werke AG', assetClass: 'equity' },
      assignees: noAssignees('U-02', 'U-03'),
      highlights: [
        { label: 'Order-to-trade ratio', value: '24:1', tone: 'warning' },
        { label: 'Fast cancels', value: '48%', tone: 'neutral' },
      ],
      dataTabs: [],
      links: [],
      attachments: [],
      resolution: {
        outcome: 'false_positive',
        note: 'Quote refresh pattern consistent with market-making mandate.',
        closedBy: 'U-02',
        closedAt: ctx.ago(47 * D),
      },
      createdAt: ctx.ago(49 * D),
      updatedAt: ctx.ago(49 * D),
    },
    [
      created('ALT-0911', ctx.ago(49 * D)),
      status('ALT-0911', 48 * D, 'U-02', 'open', 'in_progress'),
      comment(
        'ALT-0911',
        47 * D + MIN,
        'U-02',
        'Quote refresh pattern consistent with market-making mandate.',
      ),
      status(
        'ALT-0911',
        47 * D,
        'U-02',
        'in_progress',
        'closed',
        'Quote refresh pattern consistent with market-making mandate.',
      ),
    ],
  );
  add(
    {
      id: 'ALT-0958',
      title: 'Potential wash trades in SIE GY by T-0412',
      summary:
        'Matched buy and sell prints between two linked accounts in SIE GY within a short window.',
      description:
        'Two accounts under the same beneficial owner traded against each other in SIE GY on three occasions.',
      status: 'closed',
      severity: 'medium',
      category: 'wash_trade',
      rule: rule('MAR-12-1b'),
      desk: 'eu-equities',
      trader: t0412,
      instrument: { symbol: 'SIE GY', name: 'Siemens AG', assetClass: 'equity' },
      assignees: noAssignees('U-06', 'U-02'),
      highlights: [{ label: 'Self-matched volume', value: '18%', tone: 'warning' }],
      dataTabs: [],
      links: [],
      attachments: [],
      resolution: {
        outcome: 'false_positive',
        note: 'Internal transfer between two funds; documented and approved.',
        closedBy: 'U-06',
        closedAt: ctx.ago(26 * D),
      },
      createdAt: ctx.ago(28 * D),
      updatedAt: ctx.ago(28 * D),
    },
    [
      created('ALT-0958', ctx.ago(28 * D)),
      status('ALT-0958', 27 * D, 'U-06', 'open', 'in_progress'),
      comment(
        'ALT-0958',
        26 * D + MIN,
        'U-06',
        'Internal transfer between two funds; documented and approved.',
      ),
      status(
        'ALT-0958',
        26 * D,
        'U-06',
        'in_progress',
        'closed',
        'Internal transfer between two funds; documented and approved.',
      ),
    ],
  );
  add(
    {
      id: 'ALT-1013',
      title: 'Potential wash trades in BAS GY by T-0412',
      summary:
        'Another cross-account matched sequence in BAS GY, third alert for this trader in seven weeks.',
      description:
        'Cross-account buy and sell prints in BAS GY within seconds of each other. The same trader has two earlier closed alerts.',
      status: 'in_progress',
      severity: 'medium',
      category: 'wash_trade',
      rule: rule('MAR-12-1b'),
      desk: 'eu-equities',
      trader: t0412,
      instrument: { symbol: 'BAS GY', name: 'BASF SE', assetClass: 'equity' },
      assignees: noAssignees('U-01', 'U-02'),
      highlights: [{ label: 'Self-matched volume', value: '22%', tone: 'warning' }],
      dataTabs: [],
      links: [],
      attachments: [],
      createdAt: ctx.ago(14 * D),
      updatedAt: ctx.ago(14 * D),
    },
    [
      created('ALT-1013', ctx.ago(14 * D)),
      status('ALT-1013', 13 * D, 'U-01', 'open', 'in_progress'),
      comment('ALT-1013', 10 * D, 'U-02', 'Requested the account linkage report from operations.'),
      comment('ALT-1013', 3 * H, 'U-01', 'Linkage report received; reviewing the matched prints.'),
    ],
  );

  // ---- W4 pair ----
  {
    const trade = ctx.dayAt(22, 14, 5);
    const entry = ctx.dayAt(22, 16, 30);
    const memoBytes = pdfBytes(
      'Restricted list memo - Project Kestrel - NVLX added after trade date',
    );
    const attId = ctx.ids.next('ATT');
    const attAt = ctx.ago(21 * D + H);
    attachments.push({
      meta: {
        id: attId,
        filename: 'restricted-list-memo.pdf',
        mimeType: 'application/pdf',
        sizeBytes: memoBytes.length,
        uploadedBy: 'U-03',
        uploadedAt: attAt,
      },
      bytes: memoBytes,
    });
    const closeNote = 'Name added to restricted list after trade; timing benign';
    add(
      {
        id: 'ALT-0987',
        title: 'Restricted list: NVLX traded by T-0733',
        summary:
          'NVLX was added to the restricted list shortly after a trade by a Project Kestrel deal-team member.',
        description:
          'T-0733 Elena Rossi traded NVLX (Novalux Pharma) on the day it was added to the restricted list.\n\n' +
          'Deal team: **Project Kestrel**.',
        status: 'closed',
        severity: 'medium',
        category: 'restricted_list',
        rule: rule('RL-01'),
        desk: 'us-equities',
        trader: { id: 'T-0733', name: 'Elena Rossi' },
        instrument: { symbol: 'NVLX', name: 'Novalux Pharma', assetClass: 'equity' },
        assignees: noAssignees('U-03', 'U-04'),
        highlights: [
          { label: 'Deal team', value: 'Project Kestrel', tone: 'neutral' },
          { label: 'Trade before listing', value: 'Yes', tone: 'warning' },
        ],
        dataTabs: [
          {
            id: 'trades',
            title: 'Trades',
            columns: [
              { key: 'time', label: 'Time', type: 'datetime' },
              { key: 'trader', label: 'Trader', type: 'string' },
              { key: 'side', label: 'Side', type: 'string' },
              { key: 'qty', label: 'Qty', type: 'number' },
              { key: 'price', label: 'Price', type: 'currency' },
            ],
            rows: [
              {
                time: ctx.dayAt(22, 13, 40),
                trader: 'T-0733 Elena Rossi',
                side: 'BUY',
                qty: 5000,
                price: 41.1,
              },
            ],
          },
        ],
        links: [],
        attachments: [
          {
            id: attId,
            filename: 'restricted-list-memo.pdf',
            mimeType: 'application/pdf',
            sizeBytes: memoBytes.length,
            uploadedBy: 'U-03',
            uploadedAt: attAt,
          },
        ],
        resolution: {
          outcome: 'false_positive',
          note: closeNote,
          closedBy: 'U-03',
          closedAt: ctx.ago(21 * D),
        },
        createdAt: ctx.dayAt(22, 17, 0),
        updatedAt: ctx.ago(21 * D),
      },
      [
        created('ALT-0987', ctx.dayAt(22, 17, 0)),
        ctx.event({
          type: 'status_changed',
          alertId: 'ALT-0987',
          at: ctx.dayAt(22, 18, 0),
          actorId: 'U-03',
          via: 'app',
          from: 'open',
          to: 'in_progress',
        }),
        ctx.event({
          type: 'attachment_added',
          alertId: 'ALT-0987',
          at: attAt,
          actorId: 'U-03',
          via: 'app',
          attachmentId: attId,
        }),
        comment(
          'ALT-0987',
          21 * D + MIN,
          'U-03',
          'Name added to restricted list after trade; timing benign.',
        ),
        status('ALT-0987', 21 * D, 'U-03', 'in_progress', 'closed', closeNote),
      ],
    );
    add(
      {
        id: 'ALT-1051',
        title: 'Restricted list: NVLX traded by T-0741',
        summary: 'A second Project Kestrel member traded NVLX before the restricted-list entry.',
        description:
          'T-0741 Marcus Hale, a member of **Project Kestrel**, bought NVLX (Novalux Pharma) before the instrument was added to the restricted list.',
        status: 'open',
        severity: 'high',
        category: 'restricted_list',
        rule: rule('RL-01'),
        desk: 'us-equities',
        trader: { id: 'T-0741', name: 'Marcus Hale' },
        instrument: { symbol: 'NVLX', name: 'Novalux Pharma', assetClass: 'equity' },
        assignees: noAssignees('U-03', 'U-04'),
        highlights: [
          { label: 'Deal team', value: 'Project Kestrel', tone: 'warning' },
          { label: 'Trade before listing', value: 'Yes', tone: 'danger' },
        ],
        dataTabs: [
          {
            id: 'trades',
            title: 'Trades',
            columns: [
              { key: 'time', label: 'Time', type: 'datetime' },
              { key: 'trader', label: 'Trader', type: 'string' },
              { key: 'side', label: 'Side', type: 'string' },
              { key: 'qty', label: 'Qty', type: 'number' },
              { key: 'price', label: 'Price', type: 'currency' },
            ],
            rows: [
              { time: trade, trader: 'T-0741 Marcus Hale', side: 'BUY', qty: 12000, price: 41.2 },
            ],
          },
          {
            id: 'restrictedListEntry',
            title: 'Restricted list entry',
            columns: [
              { key: 'time', label: 'Time', type: 'datetime' },
              { key: 'instrument', label: 'Instrument', type: 'string' },
              { key: 'addedBy', label: 'Added by', type: 'string' },
            ],
            rows: [{ time: entry, instrument: 'NVLX', addedBy: 'Compliance (Project Kestrel)' }],
          },
        ],
        links: [],
        attachments: [],
        createdAt: ctx.ago(1 * H),
        updatedAt: ctx.ago(1 * H),
      },
      [created('ALT-1051', ctx.ago(1 * H))],
    );
  }

  // ---- W1 companions ----
  add(
    {
      id: 'ALT-1047',
      title: 'Possible layering in SIE GY by T-0501',
      summary: 'Large resting buy orders in SIE GY cancelled just ahead of small sell fills.',
      description:
        'Surveillance flagged a layering-style pattern in SIE GY (XETR) by trader T-0501 Marta Kowalski.',
      status: 'open',
      severity: 'high',
      category: 'spoofing_layering',
      rule: rule('MAR-12-1a'),
      desk: 'eu-equities',
      trader: { id: 'T-0501', name: 'Marta Kowalski' },
      instrument: { symbol: 'SIE GY', name: 'Siemens AG', assetClass: 'equity' },
      assignees: noAssignees('U-03', 'U-01'),
      highlights: [
        { label: 'Order-to-trade ratio', value: '27:1', tone: 'danger' },
        { label: 'Fast cancels', value: '55%', tone: 'neutral' },
      ],
      dataTabs: [],
      links: [],
      attachments: [],
      createdAt: ctx.ago(5 * H),
      updatedAt: ctx.ago(5 * H),
    },
    [created('ALT-1047', ctx.ago(5 * H))],
  );
  add(
    {
      id: 'ALT-1049',
      title: 'Elevated closing-auction activity in ASML NA by T-0388',
      summary:
        'Concentrated buying in the closing auction moved the ASML NA close above the day range.',
      description:
        'T-0388 Oskar Lindqvist accounted for a high share of ASML NA closing-auction volume on the last two sessions.',
      status: 'open',
      severity: 'high',
      category: 'marking_the_close',
      rule: rule('MC-01'),
      desk: 'eu-equities',
      trader: { id: 'T-0388', name: 'Oskar Lindqvist' },
      instrument: { symbol: 'ASML NA', name: 'ASML Holding NV', assetClass: 'equity' },
      assignees: noAssignees('U-01', 'U-03'),
      highlights: [{ label: 'Closing auction share', value: '38%', tone: 'warning' }],
      dataTabs: [],
      links: [],
      attachments: [],
      createdAt: ctx.ago(4 * H),
      updatedAt: ctx.ago(4 * H),
    },
    [created('ALT-1049', ctx.ago(4 * H))],
  );

  // ---- W5 activity ----
  add(
    {
      id: 'ALT-1033',
      title: 'Best-execution slippage on EURUSD orders',
      summary: 'Fills on a block of EURUSD orders slipped beyond the best-execution threshold.',
      description:
        'Average slippage versus arrival price exceeded the threshold on a block of EURUSD orders.',
      status: 'in_progress',
      severity: 'medium',
      category: 'best_execution',
      rule: rule('BE-01'),
      desk: 'fx',
      trader: { id: 'T-0620', name: 'Lucia Moretti' },
      instrument: { symbol: 'EURUSD', name: 'Euro / US Dollar', assetClass: 'fx' },
      assignees: noAssignees('U-01', 'U-06'),
      highlights: [{ label: 'Slippage', value: '19 bps', tone: 'warning' }],
      dataTabs: [],
      links: [],
      attachments: [],
      createdAt: ctx.ago(26 * H),
      updatedAt: ctx.ago(26 * H),
    },
    [
      created('ALT-1033', ctx.ago(26 * H)),
      status('ALT-1033', 2 * H, 'U-01', 'open', 'in_progress'),
    ],
  );
  add(
    {
      id: 'ALT-1029',
      title: 'Late trade report for GBPUSD swap',
      summary: 'A GBPUSD swap was reported 18 minutes after execution.',
      description: 'Trade report for a GBPUSD swap was published later than the 15 minute window.',
      status: 'closed',
      severity: 'low',
      category: 'late_reporting',
      rule: rule('LR-01'),
      desk: 'fx',
      trader: { id: 'T-0618', name: 'Peter Novak' },
      instrument: { symbol: 'GBPUSD', name: 'British Pound / US Dollar', assetClass: 'fx' },
      assignees: noAssignees('U-01', 'U-06'),
      highlights: [{ label: 'Reporting delay', value: '18 min', tone: 'warning' }],
      dataTabs: [],
      links: [],
      attachments: [],
      resolution: {
        outcome: 'false_positive',
        note: 'Vendor timestamp skew; trade was reported within the window.',
        closedBy: 'U-01',
        closedAt: ctx.ago(1 * H),
      },
      createdAt: ctx.ago(2 * D),
      updatedAt: ctx.ago(2 * D),
    },
    [
      created('ALT-1029', ctx.ago(2 * D)),
      status('ALT-1029', 30 * H, 'U-03', 'open', 'in_progress'),
      status(
        'ALT-1029',
        1 * H,
        'U-01',
        'in_progress',
        'closed',
        'Vendor timestamp skew; trade was reported within the window.',
      ),
    ],
  );

  return { alerts, timeline, attachments };
}
