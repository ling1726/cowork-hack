import { ACTION_REQUEST_STATUS_LABELS, ActionRequestStatus, QueueSearchSchema } from '@app/domain';
import {
  Skeleton,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@app/ui';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Inbox } from 'lucide-react';
import { RequestRow } from '../components/RequestRow.tsx';
import { useRequestList } from '../hooks/useActionRequests.ts';
import { validateWith } from '../search.ts';

export const Route = createFileRoute('/queue/')({
  validateSearch: validateWith(QueueSearchSchema),
  component: QueuePage,
});

const COLUMNS = ['Request', 'Alert', 'Action', "Claude's rationale", 'Requested', 'Status', ''];

function QueuePage() {
  const { status } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { list, details } = useRequestList(status);
  const empty = details.length === 0 && (list.data?.length ?? 0) === 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Queue</h1>
        <p className="text-sm text-muted-foreground">
          What Claude wants to do on your behalf. Nothing changes until you approve it.
        </p>
      </div>
      <Tabs
        value={status}
        onValueChange={(value) =>
          navigate({ search: { status: ActionRequestStatus.parse(value) } })
        }
      >
        <TabsList aria-label="Request status">
          {ActionRequestStatus.options.map((s) => (
            <TabsTrigger key={s} value={s}>
              {ACTION_REQUEST_STATUS_LABELS[s]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {list.isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading requests…">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : empty ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-16 text-center">
          <Inbox className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">No requests here.</p>
          <p className="text-sm text-muted-foreground">
            Requests Claude makes for you show up here for approval.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table aria-label="Requests">
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                {COLUMNS.map((c) => (
                  <TableHead key={c} className="text-xs font-medium text-muted-foreground">
                    {c}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {details.map((d) => (
                <RequestRow key={d.id} detail={d} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
