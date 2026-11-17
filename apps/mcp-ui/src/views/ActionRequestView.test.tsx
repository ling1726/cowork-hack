import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActionRequestView } from './ActionRequestView.tsx';
import { APP, decidedDetail, fakeBridge, pendingDetail, requestResult } from './fixtures.ts';

const setVisibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
};

afterEach(() => {
  vi.useRealTimers();
  setVisibility('visible');
});

describe('ActionRequestView', () => {
  it('a pending request with canDecide shows Approve and Reject', () => {
    render(<ActionRequestView result={requestResult(pendingDetail)} bridge={fakeBridge()} />);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('without canDecide it offers Review in app instead', async () => {
    const bridge = fakeBridge();
    render(<ActionRequestView result={requestResult(pendingDetail, false)} bridge={bridge} />);
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Review in app/ }));
    expect(bridge.openLink).toHaveBeenCalledWith(`${APP}/queue/AR-0001`);
  });

  it('approve calls the tool, shows the decision and tells Claude', async () => {
    const bridge = fakeBridge({
      callTool: vi.fn(async () => requestResult(decidedDetail('approved', 'cowork'))),
    });
    render(<ActionRequestView result={requestResult(pendingDetail)} bridge={bridge} />);
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(bridge.callTool).toHaveBeenCalledWith('approve_action_request', {
      requestId: 'AR-0001',
    });
    expect(await screen.findByTestId('decision')).toHaveTextContent(
      'Approved by Priya Shah in Cowork',
    );
    expect(bridge.updateModelContext).toHaveBeenCalledWith(
      'The user approved request AR-0001 (Acknowledge ALT-1042) in Cowork.',
    );
  });

  it('reject sends the reason and tells Claude', async () => {
    const bridge = fakeBridge({
      callTool: vi.fn(async () =>
        requestResult(decidedDetail('rejected', 'cowork', { rejectReason: 'Not yet' })),
      ),
    });
    render(<ActionRequestView result={requestResult(pendingDetail)} bridge={bridge} />);
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    await userEvent.type(screen.getByRole('textbox', { name: /reason/i }), 'Not yet');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm reject' }));
    expect(bridge.callTool).toHaveBeenCalledWith('reject_action_request', {
      requestId: 'AR-0001',
      reason: 'Not yet',
    });
    expect(await screen.findByTestId('decision')).toHaveTextContent(
      'Rejected by Priya Shah in Cowork',
    );
    expect(bridge.updateModelContext).toHaveBeenCalledWith(
      'The user rejected request AR-0001 (Acknowledge ALT-1042) in Cowork. Reason: Not yet',
    );
  });

  it('approve after an app decision shows the conflict and the real status', async () => {
    const callTool = vi.fn(async (name: string) =>
      name === 'approve_action_request'
        ? {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text: 'Error (already_decided): Request AR-0001 is already rejected',
              },
            ],
          }
        : requestResult(decidedDetail('rejected', 'app')),
    );
    const bridge = fakeBridge({ callTool });
    render(<ActionRequestView result={requestResult(pendingDetail)} bridge={bridge} />);
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Already decided in the app');
    expect(await screen.findByTestId('decision')).toHaveTextContent(
      'Rejected by Priya Shah in the app',
    );
    expect(callTool).toHaveBeenCalledWith('get_action_request', { requestId: 'AR-0001' });
    expect(bridge.updateModelContext).not.toHaveBeenCalled();
  });

  it('approve is sent once on a double click', async () => {
    let resolve!: (v: CallToolResult) => void;
    const callTool = vi.fn(() => new Promise<CallToolResult>((r) => (resolve = r)));
    render(
      <ActionRequestView result={requestResult(pendingDetail)} bridge={fakeBridge({ callTool })} />,
    );
    const approve = screen.getByRole('button', { name: 'Approve' });
    await userEvent.dblClick(approve);
    expect(callTool).toHaveBeenCalledTimes(1);
    await act(async () => resolve(requestResult(decidedDetail('approved', 'cowork'))));
  });

  it('polling stops after a decision and pauses while hidden', async () => {
    vi.useFakeTimers();
    const callTool = vi.fn(async () => requestResult(pendingDetail));
    render(
      <ActionRequestView result={requestResult(pendingDetail)} bridge={fakeBridge({ callTool })} />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(callTool).toHaveBeenCalledTimes(1);
    expect(callTool).toHaveBeenLastCalledWith('get_action_request', { requestId: 'AR-0001' });

    setVisibility('hidden');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000);
    });
    expect(callTool).toHaveBeenCalledTimes(1);

    callTool.mockImplementation(async () => requestResult(decidedDetail('approved', 'app')));
    await act(async () => {
      setVisibility('visible');
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(callTool).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('decision')).toHaveTextContent('Approved by Priya Shah in the app');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000);
    });
    expect(callTool).toHaveBeenCalledTimes(2);
  });

  it('the applied view shows Applied immediately', async () => {
    const bridge = fakeBridge();
    render(
      <ActionRequestView
        result={{
          content: [{ type: 'text', text: 'Comment added' }],
          _meta: {
            'alerts/view': {
              kind: 'applied',
              url: `${APP}/alerts/ALT-1042?tab=timeline`,
              summary: 'Comment added to ALT-1042',
            },
          },
        }}
        bridge={bridge}
      />,
    );
    expect(
      screen.getByText('Applied immediately (approval is off for this user)'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Open in app/ }));
    expect(bridge.openLink).toHaveBeenCalledWith(`${APP}/alerts/ALT-1042?tab=timeline`);
  });
});
