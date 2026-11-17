/**
 * A minimal MCP Apps host for tests and rehearsal (stands in for Cowork). Usage:
 *   http://localhost:5174/?tool=get_alert&args={"alertId":"ALT-1042"}&theme=dark
 * It connects to the MCP server (proxied at /mcp), declares MCP Apps support, calls the tool,
 * renders the tool's ui:// view in a sandboxed iframe and records what the view asks the host
 * to do in window.__hostLog.
 */
import {
  AppBridge,
  PostMessageTransport,
  RESOURCE_MIME_TYPE,
  getToolUiResourceUri,
} from '@modelcontextprotocol/ext-apps/app-bridge';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { ContentBlock } from '@modelcontextprotocol/sdk/types.js';

type HostLogEntry = { type: 'openLink' | 'message' | 'modelContext'; value: string };
declare global {
  interface Window {
    __hostLog: HostLogEntry[];
  }
}
window.__hostLog = [];
const log = (type: HostLogEntry['type'], value: string) => window.__hostLog.push({ type, value });
const textOf = (content: ContentBlock[] | undefined) =>
  (content ?? [])
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('\n');

const status = document.getElementById('status')!;
const params = new URLSearchParams(location.search);
const tool = params.get('tool');
const args = JSON.parse(params.get('args') ?? '{}') as Record<string, unknown>;
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
if (theme === 'dark') document.body.style.background = '#1b1b22';

async function main() {
  if (!tool) {
    status.textContent = 'Pass ?tool=<name>&args=<json>';
    return;
  }
  const client = new Client(
    { name: 'test-host', version: '0.0.0' },
    {
      capabilities: {
        extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: [RESOURCE_MIME_TYPE] } },
      },
    },
  );
  await client.connect(new StreamableHTTPClientTransport(new URL('/mcp', location.href)));

  const { tools } = await client.listTools();
  const uri = getToolUiResourceUri(tools.find((t) => t.name === tool) ?? {});
  const result = await client.callTool({ name: tool, arguments: args });
  if (!uri) {
    status.textContent = `${tool} has no view. Text result:\n${textOf(result.content as ContentBlock[])}`;
    return;
  }
  const resource = await client.readResource({ uri });
  const html = (resource.contents[0] as { text?: string }).text ?? '';

  const iframe = document.createElement('iframe');
  iframe.title = uri;
  iframe.sandbox.add('allow-scripts');
  iframe.srcdoc = html;
  document.body.append(iframe);

  const bridge = new AppBridge(
    client,
    { name: 'test-host', version: '0.0.0' },
    {
      openLinks: {},
      serverTools: {},
      logging: {},
      message: { text: {} },
      updateModelContext: { text: {} },
    },
    // The initial context goes in here: setHostContext() before connect() would try to notify.
    { hostContext: { theme, displayMode: 'inline' } },
  );
  bridge.onopenlink = async ({ url }) => {
    log('openLink', url);
    return {};
  };
  bridge.onmessage = async ({ content }) => {
    log('message', textOf(content));
    return {};
  };
  bridge.onupdatemodelcontext = async ({ content }) => {
    log('modelContext', textOf(content));
    return {};
  };
  bridge.onsizechange = ({ height }) => {
    if (height) iframe.style.height = `${height}px`;
  };
  bridge.oninitialized = () => {
    void bridge.sendToolResult(result as Parameters<AppBridge['sendToolResult']>[0]);
  };
  await bridge.connect(new PostMessageTransport(iframe.contentWindow!, iframe.contentWindow!));
  status.textContent = `${tool} → ${uri}`;
}

main().catch((e: unknown) => {
  status.textContent = `Error: ${e instanceof Error ? e.message : String(e)}`;
  console.error(e);
});
