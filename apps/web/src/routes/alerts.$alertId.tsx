import { AlertDetailSearchSchema } from '@app/domain';
import { createFileRoute } from '@tanstack/react-router';
import { validateWith } from '../search.ts';

export const Route = createFileRoute('/alerts/$alertId')({
  validateSearch: validateWith(AlertDetailSearchSchema),
  component: () => <h1>Alert</h1>,
});
