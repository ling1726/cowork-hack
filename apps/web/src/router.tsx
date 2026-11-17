import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen.ts';
import { parseSearch, stringifySearch } from './search.ts';

export const router = createRouter({
  routeTree,
  parseSearch,
  stringifySearch,
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
