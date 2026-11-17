import { VIEW_META_KEY } from '@app/domain';
import type { App } from '@modelcontextprotocol/ext-apps';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/** What a view needs from the host. Views take this, so tests pass a fake. */
export interface ViewBridge {
  callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult>;
  openLink(url: string): Promise<void>;
  /** Sends a user message to Claude; false when the host refuses. */
  sendMessage(text: string): Promise<boolean>;
  /** Tells Claude something for its next turn, without sending a message. */
  updateModelContext(text: string): Promise<void>;
}

export function bridgeFromApp(app: App): ViewBridge {
  return {
    callTool: (name, args) => app.callServerTool({ name, arguments: args }),
    openLink: async (url) => {
      await app.openLink({ url });
    },
    sendMessage: async (text) => {
      try {
        const r = await app.sendMessage({ role: 'user', content: [{ type: 'text', text }] });
        return !r.isError;
      } catch {
        return false;
      }
    },
    updateModelContext: async (text) => {
      try {
        await app.updateModelContext({ content: [{ type: 'text', text }] });
      } catch {
        // A host without model context support: Claude asks get_action_request instead.
      }
    },
  };
}

/** The view-only payload the MCP server put in the result's `_meta`. */
export const viewOf = <T>(result: CallToolResult): T | undefined =>
  result._meta?.[VIEW_META_KEY] as T | undefined;

export const textOf = (result: CallToolResult): string =>
  result.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map((c) => c.text)
    .join('\n');
