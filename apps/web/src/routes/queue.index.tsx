import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/queue/')({
  component: () => <h1>Queue</h1>,
});
