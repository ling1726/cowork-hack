import type { ActionRequest, Alert, AlertSummary, DataTab, TimelineEvent, User } from '@app/domain';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  ActionRequestCard,
  AlertHeader,
  AlertHighlights,
  AlertStatusBadge,
  AlertSummaryCard,
  AlertTable,
  AlertTimeline,
  AssigneesPanel,
  DataTabTable,
  SeverityBadge,
  StatCard,
  ViaClaudeTag,
  primaryAction,
} from '../src/index.ts';

const renderUi = (ui: ReactElement) => render(ui);

const users: User[] = [
  { id: 'U-01', name: 'Priya Shah', role: 'analyst', desk: 'eu-equities', initials: 'PS' },
  { id: 'U-03', name: 'Mei Lin', role: 'senior_analyst', initials: 'ML' },
  { id: 'U-04', name: 'Daniel Okafor', role: 'compliance_lead', initials: 'DO' },
];

const summary: AlertSummary = {
  id: 'ALT-1042',
  title: 'Possible layering in SAP GY by T-0412',
  status: 'open',
  severity: 'high',
  category: 'spoofing_layering',
  desk: 'eu-equities',
  trader: { id: 'T-0412', name: 'James Whitfield' },
  instrument: { symbol: 'SAP GY', name: 'SAP SE', assetClass: 'equity' },
  rule: { id: 'MAR-12-1a', name: 'Layering / spoofing' },
  assignees: { primaryId: 'U-01', backupId: 'U-03', escalatedTo: [] },
  createdAt: '2026-11-17T07:00:00.000Z',
  updatedAt: '2026-11-17T07:00:00.000Z',
};

const alert: Alert = {
  ...summary,
  summary: 'Many cancelled orders.',
  description: 'Layering pattern.',
  rule: { id: 'MAR-12-1a', name: 'Layering / spoofing', regulation: 'EU MAR', indicators: [] },
  highlights: [
    { label: 'Order-to-trade ratio', value: '34:1', tone: 'danger' },
    { label: 'Book imbalance', value: '64%', tone: 'neutral' },
  ],
  dataTabs: [],
  links: [],
  attachments: [],
};

const base = { alertId: 'ALT-1042', actorId: 'U-01' };
const events: TimelineEvent[] = [
  {
    ...base,
    id: 'EV-1',
    at: '2026-11-17T07:00:00.000Z',
    actorId: 'system',
    via: 'app',
    type: 'created',
  },
  {
    ...base,
    id: 'EV-2',
    at: '2026-11-17T07:05:00.000Z',
    via: 'claude',
    type: 'comment',
    body: 'Recommend escalation.',
    actionRequestId: 'AR-0001',
    approvedBy: 'U-01',
  },
  {
    ...base,
    id: 'EV-3',
    at: '2026-11-17T07:06:00.000Z',
    via: 'app',
    type: 'status_changed',
    from: 'open',
    to: 'in_progress',
  },
  {
    ...base,
    id: 'EV-4',
    at: '2026-11-17T07:07:00.000Z',
    via: 'app',
    type: 'escalated',
    toUserId: 'U-04',
    reason: 'Third alert for this trader.',
  },
  {
    ...base,
    id: 'EV-5',
    at: '2026-11-17T07:08:00.000Z',
    via: 'claude',
    type: 'action_requested',
    requestId: 'AR-0002',
    kind: 'acknowledge',
  },
];

const pending: ActionRequest = {
  id: 'AR-0001',
  alertId: 'ALT-1042',
  kind: 'add_comment',
  payload: { body: 'Recommend escalating to the Compliance Lead.' },
  onBehalfOf: 'U-01',
  via: 'claude',
  rationale: 'Two of three indicators are met.',
  status: 'pending',
  createdAt: '2026-11-17T07:05:00.000Z',
};

// @app/ui stays presentational: no router, query or store; react-table is a pure render helper.
const FORBIDDEN = /@tanstack\/react-(router|query)|from ['"]zustand/;
// No path aliases: phase 2 bundles import this source as is.
const ALIAS = /from ['"]@\//;

describe('@app/ui', () => {
  it('import guard allows react-table and bans router, query, zustand and path aliases', () => {
    expect(FORBIDDEN.test("from '@tanstack/react-table'")).toBe(false);
    expect(FORBIDDEN.test("from '@tanstack/react-router'")).toBe(true);
    expect(FORBIDDEN.test("from '@tanstack/react-query'")).toBe(true);
    expect(FORBIDDEN.test("from 'zustand'")).toBe(true);
    expect(ALIAS.test("from '@/lib/utils'")).toBe(true);
  });

  it('package source never imports router, query or zustand', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(name)) files.push(path);
      }
    };
    walk(join(import.meta.dirname, '../src'));
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      expect(src, file).not.toMatch(FORBIDDEN);
      expect(src, file).not.toMatch(ALIAS);
    }
  });

  it('badges show labels', () => {
    renderUi(
      <>
        <AlertStatusBadge status="in_progress" />
        <SeverityBadge severity="critical" />
      </>,
    );
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });

  it('SeverityBadge and AlertStatusBadge expose their value for styling', () => {
    renderUi(
      <>
        <AlertStatusBadge status="in_progress" />
        <SeverityBadge severity="critical" />
      </>,
    );
    expect(screen.getByTestId('severity-badge')).toHaveAttribute('data-severity', 'critical');
    expect(screen.getByTestId('status-badge')).toHaveAttribute('data-status', 'in_progress');
  });

  it('ViaClaudeTag renders "via Claude" and optionally "approved by"', () => {
    const { rerender } = renderUi(<ViaClaudeTag />);
    expect(screen.getByText('via Claude')).toBeInTheDocument();
    rerender(
      <>
        <ViaClaudeTag approvedByName="Priya Shah" />
      </>,
    );
    expect(screen.getByText('via Claude · approved by Priya Shah')).toBeInTheDocument();
  });

  it('AlertHeader renders Acknowledge for open and calls onAction("acknowledge")', async () => {
    const onAction = vi.fn();
    renderUi(
      <AlertHeader
        alert={summary}
        actions={['acknowledge', 'escalate', 'comment', 'edit_assignees']}
        onAction={onAction}
      />,
    );
    expect(
      screen.getByRole('heading', { name: /Possible layering in SAP GY/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('ALT-1042')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Acknowledge' }));
    expect(onAction).toHaveBeenCalledWith('acknowledge');
    // Only lifecycle and escalate actions are header actions; the rest live in More actions.
    expect(screen.queryByRole('button', { name: 'Escalate' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Comment' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit assignees' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(await screen.findByRole('menuitem', { name: 'Escalate' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Comment' })).toBeNull();
  });

  it('primaryAction prefers acknowledge, else the first allowed action', () => {
    expect(primaryAction(['close', 'acknowledge'])).toBe('acknowledge');
    expect(primaryAction(['reopen'])).toBe('reopen');
    expect(primaryAction([])).toBeUndefined();
  });

  it('AlertHeader puts the other actions in More actions', async () => {
    const onAction = vi.fn();
    renderUi(
      <AlertHeader
        alert={summary}
        actions={['acknowledge', 'close', 'escalate']}
        onAction={onAction}
      />,
    );
    expect(screen.getByRole('button', { name: 'Acknowledge' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'More actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Close' }));
    expect(onAction).toHaveBeenCalledWith('close');
  });

  it('AlertHeader with one action shows no More actions', () => {
    renderUi(<AlertHeader alert={summary} actions={['reopen']} onAction={() => {}} />);
    expect(screen.getByRole('button', { name: 'Reopen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull();
  });

  it('StatCard shows a skeleton, never 0, while loading', () => {
    const link = (href: string, children: ReactNode) => <a href={href}>{children}</a>;
    const { rerender } = renderUi(
      <StatCard label="Open" value={undefined} href="/alerts?status=open" renderLink={link} />,
    );
    const card = screen.getByTestId('stat-card');
    expect(card).not.toHaveTextContent('0');
    expect(within(card).getByTestId('stat-skeleton')).toBeInTheDocument();
    rerender(<StatCard label="Open" value={7} href="/alerts?status=open" renderLink={link} />);
    expect(screen.getByTestId('stat-card')).toHaveTextContent('7');
    expect(screen.getByTestId('stat-card')).toHaveTextContent('Open');
    expect(screen.getByRole('link', { name: /Open/ })).toHaveAttribute(
      'href',
      '/alerts?status=open',
    );
  });

  it('AlertHeader shows a pending count when Claude has requests waiting', () => {
    renderUi(<AlertHeader alert={summary} actions={[]} onAction={() => {}} pendingCount={2} />);
    expect(screen.getByTestId('pending-count')).toHaveTextContent('2');
  });

  it('AlertHighlights renders every highlight', () => {
    renderUi(<AlertHighlights highlights={alert.highlights} />);
    expect(screen.getByText('Order-to-trade ratio')).toBeInTheDocument();
    expect(screen.getByText('34:1')).toBeInTheDocument();
    expect(screen.getByText('64%')).toBeInTheDocument();
  });

  it('AssigneesPanel resolves names, lists escalations and offers Edit', async () => {
    const onEdit = vi.fn();
    renderUi(
      <AssigneesPanel
        assignees={{
          primaryId: 'U-01',
          backupId: 'U-03',
          escalatedTo: [
            { userId: 'U-04', at: '2026-11-17T07:07:00.000Z', byUserId: 'U-01', reason: 'Pattern' },
          ],
        }}
        users={users}
        onEdit={onEdit}
      />,
    );
    expect(screen.getByText('Priya Shah')).toBeInTheDocument();
    expect(screen.getByText('Mei Lin')).toBeInTheDocument();
    expect(screen.getByText('Daniel Okafor')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalled();
  });

  it('AlertTimeline marks claude events with "via Claude" and "approved by Priya Shah"', () => {
    renderUi(<AlertTimeline events={events} users={users} />);
    const items = screen.getAllByTestId('timeline-event');
    expect(items).toHaveLength(5);
    expect(
      within(items[1] as HTMLElement).getByText('via Claude · approved by Priya Shah'),
    ).toBeInTheDocument();
    expect(within(items[1] as HTMLElement).getByText('Recommend escalation.')).toBeInTheDocument();
    // App events carry no marker.
    expect(within(items[2] as HTMLElement).queryByText(/via Claude/)).toBeNull();
    expect(within(items[2] as HTMLElement).getByText(/Open → In Progress/)).toBeInTheDocument();
    expect(within(items[3] as HTMLElement).getByText(/Daniel Okafor/)).toBeInTheDocument();
    // A pending request has no approver yet.
    expect(within(items[4] as HTMLElement).getByText('via Claude')).toBeInTheDocument();
    // System-created event
    expect(within(items[0] as HTMLElement).getByText(/System/)).toBeInTheDocument();
  });

  it('AlertTimeline names Cowork on approvals and rejections decided there', () => {
    const base = { alertId: 'ALT-1042', at: '2026-11-17T09:00:00.000Z', actorId: 'U-01' };
    const events: TimelineEvent[] = [
      {
        ...base,
        id: 'EV-1',
        type: 'comment',
        body: 'x',
        via: 'claude',
        approvedBy: 'U-01',
        decidedIn: 'cowork',
      },
      {
        ...base,
        id: 'EV-2',
        type: 'action_rejected',
        requestId: 'AR-0002',
        via: 'app',
        decidedIn: 'cowork',
      },
    ];
    renderUi(<AlertTimeline events={events} users={users} />);
    expect(screen.getByTestId('via-claude')).toHaveTextContent('approved by Priya Shah in Cowork');
    expect(screen.getByText('Rejected request AR-0002 in Cowork')).toBeInTheDocument();
  });

  it('AlertTimeline links requested actions through renderLink', () => {
    const renderLink = vi.fn((href: string, label: string) => <a href={href}>{label}</a>);
    renderUi(<AlertTimeline events={events} users={users} renderLink={renderLink} />);
    expect(renderLink).toHaveBeenCalledWith('/queue/AR-0002', 'AR-0002');
    expect(screen.getByRole('link', { name: 'AR-0002' })).toHaveAttribute('href', '/queue/AR-0002');
  });

  it('AlertSummaryCard shows header, highlights, last 3 events and an Open in app link', () => {
    renderUi(
      <AlertSummaryCard
        alert={alert}
        recentEvents={events}
        users={users}
        openInAppHref="http://localhost:5173/alerts/ALT-1042"
      />,
    );
    expect(screen.getByText('34:1')).toBeInTheDocument();
    expect(screen.getAllByTestId('timeline-event')).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Open in app' })).toHaveAttribute(
      'href',
      'http://localhost:5173/alerts/ALT-1042',
    );
  });

  it('AlertTable lists rows with links and reports sort changes', async () => {
    const onSortChange = vi.fn();
    renderUi(
      <AlertTable
        items={[summary, { ...summary, id: 'ALT-1047', title: 'Another alert', severity: 'low' }]}
        sort="-createdAt"
        onSortChange={onSortChange}
        renderAlertLink={(id, label) => <a href={`/alerts/${id}`}>{label}</a>}
      />,
    );
    expect(screen.getByRole('link', { name: 'ALT-1042' })).toHaveAttribute(
      'href',
      '/alerts/ALT-1042',
    );
    expect(screen.getAllByRole('row').filter((r) => /ALT-/.test(r.textContent ?? ''))).toHaveLength(
      2,
    );
    await userEvent.click(screen.getByText('Severity'));
    expect(onSortChange).toHaveBeenCalledWith('-severity');
  });

  it('AlertTable flips the direction when the sorted column is clicked again', async () => {
    const onSortChange = vi.fn();
    renderUi(
      <AlertTable
        items={[summary]}
        sort="-severity"
        onSortChange={onSortChange}
        renderAlertLink={(id) => <span>{id}</span>}
      />,
    );
    await userEvent.click(screen.getByText('Severity'));
    expect(onSortChange).toHaveBeenCalledWith('severity');
  });

  it('AlertTable renders without a sort (relevance order) and still reports sort changes', async () => {
    const onSortChange = vi.fn();
    const { rerender } = renderUi(
      <AlertTable
        items={[summary]}
        sort="-createdAt"
        onSortChange={onSortChange}
        renderAlertLink={(id) => <span>{id}</span>}
      />,
    );
    // Going from a sorted state to none (a text search switches to relevance) must not crash.
    rerender(
      <>
        <AlertTable
          items={[summary]}
          onSortChange={onSortChange}
          renderAlertLink={(id) => <span>{id}</span>}
        />
      </>,
    );
    await userEvent.click(screen.getByText('Severity'));
    expect(onSortChange).toHaveBeenCalledWith('-severity');
  });

  it('AlertTable has Created and Updated sort headers', async () => {
    const onSortChange = vi.fn();
    const { rerender } = renderUi(
      <AlertTable
        items={[summary]}
        onSortChange={onSortChange}
        renderAlertLink={(id) => <span>{id}</span>}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Created' }));
    expect(onSortChange).toHaveBeenLastCalledWith('-createdAt');
    rerender(
      <AlertTable
        items={[summary]}
        sort="-createdAt"
        onSortChange={onSortChange}
        renderAlertLink={(id) => <span>{id}</span>}
      />,
    );
    expect(screen.getByRole('columnheader', { name: /Created/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Created' }));
    expect(onSortChange).toHaveBeenLastCalledWith('createdAt');
    await userEvent.click(screen.getByRole('button', { name: 'Updated' }));
    expect(onSortChange).toHaveBeenLastCalledWith('-updatedAt');
  });

  it('AlertTable rows call onRowClick, and the ID link does not double-fire', async () => {
    const onRowClick = vi.fn();
    renderUi(
      <AlertTable
        items={[summary]}
        onRowClick={onRowClick}
        renderAlertLink={(id, label) => (
          <a href={`#${id}`} onClick={(e) => e.preventDefault()}>
            {label}
          </a>
        )}
      />,
    );
    await userEvent.click(screen.getByText('Possible layering in SAP GY by T-0412'));
    expect(onRowClick).toHaveBeenCalledWith('ALT-1042');
    onRowClick.mockClear();
    await userEvent.click(screen.getByRole('link', { name: 'ALT-1042' }));
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('DataTabTable formats cells by column type', () => {
    const tab: DataTab = {
      id: 'orders',
      title: 'Orders',
      columns: [
        { key: 'time', label: 'Time', type: 'datetime' },
        { key: 'price', label: 'Price', type: 'currency' },
        { key: 'qty', label: 'Qty', type: 'number' },
        { key: 'side', label: 'Side', type: 'string' },
      ],
      rows: [{ time: '2026-11-17T07:00:00.000Z', price: 215.4, qty: 12000, side: 'BUY' }],
    };
    renderUi(<DataTabTable tab={tab} />);
    expect(screen.getByText('€215.40')).toBeInTheDocument();
    expect(screen.getByText('12,000')).toBeInTheDocument();
    expect(screen.getByText('BUY')).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it('ActionRequestCard shows rationale and exact comment body; Approve/Reject call callbacks', async () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    renderUi(
      <ActionRequestCard
        request={pending}
        alert={summary}
        onApprove={onApprove}
        onReject={onReject}
        renderAlertLink={(id, label) => <a href={`/alerts/${id}`}>{label}</a>}
      />,
    );
    expect(screen.getByText('Two of three indicators are met.')).toBeInTheDocument();
    expect(screen.getByText('Recommend escalating to the Compliance Lead.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ALT-1042/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(onApprove).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    await userEvent.type(screen.getByRole('textbox', { name: /reason/i }), 'Not yet');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm reject' }));
    expect(onReject).toHaveBeenCalledWith('Not yet');
  });

  it('ActionRequestCard rejects without a reason as undefined', async () => {
    const onReject = vi.fn();
    renderUi(
      <ActionRequestCard
        request={pending}
        alert={summary}
        onApprove={() => {}}
        onReject={onReject}
        renderAlertLink={(id, label) => <span>{`${id} ${label}`}</span>}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm reject' }));
    expect(onReject).toHaveBeenCalledWith(undefined);
  });

  it('ActionRequestCard disables buttons while busy and hides them when not pending', () => {
    const { rerender } = renderUi(
      <ActionRequestCard
        request={pending}
        alert={summary}
        onApprove={() => {}}
        onReject={() => {}}
        busy
        renderAlertLink={(id) => <span>{id}</span>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
    const decided: ActionRequest = { ...pending, status: 'approved', decidedBy: 'U-01' };
    rerender(
      <>
        <ActionRequestCard
          request={decided}
          alert={summary}
          onApprove={() => {}}
          onReject={() => {}}
          renderAlertLink={(id) => <span>{id}</span>}
        />
      </>,
    );
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull();
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('ActionRequestCard explains failed and rejected requests', () => {
    const { rerender } = renderUi(
      <ActionRequestCard
        request={{
          ...pending,
          status: 'failed',
          failure: {
            code: 'illegal_transition',
            message: 'Cannot acknowledge an alert that is in_progress',
          },
        }}
        alert={summary}
        renderAlertLink={(id) => <span>{id}</span>}
      />,
    );
    expect(screen.getByText(/Cannot acknowledge an alert that is in_progress/)).toBeInTheDocument();
    rerender(
      <>
        <ActionRequestCard
          request={{ ...pending, status: 'rejected', rejectReason: 'Not now.' }}
          alert={summary}
          renderAlertLink={(id) => <span>{id}</span>}
        />
      </>,
    );
    expect(screen.getByText(/Not now\./)).toBeInTheDocument();
  });

  it('ActionRequestCard shows who decided and where', () => {
    renderUi(
      <ActionRequestCard
        request={{
          ...pending,
          status: 'approved',
          decidedBy: 'U-01',
          decidedIn: 'cowork',
          decidedAt: '2026-11-17T09:05:00.000Z',
        }}
        alert={summary}
        decidedByName="Priya Shah"
        renderAlertLink={(id, label) => <span>{`${id} ${label}`}</span>}
      />,
    );
    expect(screen.getByTestId('decision')).toHaveTextContent('Approved by Priya Shah in Cowork');
  });

  it('ActionRequestCard says "in the app" for decisions without decidedIn', () => {
    renderUi(
      <ActionRequestCard
        request={{ ...pending, status: 'rejected', decidedBy: 'U-01' }}
        alert={summary}
        decidedByName="Priya Shah"
        renderAlertLink={(id, label) => <span>{`${id} ${label}`}</span>}
      />,
    );
    expect(screen.getByTestId('decision')).toHaveTextContent('Rejected by Priya Shah in the app');
  });

  it('ActionRequestCard renders its link slot', () => {
    renderUi(
      <ActionRequestCard
        request={pending}
        alert={summary}
        link={{ href: 'http://x/queue/AR-0001', label: 'Review in app' }}
        renderAlertLink={(id, label) => <span>{`${id} ${label}`}</span>}
      />,
    );
    expect(screen.getByRole('link', { name: /Review in app/ })).toHaveAttribute(
      'href',
      'http://x/queue/AR-0001',
    );
  });

  it('ViaClaudeTag names Cowork when the approval happened there', () => {
    renderUi(<ViaClaudeTag approvedByName="Priya Shah" decidedIn="cowork" />);
    expect(screen.getByTestId('via-claude')).toHaveTextContent(
      'via Claude · approved by Priya Shah in Cowork',
    );
  });

  it('AlertTable renders a row action that does not trigger the row click', async () => {
    const onRowClick = vi.fn();
    const onInvestigate = vi.fn();
    renderUi(
      <AlertTable
        items={[summary]}
        onRowClick={onRowClick}
        renderAlertLink={(id, label) => <span>{`${id} ${label}`}</span>}
        renderRowAction={(a) => (
          <button type="button" onClick={() => onInvestigate(a.id)}>
            Investigate
          </button>
        )}
      />,
    );
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Investigate' }));
    expect(onInvestigate).toHaveBeenCalledWith('ALT-1042');
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('ActionRequestCard previews an acknowledge request', () => {
    renderUi(
      <ActionRequestCard
        request={{
          id: 'AR-0002',
          alertId: 'ALT-1042',
          kind: 'acknowledge',
          payload: {},
          onBehalfOf: 'U-01',
          via: 'claude',
          rationale: 'Start work.',
          status: 'pending',
          createdAt: '2026-11-17T07:05:00.000Z',
        }}
        alert={summary}
        renderAlertLink={(id) => <span>{id}</span>}
      />,
    );
    expect(screen.getByText(/Acknowledge/)).toBeInTheDocument();
    expect(screen.getByText('Start work.')).toBeInTheDocument();
  });
});
