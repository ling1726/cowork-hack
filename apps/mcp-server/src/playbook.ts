import { readFileSync } from 'node:fs';

/**
 * The investigate-alert skill's body, sent as MCP server `instructions`, so a client that connects
 * by URL alone (Cowork's connector) gets the playbook without the plugin. One copy: the skill file.
 */
export function loadPlaybook(path: string): string | undefined {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    console.warn(`Playbook not found at ${path}; the MCP server starts without instructions.`);
    return undefined;
  }
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim();
}
