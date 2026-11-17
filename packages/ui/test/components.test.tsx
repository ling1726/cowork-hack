import type { ActionRequest, Alert, AlertSummary, DataTab, TimelineEvent, User } from '@app/domain';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactElement } from 'react';
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
  ViaClaudeTag,
} from '../src/index.ts';

const renderUi = (ui: ReactElement) =>
  render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);

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

describe('@app/ui', () => {
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
      expect(readFileSync(file, 'utf8'), file).not.toMatch(
        /@tanstack\/|from 'zustand|from "zustand/,
      );
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

  it('ViaClaudeTag renders "via Claude" and optionally "approved by"', () => {
    const { rerender } = renderUi(<ViaClaudeTag />);
    expect(screen.getByText('via Claude')).toBeInTheDocument();
    rerender(
      <FluentProvider theme={webLightTheme}>
        <ViaClaudeTag approvedByName="Priya Shah" />
      </FluentProvider>,
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
    // Only lifecycle and escalate actions are header buttons.
    expect(screen.getByRole('button', { name: 'Escalate' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Comment' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit assignees' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
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
      <FluentProvider theme={webLightTheme}>
        <AlertTable
          items={[summary]}
          onSortChange={onSortChange}
          renderAlertLink={(id) => <span>{id}</span>}
        />
      </FluentProvider>,
    );
    await userEvent.click(screen.getByText('Severity'));
    expect(onSortChange).toHaveBeenCalledWith('-severity');
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
      <FluentProvider theme={webLightTheme}>
        <ActionRequestCard
          request={decided}
          alert={summary}
          onApprove={() => {}}
          onReject={() => {}}
          renderAlertLink={(id) => <span>{id}</span>}
        />
      </FluentProvider>,
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
      <FluentProvider theme={webLightTheme}>
        <ActionRequestCard
          request={{ ...pending, status: 'rejected', rejectReason: 'Not now.' }}
          alert={summary}
          renderAlertLink={(id) => <span>{id}</span>}
        />
      </FluentProvider>,
    );
    expect(screen.getByText(/Not now\./)).toBeInTheDocument();
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
