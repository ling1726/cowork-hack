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
  formatDateTime,
  nameOf,
} from '@app/ui';
import {
  MessageBar,
  MessageBarBody,
  Spinner,
  Tab,
  TabList,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import Markdown from 'react-markdown';
import { CommentComposer } from '../components/CommentComposer.tsx';
import { DataTabView } from '../components/DataTabView.tsx';
import { MaterialsTab } from '../components/MaterialsTab.tsx';
import { AcknowledgeDialog } from '../components/dialogs/AcknowledgeDialog.tsx';
import { AddLinkDialog } from '../components/dialogs/AddLinkDialog.tsx';
import { AssigneesDialog } from '../components/dialogs/AssigneesDialog.tsx';
import { CloseDialog } from '../components/dialogs/CloseDialog.tsx';
import { EscalateDialog } from '../components/dialogs/EscalateDialog.tsx';
import { ReopenDialog } from '../components/dialogs/ReopenDialog.tsx';
import { UploadAttachmentDialog } from '../components/dialogs/UploadAttachmentDialog.tsx';
import { useAlert, useTimeline, useUsers } from '../hooks.ts';
import { validateWith } from '../search.ts';

const useStyles = makeStyles({
  page: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalL },
  columns: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) 280px',
    gap: tokens.spacingHorizontalXL,
    alignItems: 'start',
    '@media (max-width: 900px)': { gridTemplateColumns: '1fr' },
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    paddingTop: tokens.spacingVerticalM,
  },
  description: { '& p': { marginTop: 0 }, '& ul': { paddingLeft: tokens.spacingHorizontalXL } },
  indicators: { margin: 0, paddingLeft: tokens.spacingHorizontalXL },
  notFound: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    alignItems: 'flex-start',
  },
});

export const Route = createFileRoute('/alerts/$alertId')({
  validateSearch: validateWith(AlertDetailSearchSchema),
  component: AlertDetailPage,
});

function Overview({ alert, users }: { alert: Alert; users: Parameters<typeof nameOf>[0] }) {
  const styles = useStyles();
  return (
    <div className={styles.panel}>
      <Text>{alert.summary}</Text>
      <div className={styles.description}>
        <Markdown>{alert.description}</Markdown>
      </div>
      <section data-testid="rule-indicators" aria-label="Rule">
        <Text weight="semibold" block>
          {alert.rule.name} · {alert.rule.regulation}
        </Text>
        <ul className={styles.indicators}>
          {alert.rule.indicators.map((i) => (
            <li key={i.id}>
              {i.description}: {i.threshold}
            </li>
          ))}
        </ul>
      </section>
      {alert.resolution && (
        <section data-testid="resolution" aria-label="Resolution">
          <Text weight="semibold" block>
            Resolution: {RESOLUTION_OUTCOME_LABELS[alert.resolution.outcome]}
          </Text>
          <Text block>{alert.resolution.note}</Text>
          <Text block size={200}>
            Closed by {nameOf(users, alert.resolution.closedBy)} ·{' '}
            {formatDateTime(alert.resolution.closedAt)}
          </Text>
        </section>
      )}
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
  const styles = useStyles();
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const { alertId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const alertQuery = useAlert(alertId);
  const timelineQuery = useTimeline(alertId);
  const { data: users = [] } = useUsers();

  if (alertQuery.isPending) return <Spinner label="Loading alert…" />;
  if (alertQuery.isError) {
    const missing = alertQuery.error instanceof ApiRequestError && alertQuery.error.status === 404;
    return missing ? (
      <div className={styles.notFound}>
        <Text as="h1" size={700} weight="semibold">
          Alert not found
        </Text>
        <Text>There is no alert {alertId}.</Text>
        <Link to="/alerts">Back to alerts</Link>
      </div>
    ) : (
      <MessageBar intent="error">
        <MessageBarBody>Could not load the alert: {alertQuery.error.message}</MessageBarBody>
      </MessageBar>
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
    <div className={styles.page}>
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
      <AlertHighlights highlights={alert.highlights} />
      <div className={styles.columns}>
        <div>
          <TabList
            selectedValue={search.tab}
            onTabSelect={(_e, d) => setTab(AlertTab.parse(d.value))}
            aria-label="Alert sections"
          >
            {AlertTab.options.map((t) => (
              <Tab key={t} value={t}>
                {ALERT_TAB_LABELS[t]}
              </Tab>
            ))}
          </TabList>
          {search.tab === 'overview' && <Overview alert={alert} users={users} />}
          {search.tab === 'timeline' && (
            <div className={styles.panel}>
              <AlertTimeline events={timelineQuery.data ?? []} users={users} />
              <CommentComposer alertId={alert.id} />
            </div>
          )}
          {search.tab === 'materials' && (
            <div className={styles.panel}>
              <MaterialsTab
                alert={alert}
                users={users}
                {...(can('add_link') ? { onAddLink: () => setDialog('add_link') } : {})}
                {...(can('add_attachment') ? { onUpload: () => setDialog('add_attachment') } : {})}
              />
            </div>
          )}
          {search.tab === 'data' && (
            <div className={styles.panel}>
              <DataTabView
                tabs={alert.dataTabs}
                selectedId={search.dataTab}
                onSelect={(dataTab) => navigate({ search: (prev) => ({ ...prev, dataTab }) })}
              />
            </div>
          )}
        </div>
        <AssigneesPanel
          assignees={alert.assignees}
          users={users}
          {...(can('edit_assignees') ? { onEdit: () => setDialog('edit_assignees') } : {})}
        />
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
