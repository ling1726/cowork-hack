import { CATEGORY_LABELS, DESK_LABELS, type Alert } from '@app/domain';
import { Card, CardContent, CardHeader, CardTitle, formatDateTime } from '@app/ui';
import type { ReactNode } from 'react';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

/** The alert's key facts, beside the tabs on wide screens and under them on narrow ones. */
export function DetailsPanel({ alert }: { alert: Alert }) {
  return (
    <Card size="sm" data-testid="details-panel" role="region" aria-label="Details">
      <CardHeader>
        <CardTitle>Details</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y">
          <Row label="Trader">
            {alert.trader.name} <span className="text-muted-foreground">({alert.trader.id})</span>
          </Row>
          <Row label="Instrument">
            <span className="font-medium">{alert.instrument.symbol}</span>{' '}
            <span className="text-muted-foreground">{alert.instrument.name}</span>
          </Row>
          <Row label="Rule">
            {alert.rule.name}
            <div className="text-xs text-muted-foreground">{alert.rule.regulation}</div>
          </Row>
          <Row label="Desk">{DESK_LABELS[alert.desk]}</Row>
          <Row label="Category">{CATEGORY_LABELS[alert.category]}</Row>
          <Row label="Created">{formatDateTime(alert.createdAt)}</Row>
          <Row label="Updated">{formatDateTime(alert.updatedAt)}</Row>
        </dl>
      </CardContent>
    </Card>
  );
}
