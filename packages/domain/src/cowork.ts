import type { AlertListSearch } from './search-params.ts';

/** One "Open in Cowork" entry point in the app, with the ids its prompt needs. */
export type CoworkCase =
  | { kind: 'investigate'; alertId: string }
  | { kind: 'second_opinion'; alertId: string }
  | { kind: 'pattern'; traderId: string; traderName: string }
  | { kind: 'triage'; search: AlertListSearch }
  | { kind: 'explain_request'; requestId: string; alertId: string }
  | { kind: 'handover' };

export type CoworkCaseKind = CoworkCase['kind'];

/** Claude Desktop truncates `q` at about this many characters. */
export const COWORK_PROMPT_MAX = 14000;

/**
 * Every prompt names the tools to call. The playbook reaches Claude as the MCP server's
 * instructions, so the prompt doesn't depend on a skill, and it never hands Claude an app URL
 * (Cowork runs on Anthropic's servers and can't open localhost).
 */
export const COWORK_PROMPT_PREFIX = 'Using the alerts tools, ';

/** List filters that are also `search_alerts` arguments, in the order they're written out. */
const SEARCH_ARG_KEYS = [
  'status',
  'severity',
  'category',
  'desk',
  'assigneeId',
  'traderId',
  'instrument',
  'from',
  'to',
  'q',
  'sort',
] as const;

/** The list's filters as `search_alerts` arguments: empty values and `page` are left out. */
export function searchArgs(search: AlertListSearch): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const key of SEARCH_ARG_KEYS) {
    const value = search[key];
    if (value === undefined) continue;
    if (Array.isArray(value) ? value.length === 0 : String(value).trim() === '') continue;
    args[key] = value;
  }
  return args;
}

export const COWORK_CASE_LABELS: Record<CoworkCaseKind, string> = {
  investigate: 'Investigate with Cowork',
  second_opinion: 'Second opinion',
  pattern: 'Check for a pattern',
  triage: 'Triage this list',
  explain_request: 'Explain this request',
  handover: 'Shift handover',
};

/** The prompt for a case. It carries ids and tool arguments only: Claude fetches the data itself. */
export function coworkPrompt(c: CoworkCase): string {
  return COWORK_PROMPT_PREFIX + promptBody(c);
}

function promptBody(c: CoworkCase): string {
  switch (c.kind) {
    case 'investigate':
      return `investigate ${c.alertId}: call get_alert, get_alert_timeline and find_related_alerts, test the evidence against the rule's indicators, and recommend one next action.`;
    case 'second_opinion':
      return `review the closure of ${c.alertId}: call get_alert and find_related_alerts, quote the closing note, compare it with the related alerts, and say whether it should be reopened.`;
    case 'pattern':
      return `check whether trader ${c.traderName} (${c.traderId}) has a pattern: call search_alerts with traderId ${c.traderId} (any status) and find_related_alerts for the most recent one, and say how each alert was closed.`;
    case 'triage':
      return `triage this list: call search_alerts with ${JSON.stringify(searchArgs(c.search))}, then rank the results and say why.`;
    case 'explain_request':
      return `explain request ${c.requestId} on ${c.alertId}: call get_action_request and get_alert, then say what it changes, why you asked for it, and what I should check before approving.`;
    case 'handover':
      return 'write my shift handover: call list_users to find me, search_alerts with involvedUserId set to my id and updatedFrom today at 00:00 UTC, then get_alert_timeline for each alert.';
    default: {
      const never: never = c;
      return never;
    }
  }
}

/** A `claude://cowork/new` link that opens Cowork with the prompt prefilled, or '' for a blank prompt. */
export function coworkLink(prompt: string): string {
  if (!prompt.trim()) return '';
  let cut = prompt.slice(0, COWORK_PROMPT_MAX);
  // Don't leave half of a surrogate pair: encodeURIComponent throws on a lone surrogate.
  if (/[\uD800-\uDBFF]$/.test(cut)) cut = cut.slice(0, -1);
  return `claude://cowork/new?q=${encodeURIComponent(cut)}`;
}
