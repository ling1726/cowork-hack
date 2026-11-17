import type { User } from '@app/domain';

const dateTime = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
const dateTimeSeconds = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'medium',
});
const number = new Intl.NumberFormat('en-GB');
const euro = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' });

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatDateTimeSeconds = (iso: string) => dateTimeSeconds.format(new Date(iso));
export const formatNumber = (n: number) => number.format(n);
export const formatEuro = (n: number) => euro.format(n);

/** Resolves a user id to a display name. `system` and unknown ids degrade gracefully. */
export function nameOf(users: readonly User[], id: string): string {
  if (id === 'system') return 'System';
  return users.find((u) => u.id === id)?.name ?? id;
}

/** Up to two initials for an avatar: "Priya Shah" → "PS", "System" → "S". */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
