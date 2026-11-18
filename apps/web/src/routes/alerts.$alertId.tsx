import { ApiRequestError } from '@app/api-client';
import {
  ALERT_TAB_LABELS,
  AlertDetailSearchSchema,
  AlertTab,
  RESOLUTION_OUTCOME_LABELS,
  type Alert,
  type AllowedAction,
} from '@app/domain';
import {
  AlertHeader,
  AlertHighlights,
  AlertTimeline,
  AssigneesPanel,
  buttonVariants,
  Card,
  CardContent,
  formatDateTime,
  nameOf,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@app/ui';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import Markdown from 'react-markdown';
import { CommentComposer } from '../components/CommentComposer.tsx';
import { DataTabView } from '../components/DataTabView.tsx';
import { DetailsPanel } from '../components/detail/DetailsPanel.tsx';
import { PendingRequestsBanner } from '../components/PendingRequestsBanner.tsx';
import { MaterialsTab } from '../components/MaterialsTab.tsx';
import { OpenInCoworkButton } from '../components/OpenInCowork.tsx';
import { AcknowledgeDialog } from '../components/dialogs/AcknowledgeDialog.tsx';
import { AddLinkDialog } from '../components/dialogs/AddLinkDialog.tsx';
import { AssigneesDialog } from '../components/dialogs/AssigneesDialog.tsx';
import { CloseDialog } from '../components/dialogs/CloseDialog.tsx';
import { EscalateDialog } from '../components/dialogs/EscalateDialog.tsx';
import { ReopenDialog } from '../components/dialogs/ReopenDialog.tsx';
import { UploadAttachmentDialog } from '../components/dialogs/UploadAttachmentDialog.tsx';
import { useAlert, useTimeline, useUsers } from '../hooks.ts';
import { validateWith } from '../search.ts';

export const Route = createFileRoute('/alerts/$alertId')({
  validateSearch: validateWith(AlertDetailSearchSchema),
  component: AlertDetailPage,
});

function Overview({ alert, users }: { alert: Alert; users: Parameters<typeof nameOf>[0] }) {
  return (
    <div className="flex flex-col gap-5">
      {alert.resolution && (
        <section
          data-testid="resolution"
          aria-label="Resolution"
          className="flex gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm"
        >
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="flex flex-col gap-1">
            <p className="font-medium">
              Resolution: {RESOLUTION_OUTCOME_LABELS[alert.resolution.outcome]}
            </p>
            <p>{alert.resolution.note}</p>
            <p className="text-xs text-muted-foreground">
              Closed by {nameOf(users, alert.resolution.closedBy)} ·{' '}
              {formatDateTime(alert.resolution.closedAt)}
            </p>
          </div>
        </section>
      )}
      <p className="text-base leading-relaxed">{alert.summary}</p>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground [&_li]:ml-5 [&_strong]:text-foreground [&_ul]:list-disc">
        <Markdown>{alert.description}</Markdown>
      </div>
      <section
        data-testid="rule-indicators"
        aria-label="Rule"
        className="rounded-lg border bg-muted/30 p-4"
      >
        <p className="text-sm font-medium">
          {alert.rule.name} <span className="text-muted-foreground">· {alert.rule.regulation}</span>
        </p>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {alert.rule.indicators.map((i) => (
            <li key={i.id} className="flex justify-between gap-4">
              <span className="text-muted-foreground">{i.description}</span>
              <span className="font-mono text-xs tabular-nums">{i.threshold}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

type DialogKind =
  | 'acknowledge'
  | 'close'
  | 'reopen'
  | 'escalate'
  | 'edit_assignees'
  | 'add_link'
  | 'add_attachment';

function AlertDetailPage() {
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const { alertId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const alertQuery = useAlert(alertId, { poll: true });
  const timelineQuery = useTimeline(alertId, { poll: true });
  const { data: users = [] } = useUsers();

  if (alertQuery.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading alert…">
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }
  if (alertQuery.isError) {
    const missing = alertQuery.error instanceof ApiRequestError && alertQuery.error.status === 404;
    return missing ? (
      <div className="flex flex-col items-start gap-3 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">Alert not found</h1>
        <p className="text-sm text-muted-foreground">There is no alert {alertId}.</p>
        <Link to="/alerts" className={buttonVariants({ variant: 'outline' })}>
          Back to alerts
        </Link>
      </div>
    ) : (
      <div
        role="alert"
        className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        <CircleAlert className="size-4" />
        Could not load the alert: {alertQuery.error.message}
      </div>
    );
  }

  const alert = alertQuery.data;
  const can = (action: AllowedAction) => alert.allowedActions.includes(action);
  const closeDialog = () => setDialog(null);
  const setTab = (tab: AlertTab) =>
    navigate({
      search: (prev) => ({ ...prev, tab, dataTab: tab === 'data' ? prev.dataTab : undefined }),
    });

  return (
    <div className="flex flex-col gap-6">
      <AlertHeader
        alert={alert}
        actions={alert.allowedActions}
        onAction={(action) => {
          if (
            action === 'acknowledge' ||
            action === 'close' ||
            action === 'reopen' ||
            action === 'escalate'
          ) {
            setDialog(action);
          }
        }}
        pendingCount={alert.pendingActionRequestIds.length}
      />
      <div className="flex flex-wrap gap-2" data-testid="cowork-actions">
        <OpenInCoworkButton coworkCase={{ kind: 'investigate', alertId: alert.id }} />
        {alert.status === 'closed' && (
          <OpenInCoworkButton coworkCase={{ kind: 'second_opinion', alertId: alert.id }} />
        )}
        <OpenInCoworkButton
          coworkCase={{ kind: 'pattern', traderId: alert.trader.id, traderName: alert.trader.name }}
        />
      </div>
      <PendingRequestsBanner requestIds={alert.pendingActionRequestIds} />
      <AlertHighlights highlights={alert.highlights} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="min-w-0">
          <CardContent>
            <Tabs value={search.tab} onValueChange={(value) => setTab(AlertTab.parse(value))}>
              <TabsList variant="line" aria-label="Alert sections" className="mb-4">
                {AlertTab.options.map((t) => (
                  <TabsTrigger key={t} value={t}>
                    {ALERT_TAB_LABELS[t]}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value="overview">
                <Overview alert={alert} users={users} />
              </TabsContent>
              <TabsContent value="timeline" className="flex flex-col gap-6">
                <AlertTimeline events={timelineQuery.data ?? []} users={users} />
                <CommentComposer alertId={alert.id} />
              </TabsContent>
              <TabsContent value="materials">
                <MaterialsTab
                  alert={alert}
                  users={users}
                  {...(can('add_link') ? { onAddLink: () => setDialog('add_link') } : {})}
                  {...(can('add_attachment')
                    ? { onUpload: () => setDialog('add_attachment') }
                    : {})}
                />
              </TabsContent>
              <TabsContent value="data">
                <DataTabView
                  tabs={alert.dataTabs}
                  selectedId={search.dataTab}
                  onSelect={(dataTab) => navigate({ search: (prev) => ({ ...prev, dataTab }) })}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <DetailsPanel alert={alert} />
          <AssigneesPanel
            assignees={alert.assignees}
            users={users}
            {...(can('edit_assignees') ? { onEdit: () => setDialog('edit_assignees') } : {})}
          />
        </div>
      </div>
      {dialog === 'acknowledge' && <AcknowledgeDialog alertId={alert.id} onClose={closeDialog} />}
      {dialog === 'close' && <CloseDialog alertId={alert.id} onClose={closeDialog} />}
      {dialog === 'reopen' && <ReopenDialog alertId={alert.id} onClose={closeDialog} />}
      {dialog === 'escalate' && (
        <EscalateDialog alert={alert} users={users} onClose={closeDialog} />
      )}
      {dialog === 'edit_assignees' && (
        <AssigneesDialog alert={alert} users={users} onClose={closeDialog} />
      )}
      {dialog === 'add_link' && <AddLinkDialog alertId={alert.id} onClose={closeDialog} />}
      {dialog === 'add_attachment' && (
        <UploadAttachmentDialog alertId={alert.id} onClose={closeDialog} />
      )}
    </div>
  );
}
