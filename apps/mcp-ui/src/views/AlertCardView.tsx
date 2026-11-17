import type { Alert, AlertCardView as CardPayload } from '@app/domain';
import { AlertSummaryCard } from '@app/ui';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { useState } from 'react';
import { viewOf, type ViewBridge } from '../bridge.ts';
import { useVisiblePolling } from '../useVisiblePolling.ts';
import { OpenButton } from './OpenButton.tsx';

export const ALERT_REFRESH_MS = 5000;

/** `get_alert` in Cowork: the app's summary card, kept current while visible. */
export function AlertCardView({ result, bridge }: { result: CallToolResult; bridge: ViewBridge }) {
  const [current, setCurrent] = useState(result);
  const { alert, url } = current.structuredContent as { alert: Alert; url: string };
  const payload = viewOf<CardPayload>(current);

  useVisiblePolling(
    async () => {
      const next = await bridge.callTool('get_alert', { alertId: alert.id });
      if (!next.isError && next.structuredContent) setCurrent(next);
    },
    ALERT_REFRESH_MS,
    true,
  );

  return (
    <AlertSummaryCard
      alert={alert}
      recentEvents={payload?.recentEvents ?? []}
      users={payload?.users ?? []}
      openInAppHref={url}
      renderLink={(href, label) => (
        <OpenButton label={label} onOpen={() => void bridge.openLink(href)} />
      )}
    />
  );
}
