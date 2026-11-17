import { alertListUrl, queueUrl, type AlertListSearch } from '@app/domain';
import { StatCard, type StatCardProps } from '@app/ui';
import { useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useAlertCount } from '../../hooks.ts';
import { usePendingCount } from '../../hooks/useActionRequests.ts';
import { useUiStore } from '../../store/ui-store.ts';

const UNRESOLVED: AlertListSearch['status'] = ['open', 'in_progress'];

export interface StatCardDef {
  label: string;
  /** The list filter the card counts; absent for the queue card. */
  search?: AlertListSearch;
  href: string;
  tone?: StatCardProps['tone'];
}

/** The four overview cards. They ignore the list's current filters: a fixed overview. */
export function statCards(currentUserId: string): StatCardDef[] {
  const open: AlertListSearch = { status: UNRESOLVED };
  const severe: AlertListSearch = { severity: ['high', 'critical'], status: UNRESOLVED };
  const mine: AlertListSearch = { assigneeId: currentUserId, status: UNRESOLVED };
  return [
    { label: 'Open', search: open, href: alertListUrl('', open) },
    { label: 'High & critical', search: severe, href: alertListUrl('', severe), tone: 'danger' },
    { label: 'Assigned to me', search: mine, href: alertListUrl('', mine) },
    { label: 'Awaiting you', href: queueUrl(''), tone: 'warning' },
  ];
}

function AlertCountCard({
  def,
  renderLink,
}: {
  def: StatCardDef;
  renderLink: StatCardProps['renderLink'];
}) {
  const value = useAlertCount(def.search ?? {});
  return (
    <StatCard
      label={def.label}
      value={value}
      href={def.href}
      renderLink={renderLink}
      {...(def.tone ? { tone: def.tone } : {})}
    />
  );
}

export function StatCards() {
  const navigate = useNavigate();
  const currentUserId = useUiStore((s) => s.currentUserId);
  const { data: pending } = usePendingCount();
  const renderLink = (href: string, children: ReactNode) => (
    <a
      href={href}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        void navigate({ href });
      }}
      className="rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {children}
    </a>
  );
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {statCards(currentUserId).map((def) =>
        def.search ? (
          <AlertCountCard key={def.label} def={def} renderLink={renderLink} />
        ) : (
          <StatCard
            key={def.label}
            label={def.label}
            value={pending}
            href={def.href}
            renderLink={renderLink}
            tone={pending ? 'warning' : 'default'}
          />
        ),
      )}
    </div>
  );
}
