import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@app/ui';
import { Link, useRouterState } from '@tanstack/react-router';
import { Fragment } from 'react';

export interface Crumb {
  label: string;
  to?: '/alerts' | '/queue';
}

const SECTIONS = { alerts: 'Alerts', queue: 'Queue' } as const;

/** Decodes a path segment; a malformed escape (a pasted, broken link) is shown as typed. */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Breadcrumbs for an app path: the section, then the record id on detail pages. */
export function breadcrumbsFor(pathname: string): Crumb[] {
  const [section, id] = pathname.split('/').filter(Boolean);
  if (section !== 'alerts' && section !== 'queue') return [];
  const label = SECTIONS[section];
  if (!id) return [{ label }];
  return [{ label, to: `/${section}` }, { label: decodeSegment(id) }];
}

export function Breadcrumbs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const crumbs = breadcrumbsFor(pathname);
  if (crumbs.length === 0) return null;
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((c, i) => (
          <Fragment key={c.label}>
            {i > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {c.to ? (
                <BreadcrumbLink render={<Link to={c.to} />}>{c.label}</BreadcrumbLink>
              ) : (
                <BreadcrumbPage>{c.label}</BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
