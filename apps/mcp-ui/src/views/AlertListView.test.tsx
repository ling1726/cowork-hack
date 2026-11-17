import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AlertListView } from './AlertListView.tsx';
import { APP, fakeBridge, second, summary, users } from './fixtures.ts';

const result = {
  content: [{ type: 'text' as const, text: 'Found 2 alerts.' }],
  structuredContent: {
    items: [
      { ...summary, url: `${APP}/alerts/ALT-1042` },
      { ...second, url: `${APP}/alerts/ALT-1050` },
    ],
    total: 7,
    listUrl: `${APP}/alerts?severity=high`,
  },
  _meta: { 'alerts/view': { users } },
};

describe('AlertListView', () => {
  it('shows the items and Investigate sends the prompt', async () => {
    const bridge = fakeBridge();
    render(<AlertListView result={result} bridge={bridge} />);
    expect(screen.getByText('Possible layering in SAP GY')).toBeInTheDocument();
    expect(screen.getByText('Showing 2 of 7')).toBeInTheDocument();
    const row = screen.getByText('Possible layering in SAP GY').closest('tr')!;
    await userEvent.click(within(row).getByRole('button', { name: 'Investigate' }));
    expect(bridge.sendMessage).toHaveBeenCalledWith('Investigate ALT-1042');
    expect(bridge.openLink).not.toHaveBeenCalled();
  });

  it('Investigate falls back to opening the alert when the host refuses', async () => {
    const bridge = fakeBridge({ sendMessage: async () => false });
    render(<AlertListView result={result} bridge={bridge} />);
    const row = screen.getByText('Possible layering in SAP GY').closest('tr')!;
    await userEvent.click(within(row).getByRole('button', { name: 'Investigate' }));
    expect(bridge.openLink).toHaveBeenCalledWith(`${APP}/alerts/ALT-1042`);
  });

  it('opens the list and alerts in the app through the bridge', async () => {
    const bridge = fakeBridge();
    render(<AlertListView result={result} bridge={bridge} />);
    await userEvent.click(screen.getByRole('button', { name: /Open in app/ }));
    expect(bridge.openLink).toHaveBeenCalledWith(`${APP}/alerts?severity=high`);
    await userEvent.click(screen.getByRole('link', { name: 'ALT-1050' }));
    expect(bridge.openLink).toHaveBeenLastCalledWith(`${APP}/alerts/ALT-1050`);
  });

  it('sorts the returned items in place', async () => {
    render(<AlertListView result={result} bridge={fakeBridge()} />);
    await userEvent.click(screen.getByRole('button', { name: /Severity/ }));
    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]!).getByText('Second alert')).toBeInTheDocument();
  });
});
