import { FluentProvider, webDarkTheme, webLightTheme } from '@fluentui/react-components';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { router } from './router.tsx';
import { useUiStore } from './store/ui-store.ts';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

function Root() {
  const theme = useUiStore((s) => s.theme);
  return (
    <FluentProvider
      theme={theme === 'dark' ? webDarkTheme : webLightTheme}
      data-theme={theme}
      style={{ minHeight: '100vh' }}
    >
      <RouterProvider router={router} />
    </FluentProvider>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');
createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Root />
    </QueryClientProvider>
  </StrictMode>,
);
