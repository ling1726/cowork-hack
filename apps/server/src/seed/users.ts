import type { User } from '@app/domain';

export const USERS: User[] = [
  { id: 'U-01', name: 'Priya Shah', role: 'analyst', desk: 'eu-equities', initials: 'PS' },
  { id: 'U-02', name: 'Tom Becker', role: 'analyst', desk: 'us-rates', initials: 'TB' },
  { id: 'U-03', name: 'Mei Lin', role: 'senior_analyst', initials: 'ML' },
  { id: 'U-04', name: 'Daniel Okafor', role: 'compliance_lead', initials: 'DO' },
  { id: 'U-05', name: 'Sarah Klein', role: 'cco', initials: 'SK' },
  { id: 'U-06', name: 'Raj Patel', role: 'analyst', desk: 'fx', initials: 'RP' },
];
