import type { Alert, User } from '@app/domain';
import { Button, formatDateTime, nameOf } from '@app/ui';
import { FileText, Link2, Plus, Upload } from 'lucide-react';
import type { ReactNode } from 'react';

const formatSize = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export interface MaterialsTabProps {
  alert: Alert;
  users: User[];
  onAddLink?: () => void;
  onUpload?: () => void;
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const Empty = ({ children }: { children: ReactNode }) => (
  <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
    {children}
  </p>
);

export function MaterialsTab({ alert, users, onAddLink, onUpload }: MaterialsTabProps) {
  return (
    <div className="flex flex-col gap-6">
      <Section
        title="Links"
        action={
          onAddLink && (
            <Button size="sm" variant="outline" onClick={onAddLink}>
              <Plus />
              Add link
            </Button>
          )
        }
      >
        {alert.links.length === 0 ? (
          <Empty>No links yet.</Empty>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {alert.links.map((l) => (
              <li key={l.id} data-testid="link-item" className="flex items-start gap-3 px-3 py-2.5">
                <Link2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium break-words hover:underline"
                  >
                    {l.title}
                  </a>
                  <p className="text-xs text-muted-foreground">
                    Added by {nameOf(users, l.addedBy)} · {formatDateTime(l.addedAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section
        title="Attachments"
        action={
          onUpload && (
            <Button size="sm" variant="outline" onClick={onUpload}>
              <Upload />
              Upload attachment
            </Button>
          )
        }
      >
        {alert.attachments.length === 0 ? (
          <Empty>No attachments yet.</Empty>
        ) : (
          <ul className="flex flex-col divide-y rounded-lg border">
            {alert.attachments.map((a) => (
              <li
                key={a.id}
                data-testid="attachment-item"
                className="flex items-start gap-3 px-3 py-2.5"
              >
                <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <a
                    href={`/api/attachments/${a.id}/content`}
                    download={a.filename}
                    className="text-sm font-medium break-words hover:underline"
                  >
                    {a.filename}
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(a.sizeBytes)} · uploaded by {nameOf(users, a.uploadedBy)} ·{' '}
                    {formatDateTime(a.uploadedAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
