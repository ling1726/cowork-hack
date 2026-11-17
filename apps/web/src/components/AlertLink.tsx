import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

/** App-internal link to an alert's overview. The default tab is omitted from the URL. */
export function AlertLink({ id, children }: { id: string; children: ReactNode }) {
  return (
    <Link to="/alerts/$alertId" params={{ alertId: id }} search={{ tab: 'overview' }}>
      {children}
    </Link>
  );
}
