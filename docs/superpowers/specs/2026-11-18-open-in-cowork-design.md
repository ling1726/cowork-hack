# Open in Cowork: buttons from the app into Claude

Date: 2026-11-18 · Size: small change (short design)

## Intent

Today the round trip runs one way: Claude answers in Cowork and deep-links into the app. This adds the reverse. From the alert, the list, a request or the sidebar, the analyst presses a button and lands in a new Cowork session with the right prompt already written, so they can start in either place.

## Goals, non-goals, anti-goals

- **Goals:** six entry points (below); each opens Cowork with a prompt the `investigate-alert` skill already handles; the analyst can review and edit the prompt before it leaves the app.
- **Non-goals:** running Claude inside the app (no Agent SDK, no API key, no streamed answers); new MCP tools; new backend endpoints.
- **Anti-goals:** sending anything automatically; putting alert data in the prompt (Claude fetches it through the connector, so the prompt carries ids only and data can't go stale or leak into the URL); a dead click with no feedback when Claude Desktop isn't installed.

## Approaches considered

| | Approach | Trade-off | Decision |
|---|---|---|---|
| A | Link button: `claude://cowork/new?q=<prompt>` | Tiny, no backend; leaves the app; known bug where the prompt doesn't commit if the app is already running | **Chosen** |
| B | In-app chat box via the Agent SDK + our MCP server | Never leaves the page; a second Claude front end, API key, server process; overlaps phase 2 | Rejected |
| C | In-app composer that hands off via A | Chat-box feel at almost A's cost; the analyst can add their own question | **Chosen, on top of A** |

## Mechanism (documented)

- `claude://cowork/new?q=<url-encoded prompt>` opens Claude Desktop in a new Cowork session with the composer prefilled (support.claude.com article 14729294). `q` is truncated at about 14,000 characters. The prompt is prefilled, not sent.
- No `folder` or `file` parameters: they trigger confirmation dialogs and aren't needed.
- Known issue (github anthropics/claude-code #73593): with the app already running, the prompt may render without a Send button. Mitigation: the composer always offers **Copy prompt**, and the spike below checks the current build.
- Web fallback `https://claude.ai/new?q=` is **not** used: Cowork on the web can't reach the MCP server on localhost.

## Entry points and prompts

Each prompt starts with "Using the alerts connector and the investigate-alert skill," then:

| # | Where (route) | Button | Prompt continues |
|---|---|---|---|
| 1 | Alert page `/alerts/$alertId` header | Investigate with Cowork | "investigate {id}. Test the evidence against the rule and recommend one next action." |
| 2 | Alert page, when status is Closed | Second opinion | "review the closure of {id}. Quote the closing note, compare it with related alerts, and say whether it should be reopened." |
| 3 | Alert page, Details panel trader row | Check for a pattern | "check whether trader {traderName} ({traderId}) has a pattern across alerts, any status, and how each was closed." |
| 4 | List `/alerts` toolbar | Triage this list | "triage the alerts at {listUrl}: search with the same filters and rank them." (filters described in words too) |
| 5 | Request `/queue/$requestId` | Explain this request | "explain request {requestId} on {alertId}: what it changes, why you asked for it, and what I should check before approving." |
| 6 | Sidebar | Shift handover | "write my shift handover." |

## UI

- **Button:** one `OpenInCoworkButton` (outline, small, Claude-style sparkle icon) taking a `CoworkPrompt` (case + ids). It opens the composer; it never jumps straight out.
- **Composer (option C):** a dialog using the existing `ActionDialog`/`FormField` pattern. A textarea prefilled with the case prompt, a short hint ("Claude will fetch the alert itself. Nothing is sent until you press Send in Cowork."), and two actions: **Open in Cowork** (primary; sets `window.location.href` to the `claude://` link) and **Copy prompt**.
- After Open, the dialog stays open with a one-line note: "If Cowork didn't open, copy the prompt and paste it into a new Cowork session."

## Code shape

- `packages/domain`: `buildCoworkPrompt(case, ctx)` and `coworkLink(prompt)`, next to the existing link builder. Pure, unit-tested. Includes the `listUrl` from the existing link builder for case 4. Caps the prompt at 14,000 characters.
- `apps/web/src/components/OpenInCowork.tsx`: button plus composer dialog.
- Wire the button into: alert page header area (cases 1 to 3), `ListToolbar` (4), `queue.$requestId.tsx` (5), `AppSidebar` (6).
- No server, MCP or plugin changes.

## Tests

- Vitest: prompt text per case, URL encoding round trip, length cap, `listUrl` matches the current filters.
- Component: dialog prefill, edit, Copy prompt writes to the clipboard, Open sets the expected `claude://cowork/new?q=` href (with `location` stubbed).
- Playwright: each entry point opens the dialog with the right prompt. It can't follow `claude://`, so it asserts the href.

## Spike before demo (add to spike-notes.md)

1. With Claude Desktop **closed**, click Open in Cowork: does a Cowork session open with the prompt and a Send button?
2. Same with the app **already open** (bug #73593).
3. Does the browser ask "Open Claude?" the first time, and does "always allow" stick for localhost:5173?
4. After Send, does Claude pick up the skill and the alerts connector without further help?

If 2 fails on the day, demo with the app closed first, or use Copy prompt.

## Left to the builder

Exact button placement and icon, dialog copy beyond the lines above, and whether cases 2 and 3 sit in the header or in their panels.
