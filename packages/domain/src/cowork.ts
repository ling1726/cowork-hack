import { alertListUrl } from './links.ts';
import type { AlertListSearch } from './search-params.ts';

/** One "Open in Cowork" entry point in the app, with the ids its prompt needs. */
export type CoworkCase =
  | { kind: 'investigate'; alertId: string }
  | { kind: 'second_opinion'; alertId: string }
  | { kind: 'pattern'; traderId: string; traderName: string }
  | { kind: 'triage'; base: string; search: AlertListSearch }
  | { kind: 'explain_request'; requestId: string; alertId: string }
  | { kind: 'handover' };

export type CoworkCaseKind = CoworkCase['kind'];

/** Claude Desktop truncates `q` at about this many characters. */
export const COWORK_PROMPT_MAX = 14000;

export const COWORK_PROMPT_PREFIX = 'Using the alerts connector and the investigate-alert skill, ';

export const COWORK_CASE_LABELS: Record<CoworkCaseKind, string> = {
  investigate: 'Investigate with Cowork',
  second_opinion: 'Second opinion',
  pattern: 'Check for a pattern',
  triage: 'Triage this list',
  explain_request: 'Explain before I approve',
  handover: 'Shift handover',
};

/** The prompt for a case. It carries ids and links only: Claude fetches the data itself. */
export function coworkPrompt(c: CoworkCase): string {
  return COWORK_PROMPT_PREFIX + promptBody(c);
}

function promptBody(c: CoworkCase): string {
  switch (c.kind) {
    case 'investigate':
      return `investigate ${c.alertId}. Test the evidence against the rule and recommend one next action.`;
    case 'second_opinion':
      return `review the closure of ${c.alertId}. Quote the closing note, compare it with related alerts, and say whether it should be reopened.`;
    case 'pattern':
      return `check whether trader ${c.traderName} (${c.traderId}) has a pattern across alerts, any status, and how each was closed.`;
    case 'triage':
      return `triage the alerts at ${alertListUrl(c.base, c.search)}: search with the same filters and rank them.`;
    case 'explain_request':
      return `explain request ${c.requestId} on ${c.alertId}: what it changes, why you asked for it, and what I should check before approving.`;
    case 'handover':
      return 'write my shift handover.';
    default: {
      const never: never = c;
      return never;
    }
  }
}

/** A `claude://cowork/new` link that opens Cowork with the prompt prefilled, or '' for a blank prompt. */
export function coworkLink(prompt: string): string {
  if (!prompt.trim()) return '';
  return `claude://cowork/new?q=${encodeURIComponent(prompt.slice(0, COWORK_PROMPT_MAX))}`;
}
