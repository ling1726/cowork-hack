import {
  ACTION_REQUEST_KIND_LABELS,
  alertUrl,
  type ActionRequestDetail,
  type ActionRequestView as RequestPayload,
} from '@app/domain';
import { ActionRequestCard, Card, CardContent, CardFooter } from '@app/ui';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { CircleAlert } from 'lucide-react';
import { useRef, useState } from 'react';
import { textOf, viewOf, type ViewBridge } from '../bridge.ts';
import { useVisiblePolling } from '../useVisiblePolling.ts';
import { HostLink, OpenButton } from './OpenButton.tsx';

export const REQUEST_POLL_MS = 3000;

/** What Claude learns on its next turn after a decision on the card. */
export function decisionLine(
  detail: ActionRequestDetail,
  verb: 'approved' | 'rejected',
  reason?: string,
) {
  const what = `${ACTION_REQUEST_KIND_LABELS[detail.kind]} ${detail.alertId}`;
  const line = `The user ${verb} request ${detail.id} (${what}) in Cowork.`;
  return reason ? `${line} Reason: ${reason}` : line;
}

/** Claude's write in Cowork: the app's request card with Approve / Reject, kept in sync. */
export function ActionRequestView({
  result,
  bridge,
}: {
  result: CallToolResult;
  bridge: ViewBridge;
}) {
  const [current, setCurrent] = useState(result);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const inFlight = useRef(false);

  const view = viewOf<RequestPayload>(current);
  const detail = view?.kind === 'request' ? view.detail : undefined;
  const pending = detail?.status === 'pending';

  const refresh = async () => {
    if (!detail) return;
    const next = await bridge.callTool('get_action_request', { requestId: detail.id });
    if (!next.isError && viewOf<RequestPayload>(next)) setCurrent(next);
  };
  useVisiblePolling(refresh, REQUEST_POLL_MS, pending && !busy);

  if (!view) return null;
  if (view.kind === 'applied') {
    return (
      <Card data-testid="applied-view">
        <CardContent className="flex flex-col gap-1">
          <p className="font-medium">{view.summary}</p>
          <p className="text-sm text-muted-foreground">
            Applied immediately (approval is off for this user)
          </p>
        </CardContent>
        <CardFooter className="justify-end">
          <OpenButton label="Open in app" onOpen={() => void bridge.openLink(view.url)} />
        </CardFooter>
      </Card>
    );
  }

  const req = view.detail;
  const decide = async (
    tool: 'approve_action_request' | 'reject_action_request',
    verb: 'approved' | 'rejected',
    reason?: string,
  ) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const next = await bridge.callTool(tool, {
        requestId: req.id,
        ...(reason ? { reason } : {}),
      });
      if (next.isError) {
        const message = textOf(next);
        setError(message.includes('already_decided') ? 'Already decided in the app' : message);
        await refresh();
      } else {
        setCurrent(next);
        await bridge.updateModelContext(decisionLine(req, verb, reason));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const appOrigin = new URL(view.requestUrl).origin;
  const decidedByName = req.decidedBy
    ? (view.users.find((u) => u.id === req.decidedBy)?.name ?? req.decidedBy)
    : undefined;

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
          <CircleAlert className="size-4" aria-hidden />
          {error}
        </p>
      )}
      <ActionRequestCard
        request={req}
        alert={req.alert}
        busy={busy}
        {...(decidedByName ? { decidedByName } : {})}
        {...(pending && view.canDecide
          ? {
              onApprove: () => void decide('approve_action_request', 'approved'),
              onReject: (reason?: string) =>
                void decide('reject_action_request', 'rejected', reason),
            }
          : {})}
        link={{
          href: view.requestUrl,
          label: pending && !view.canDecide ? 'Review in app' : 'Open in app',
        }}
        renderLink={(href, label) => (
          <OpenButton label={label} onOpen={() => void bridge.openLink(href)} />
        )}
        renderAlertLink={(id, label) => {
          const href = alertUrl(appOrigin, id);
          return <HostLink href={href} label={label} onOpen={() => void bridge.openLink(href)} />;
        }}
      />
    </div>
  );
}
