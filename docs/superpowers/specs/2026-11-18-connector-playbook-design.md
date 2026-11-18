# The playbook travels with the connector; prompts name tools

Date: 2026-11-18 · Size: small change (short design) · Follows PR #20 (Open in Cowork)

## Intent

Cowork connects to the alerts MCP server directly by URL (through a tunnel), not through the plugin. The `investigate-alert` skill ships only in the plugin, so Claude in Cowork gets the 8 tools with no playbook. And the Open in Cowork prompts name a skill that isn't there and, for triage, hand Claude an app URL (`http://localhost:5173/alerts?...`) it may try to open instead of calling `search_alerts`. Claude should follow the playbook in every client, and every prompt should say which tools to call.

## Goals, non-goals, anti-goals

- **Goals:** the MCP server sends the playbook as its MCP `instructions` on initialise, for every client; the six Open in Cowork prompts name the tools (and, for triage, the exact `search_alerts` arguments) and no longer mention the skill or pass an app URL.
- **Non-goals:** MCP `prompts` (slash commands); changes to tools, results or the plugin's skill content beyond what the instructions need; removing the plugin (Claude Code keeps using it).
- **Anti-goals:** two copies of the playbook drifting apart; a prompt that makes Claude fetch a localhost URL.

## Approaches

| | Approach | Trade-off | Decision |
|---|---|---|---|
| A | Server `instructions` read from the existing `SKILL.md`; prompts rewritten to name tools | One copy of the playbook; works in any client that honours server instructions (Claude clients do) | **Chosen** |
| B | A plus the six cases as MCP `prompts` | Slash commands in clients that support them; more to build; Cowork support unverified | Rejected for now |

## Design

**Instructions.**
- `apps/mcp-server/src/main.ts` reads `plugin/skills/investigate-alert/SKILL.md` at startup, strips the YAML front matter, and passes the body to `startHttp` as `instructions?: string`. `createMcpServer` passes it to `new McpServer(info, { instructions })`, so every session, with or without MCP Apps, gets it in the initialise result.
- A missing or unreadable file logs a warning and the server starts without instructions (as today).
- Claude Code with the plugin gets the playbook twice (skill + instructions). Accepted: same text, small cost. *(My call.)*

**Prompts** (`packages/domain/src/cowork.ts`). The prefix becomes `Using the alerts tools, `. Bodies:

| Case | Prompt after the prefix |
|---|---|
| investigate | `investigate {id}: call get_alert, get_alert_timeline and find_related_alerts, test the evidence against the rule's indicators, and recommend one next action.` |
| second_opinion | `review the closure of {id}: call get_alert and find_related_alerts, quote the closing note, compare it with the related alerts, and say whether it should be reopened.` |
| pattern | `check whether trader {name} ({traderId}) has a pattern: call search_alerts with traderId {traderId} (any status) and find_related_alerts for the most recent one, and say how each alert was closed.` |
| triage | `triage this list: call search_alerts with {json}, then rank the results and say why.` where `{json}` is the list's filters as `search_alerts` arguments (`status`, `severity`, `category`, `desk`, `assigneeId`, `traderId`, `instrument`, `from`, `to`, `q`, `sort`; empty ones and `page` left out), e.g. `{"status":["open"],"severity":["high"],"desk":["eu-equities"],"q":"layering"}`. |
| explain_request | `explain request {requestId} on {alertId}: call get_action_request and get_alert, then say what it changes, why you asked for it, and what I should check before approving.` |
| handover | `write my shift handover: call list_users to find me, search_alerts with involvedUserId set to my id and updatedFrom today at 00:00 UTC, then get_alert_timeline for each alert.` |

- The triage case drops its `base` field (no URL any more); `ListToolbar` stops passing `window.location.origin`.
- Exported helper `searchArgs(search: AlertListSearch): Record<string, unknown>` builds the triage JSON (stable key order as listed above).

## Tests

- `packages/domain/test/cowork.test.ts`: exact text for all six prompts; triage JSON omits empty filters and `page`; no prompt contains `http` or `skill`.
- `apps/mcp-server`: a test client's `getInstructions()` contains the playbook's `# Investigate an alert` heading and no front matter; with a missing file the server starts and `getInstructions()` is undefined.
- `apps/web/e2e/open-in-cowork.spec.ts`: update the expected prompt text.

## Docs

- `docs/spike-notes.md` (Open in Cowork check 4): "Does Claude follow the playbook (connector instructions) and call the tools named in the prompt?"
- README: one line that the connector carries the playbook as MCP instructions, so a URL-only connector (Cowork) needs no plugin.

## Left to the builder

How the front matter is stripped (a small regex is fine) and where the warning is logged.
