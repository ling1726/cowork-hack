import { Skeleton } from '@app/ui';
import type { McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import { useApp } from '@modelcontextprotocol/ext-apps/react';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { StrictMode, useEffect, useMemo, useState, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { bridgeFromApp, type ViewBridge } from './bridge.ts';

type View = ComponentType<{ result: CallToolResult; bridge: ViewBridge }>;

/** Follow the host's light/dark preference; keep the app's own brand colours and fonts. */
function applyTheme(theme: McpUiHostContext['theme']) {
  if (theme) document.documentElement.classList.toggle('dark', theme === 'dark');
}

function Host({ View, name }: { View: View; name: string }) {
  // Each new tool result remounts the view (key), so its local state starts from that result.
  const [latest, setLatest] = useState<{ seq: number; result?: CallToolResult }>({ seq: 0 });
  const { app, error } = useApp({
    appInfo: { name: `alerts-${name}`, version: '0.1.0' },
    capabilities: {},
    autoResize: true,
    onAppCreated: (created) => {
      created.ontoolresult = (result) => setLatest((s) => ({ seq: s.seq + 1, result }));
      created.onhostcontextchanged = (ctx) => applyTheme(ctx.theme);
    },
  });
  useEffect(() => {
    if (app) applyTheme(app.getHostContext()?.theme);
  }, [app]);
  const bridge = useMemo(() => (app ? bridgeFromApp(app) : undefined), [app]);

  if (error) {
    return (
      <p role="alert" className="p-4 text-sm text-destructive">
        Could not connect to the host: {error.message}
      </p>
    );
  }
  if (!latest.result || !bridge) return <Skeleton className="h-32 w-full" aria-busy="true" />;
  return <View key={latest.seq} result={latest.result} bridge={bridge} />;
}

export function mountView(View: View, name: string): void {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Host View={View} name={name} />
    </StrictMode>,
  );
}
