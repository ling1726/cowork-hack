import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AlertCardView } from './AlertCardView.tsx';
import { APP, fakeBridge, summary, users } from './fixtures.ts';

const alert = {
  ...summary,
  description: 'x',
  highlights: [],
  rule: { ...summary.rule, indicators: [] },
  dataTabs: [],
  links: [],
  attachments: [],
  escalations: [],
  allowedActions: ['acknowledge'],
  pendingActionRequestIds: [],
};
const result = (status = 'open') => ({
  content: [{ type: 'text' as const, text: 'ALT-1042' }],
  structuredContent: { alert: { ...alert, status }, url: `${APP}/alerts/ALT-1042`, tabUrls: {} },
  _meta: { 'alerts/view': { recentEvents: [], users } },
});

afterEach(() => vi.useRealTimers());

describe('AlertCardView', () => {
  it('opens the app through the bridge', async () => {
    const bridge = fakeBridge();
    render(<AlertCardView result={result()} bridge={bridge} />);
    expect(
      screen.getByRole('heading', { name: /Possible layering in SAP GY/ }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Open in app/ }));
    expect(bridge.openLink).toHaveBeenCalledWith(`${APP}/alerts/ALT-1042`);
  });

  it('refreshes every 5 s so a decision made elsewhere shows up', async () => {
    vi.useFakeTimers();
    const bridge = fakeBridge({ callTool: vi.fn(async () => result('in_progress')) });
    render(<AlertCardView result={result()} bridge={bridge} />);
    expect(screen.getByTestId('status-badge')).toHaveTextContent('Open');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(bridge.callTool).toHaveBeenCalledWith('get_alert', { alertId: 'ALT-1042' });
    expect(screen.getByTestId('status-badge')).toHaveTextContent('In Progress');
  });
});
