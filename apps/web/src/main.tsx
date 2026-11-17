import './index.css';
import { FluentProvider, webDarkTheme, webLightTheme } from '@fluentui/react-components';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { queryClient } from './queryClient.ts';
import { router } from './router.tsx';
import { useUiStore } from './store/ui-store.ts';
import { applyTheme } from './theme.ts';

function Root() {
  const theme = useUiStore((s) => s.theme);
  useEffect(() => applyTheme(theme, document.documentElement), [theme]);
  return (
    <FluentProvider
      theme={theme === 'dark' ? webDarkTheme : webLightTheme}
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
