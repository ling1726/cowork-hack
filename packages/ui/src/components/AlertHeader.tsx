import {
  ALLOWED_ACTION_LABELS,
  DESK_LABELS,
  type AllowedAction,
  type AlertSummary,
} from '@app/domain';
import { Bot, Ellipsis } from 'lucide-react';
import { Badge } from '../primitives/badge.tsx';
import { Button } from '../primitives/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../primitives/dropdown-menu.tsx';
import { AlertStatusBadge } from './AlertStatusBadge.tsx';
import { SeverityBadge } from './SeverityBadge.tsx';

/** Actions shown in the header, in display order. Comment and assignee edits live elsewhere. */
const HEADER_ACTIONS: AllowedAction[] = ['acknowledge', 'close', 'reopen', 'escalate'];

const headerActions = (actions: readonly AllowedAction[]) =>
  HEADER_ACTIONS.filter((a) => actions.includes(a));

/** The header's main button: acknowledge when allowed, otherwise the first header action. */
export function primaryAction(actions: readonly AllowedAction[]): AllowedAction | undefined {
  const allowed = headerActions(actions);
  return allowed.includes('acknowledge') ? 'acknowledge' : allowed[0];
}

export interface AlertHeaderProps {
  alert: AlertSummary;
  actions: AllowedAction[];
  onAction: (action: AllowedAction) => void;
  pendingCount?: number;
}

export function AlertHeader({ alert, actions, onAction, pendingCount }: AlertHeaderProps) {
  const primary = primaryAction(actions);
  const rest = headerActions(actions).filter((a) => a !== primary);
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-muted-foreground">{alert.id}</span>
          <AlertStatusBadge status={alert.status} />
          <SeverityBadge severity={alert.severity} />
          {pendingCount ? (
            <Badge
              data-testid="pending-count"
              variant="outline"
              className="border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300"
              title="Claude requests waiting for approval"
            >
              <Bot aria-hidden />
              {pendingCount}
            </Badge>
          ) : null}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{alert.title}</h1>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>{alert.rule.name}</span>
          <span aria-hidden>·</span>
          <span>{DESK_LABELS[alert.desk]}</span>
          <span aria-hidden>·</span>
          <span>
            {alert.trader.name} ({alert.trader.id})
          </span>
          <span aria-hidden>·</span>
          <span>{alert.instrument.symbol}</span>
        </div>
      </div>
      {primary && (
        <div className="flex shrink-0 items-center gap-2">
          <Button data-testid={`action-${primary}`} onClick={() => onAction(primary)}>
            {ALLOWED_ACTION_LABELS[primary]}
          </Button>
          {rest.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="icon" aria-label="More actions" />}
              >
                <Ellipsis />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {rest.map((action) => (
                  <DropdownMenuItem
                    key={action}
                    data-testid={`action-${action}`}
                    onClick={() => onAction(action)}
                  >
                    {ALLOWED_ACTION_LABELS[action]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
    </header>
  );
}
