import { describe, expect, it } from 'vitest';
import { breadcrumbsFor } from './Breadcrumbs.tsx';

describe('breadcrumbsFor', () => {
  it('names list pages, and links detail pages back to their list', () => {
    expect(breadcrumbsFor('/alerts')).toEqual([{ label: 'Alerts' }]);
    expect(breadcrumbsFor('/alerts/ALT-1042')).toEqual([
      { label: 'Alerts', to: '/alerts' },
      { label: 'ALT-1042' },
    ]);
    expect(breadcrumbsFor('/queue')).toEqual([{ label: 'Queue' }]);
    expect(breadcrumbsFor('/queue/AR-0007')).toEqual([
      { label: 'Queue', to: '/queue' },
      { label: 'AR-0007' },
    ]);
    expect(breadcrumbsFor('/nope')).toEqual([]);
  });

  it('never throws on a malformed escape in the path', () => {
    expect(breadcrumbsFor('/alerts/50%ZZ')).toEqual([
      { label: 'Alerts', to: '/alerts' },
      { label: '50%ZZ' },
    ]);
  });
});
