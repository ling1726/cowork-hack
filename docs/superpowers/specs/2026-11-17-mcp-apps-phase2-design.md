# Phase 2: Alerts in Cowork (MCP Apps) — Design

Date: 2026-11-17 · Status: draft for approval

Related: [Phase 1 design](2026-11-17-alerts-demo-design.md) (§12 sketched this phase) · [Rehearsal workflows](../../rehearsal-workflows.md) (W6) · [Why MCP](../../why-mcp.md) · [Spike notes](../../spike-notes.md)

## 1. Intent

In phase 1, Claude answers in text and hands the analyst into the app through links. Phase 2 makes Claude's answers in Cowork **render as the app's own UI**: an alert list, an alert card and a card for each request Claude makes. The analyst can approve or reject Claude's requests **on the card, inside Cowork**, without switching windows.

The demo should land three points:

1. **Same UI.** The list and card in Cowork are the app's components, in the app's branding. Nobody can tell where the app ends and Cowork begins.
2. **Claude asks, the analyst decides.** Claude submits requests. The analyst approves them on the card. The server still makes sure Claude can never approve its own request.
3. **One system.** A decision made in Cowork shows up in the app ("approved by Priya Shah in Cowork") and the other way round: approving in the app flips the card in Cowork.

### The demo (replaces W6)

1. **"Show me open high-severity EU Equities alerts."** `search_alerts` renders the alert list: the app's table, sortable, with severity and status badges. Each row has an **Investigate** button that sends "Investigate ALT-1042" to Claude as the user's next message.
2. **Claude investigates.** `get_alert` renders the alert card: header, highlights and recent activity. Claude recommends acknowledging and commenting, and submits both. `acknowledge_alert` and `add_comment` each render a **request card**: what Claude asks for, its rationale, the payload, and Approve / Reject.
3. **The analyst approves on the card.** The request card shows "Approved by Priya Shah in Cowork". The alert card refreshes to **In Progress**. Claude is told about the decision and carries on when the analyst next speaks. "Open in app" shows the timeline entry "via Claude · approved by Priya Shah in Cowork".
4. **(Optional, shows "one system")** Reject or approve a second request **in the app** instead. The card in Cowork flips on its own within a few seconds.

## 2. Goals, non-goals, anti-goals

**Goals**
- Three MCP App views built from `@app/ui`: `alert-list`, `alert-card`, `action-request`.
- Approve and reject Claude's requests from the request card in Cowork, recorded as a human decision made in Cowork.
- Every view links into the app ("Open in app"), and the request card stays in sync with decisions made in the app.
- Clients that cannot render MCP Apps (Claude Code, older hosts) keep exactly the phase 1 behaviour: text with deep links, and **no** decision tools.
- Automated end-to-end coverage of the three views and the in-card approval, without needing Cowork.

**Non-goals**
- Any write from a card other than approve or reject. Escalate, close, reopen, assignees, links and attachments stay in the app. The alert card shows no action buttons.
- Approving from Claude Code, or from any client without MCP Apps support.
- Migrating to MCP SDK v2 (see §4).
- Authentication. The demo still trusts `X-User-Id` and shared tokens, as in phase 1.

**Anti-goals** (failures even if everything "works")
- **Claude approving or rejecting its own request.** It must be impossible through the API with the agent token (server-enforced, as in phase 1). Claude must not even be offered the decision tools (see §5.2).
- A decision made in Cowork that the app shows as an ordinary app decision. Where the decision was made is always recorded and shown.
- A card that diverges visibly from the app: different components, colours or wording.
- A card that claims something happened that the server did not confirm. It shows server state, never optimistic state.
- The Cowork-decision credential being usable for anything except approving or rejecting a pending request on behalf of the acting user.

## 3. Constraints

- Everything from the phase 1 constraints (TypeScript, pnpm monorepo, shadcn/ui on Base UI with Tailwind v4, no database, Playwright).
- `@app/ui` stays presentational: no router, React Query, Zustand or path aliases (enforced by the existing guard test). Views import it as source.
- The iframe makes no network calls. All data comes from tool results or tool calls through the host bridge.
- pnpm's `minimumReleaseAge` applies. No `minimumReleaseAgeExclude` entries.
- The MCP server must keep working for phase 1 clients unchanged.

## 4. Approaches considered

**How an approval in Cowork reaches the server as the human** (the main decision; picked by the user):

| Option | Trade-off | Verdict |
| --- | --- | --- |
| **A. A second backend token scoped to approve/reject** ("Cowork token"). Requests with it count as the human acting in Cowork and are accepted only on approve/reject. The MCP server uses it only in two tools that only the card can call. | If Claude ever reached those tools, the worst case is approving a request that is already waiting. The server still enforces that the token can do nothing else. Decisions are marked "in Cowork". | **Chosen** |
| B. The MCP server calls approve with no token, as a plain app user. | Smallest change, but the MCP server could then do anything as the human, only host-side tool hiding stops Claude, and nothing marks the decision as made in Cowork. | Rejected |
| C. A, plus a one-time approval code per request, delivered to the card in a part of the result the model does not see. | Strongest separation, but more moving parts, and it depends on Cowork keeping that part away from the model, which is unverified. | Deferred: worth adding if this goes beyond a demo |

Earlier in the conversation the user first chose "approval happens in the app", then chose to move approval into the cards (option B of that question). The app keeps its own Approve/Reject; whichever decides first wins.

**What the other buttons do:** view-only cards whose buttons open the app or hand Claude a prompt (chosen), versus buttons that queue writes (rejected: a human click would be recorded as Claude's action).

**SDK version** *(my call)*: `@modelcontextprotocol/ext-apps` **1.7.5**, not 2.x. 2.x requires MCP SDK v2 (`@modelcontextprotocol/server`), and `apps/mcp-server` is on `@modelcontextprotocol/sdk` 1.32. 1.7.5 peers on SDK `^1.29`, and the README states the wire protocol is unchanged between 1.x and 2.x, so hosts treat both the same. Migrating to SDK v2 is a separate change.

## 5. Design

### 5.1 Backend (`apps/server`): the Cowork token

- New env `COWORK_TOKEN` (optional). Add it to `.env.example` with a dev value. If unset, the Cowork path does not exist: a request bearing any unknown token is treated as today (no agent, no Cowork).
- The context middleware recognises at most one bearer token per request: `AGENT_TOKEN` → `{ via: 'claude', isAgent: true }` (unchanged); `COWORK_TOKEN` → `{ via: 'app', isAgent: false, surface: 'cowork' }`; otherwise `surface: 'app'`. Use the same constant-time comparison.
- **Scope.** With `surface: 'cowork'`, only `POST /api/action-requests/{id}/approve` and `POST /api/action-requests/{id}/reject` are allowed. Every other route, reads included, returns **403** `cowork_forbidden`. Enforce this centrally (one middleware with an allowlist), not per route, so new routes are closed by default.
- The existing rules still apply: only `onBehalfOf` may decide, only pending requests can be decided, the agent token gets 403.
- **Record where it was decided.** New domain enum `DecisionSurface = z.enum(['app', 'cowork'])`.
  - `ActionRequest` gains `decidedIn?: DecisionSurface`, set on approve, reject and fail.
  - Timeline events gain optional `decidedIn`, set on the event produced by an approved request and on `action_rejected`.
  - `via` keeps its meaning (who authored the change: app or Claude). A Cowork decision is a human decision, so `via` is not extended.

### 5.2 MCP server (`apps/mcp-server`)

**Sessions.** Today the server is stateless: every HTTP request gets a fresh `McpServer`, so it cannot know whether the client declared MCP Apps support. Switch to **stateful Streamable HTTP sessions** (in-memory map keyed by session id; an unknown session id gets 404 so the client re-initialises, which Streamable HTTP clients do on their own). Keep the Host/Origin checks unchanged. *(My call. It is the only way to gate tools on client capabilities.)*

**Capability gating.** On initialise, read the client's MCP Apps capability (`getUiCapability(clientCapabilities)` from `@modelcontextprotocol/ext-apps/server`). Then:
- **With MCP Apps support:** register the UI resources, attach `_meta.ui.resourceUri` to the view tools, and register the two decision tools (if `COWORK_TOKEN` is set).
- **Without it:** register exactly the phase 1 tool set, with no UI metadata and no decision tools. Phase 1 clients see no change.

**Resources** (MIME `text/html;profile=mcp-app`, registered with `registerAppResource`). The HTML comes from `apps/mcp-ui/dist`. If a file is missing at startup, log a warning and don't register UI for that view. Text results still work.

| Resource | Rendered by tools |
| --- | --- |
| `ui://alerts/alert-list` | `search_alerts` |
| `ui://alerts/alert-card` | `get_alert` |
| `ui://alerts/action-request` | `add_comment`, `acknowledge_alert`, `get_action_request` |

**What the views receive.** The text and `structuredContent` that Claude reads stay as in phase 1. Extra data that only the view needs goes in the result's `_meta` under `"alerts/view"`:
- **list:** `users` (for assignee avatars).
- **alert card:** the last 3 timeline events, `users`, the `url` to open.
- **request card:** the request detail (request + alert summary + result event), `users`, the app's request URL, and `canDecide` (`true` only when the decision tools are registered).

This keeps Claude's context free of view-only payload. *(My call.)*

**Write results when approval is off.** `add_comment` and `acknowledge_alert` may apply immediately (`status: 'applied'`). The request card must handle this: it shows "Applied immediately (approval is off for this user)" with an "Open in app" link and no buttons.

**Decision tools** (registered with `registerAppTool`, `_meta.ui.visibility: ["app"]`, so the host offers them to the card but not to the model):
- `approve_action_request { requestId }`
- `reject_action_request { requestId, reason? }` (reason ≤ 1000 chars)

Both call the backend through a **second API client** that sends `X-User-Id: ACTING_USER_ID` and `Authorization: Bearer COWORK_TOKEN`. They return the updated request detail in the same shape as `get_action_request`, including the view `_meta`. Backend errors (409 already decided, 403) come back as tool errors whose text the card shows. Annotations: `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`.

New MCP env: `COWORK_TOKEN` (optional; must match the backend's). No other env changes.

### 5.3 Views (`apps/mcp-ui`, new)

- A Vite app with `vite-plugin-singlefile` that builds three self-contained HTML files: `alert-list.html`, `alert-card.html`, `action-request.html`. React 19, `@app/ui` (source), `@app/ui/styles.css`, `@modelcontextprotocol/ext-apps` 1.7.5 (React entry for `useApp`). `pnpm build` at the root builds it, and the MCP server reads its `dist`.
- Each view is a thin container: it takes the tool result (`structuredContent` + `_meta["alerts/view"]`), maps it onto the existing `@app/ui` component, and wires callbacks to the bridge. No data fetching beyond the bridge calls listed here.
- **Theme.** Follow the host's light/dark preference from the host context (toggle `.dark` on `<html>`). Keep the app's brand tokens; don't adopt the host's fonts or colours, so the card matches the app. Report content size changes to the host so the iframe fits its content.
- **Links.** "Open in app" and alert links call the bridge's `openLink` with the deep link (no `target=_blank` anchors, which the sandbox may block).

| View | Component | Behaviour |
| --- | --- | --- |
| alert-list | `AlertTable` | Shows the returned items (top N; sorting re-orders those items client-side). A footer shows "Showing N of total" and "Open in app" (`listUrl`, if present). Each row has a visible **Investigate** control that sends the user message `Investigate <id>` through the bridge's `sendMessage`. If the host rejects `sendMessage`, the control opens the alert in the app instead. |
| alert-card | `AlertSummaryCard` | Header, highlights, last 3 events, Open in app. No action buttons. Refreshes by calling `get_alert` through the bridge every 5 s while the document is visible, plus once when it becomes visible again, so a decision made elsewhere shows up (beat 3). |
| action-request | `ActionRequestCard` | Shows the request. When pending and `canDecide`: Approve, and Reject with an optional reason (the existing two-step reject). When pending and not `canDecide`: "Review in app". After a decision: status, who decided, where ("in Cowork" / "in the app"), and the reject reason or failure cause. While pending it polls `get_action_request` every 3 s (the web app's `POLL_MS`) while visible, and stops once decided. |

**After a decision in the card**, the view calls the bridge's `updateModelContext` with one line, for example "The user approved request AR-0003 (Acknowledge ALT-1042) in Cowork." This lets Claude know on its next turn without calling `get_action_request`. The card does **not** send a chat message on the user's behalf. *(My call: a message the user didn't type would put words in their mouth.)*

Busy and error states: the buttons are disabled while a decision call is in flight. A tool error shows inline on the card ("Already approved in the app" for 409 `already_decided`), and the card then re-reads the request.

### 5.4 Shared UI (`packages/ui`)

- `ActionRequestCard`: add an optional `decidedIn` display ("Approved by Priya Shah **in Cowork**") and an optional "Open in app" / "Review in app" slot (`renderLink`, same pattern as `AlertSummaryCard`). The existing props keep working for the web app.
- `ViaClaudeTag` / `AlertTimeline`: "via Claude · approved by Priya Shah in Cowork" when the event's `decidedIn` is `cowork`. The `action_rejected` line names Cowork the same way.
- `AlertTable`: an optional per-row action slot (for Investigate), rendered as a button that row clicks ignore (the table already ignores clicks on `a, button`).
- No new dependency on the bridge in `@app/ui`. The views pass callbacks in.

### 5.5 Web app (`apps/web`)

- Queue list, request detail and the alert banner show where a decided request was decided. Pending lists already poll every 3 s, so a Cowork decision appears without a reload.
- No other changes.

### 5.6 Plugin and docs

- `investigate-alert` skill: in Cowork, the analyst can approve on the request card. After submitting, tell them they can approve on the card or in the app. Still never describe a change as done until `get_action_request` reports `approved` or the conversation context says the user approved it.
- `docs/rehearsal-workflows.md`: rewrite W6 to the demo in §1, and remove "Fluent".
- `docs/spike-notes.md`: add the MCP Apps checks from §7.
- `README.md`: `apps/mcp-ui`, `COWORK_TOKEN`, how to run the test host.

## 6. Testing

| Layer | Tool | Covers |
| --- | --- | --- |
| `@app/domain` | Vitest | `DecisionSurface`, new optional fields parse, old data still parses |
| `apps/server` | Vitest + `app.request()` | Cowork token: approve and reject own pending request (200, `decidedIn: 'cowork'` on the request and on the event); 403 `cowork_forbidden` on every other route, including GETs and settings PUT; agent token still 403 on approve/reject; another user's request 403; already decided 409; unset `COWORK_TOKEN` means that bearer is not special; app decisions record `decidedIn: 'app'` |
| `apps/mcp-server` | Vitest + MCP SDK client against a real backend and server (as today) | A client **with** the UI capability sees resources, `_meta.ui.resourceUri` on the five tools, and the two decision tools with `visibility: ["app"]`; a client **without** it sees exactly the phase 1 tool list and no resources; resources serve `text/html;profile=mcp-app`; approve/reject through the tools change the backend and record `cowork`; view `_meta` present and absent from the text; session lifecycle (init, reuse, unknown session 404) |
| `apps/mcp-ui` | Playwright against a **test host** | A small page (`apps/mcp-ui/test-host`, dev-only) built on `@modelcontextprotocol/ext-apps/app-bridge` that connects to the real MCP server with the UI capability, calls a tool and renders its view in a sandboxed iframe. Tests: list renders the seeded EU Equities set and Investigate sends `Investigate ALT-1042`; alert card renders ALT-1042; acknowledge request card → Approve → "Approved … in Cowork", and the web app timeline shows "approved by Priya Shah in Cowork"; Reject with reason; approve in the web app → the card flips within 5 s; approval-off result renders "Applied immediately"; dark host theme sets `.dark` |
| `packages/ui` | existing guard test | still no router/query/store imports |

The test host doubles as a **rehearsal fallback**: if Cowork misbehaves on the day, the presenter can show the views in the test host.

## 7. Spike (human, before or alongside the build)

Phase 2 depends on Cowork features no one has checked against our server. Add these to `docs/spike-notes.md` and run them once the MCP server serves one `ui://` resource:

1. Does Cowork render a `ui://` resource from `http://localhost:3002/mcp` (or a tunnel)?
2. Does it declare the MCP Apps capability on initialise (so gating works)?
3. Does it allow the card to call an app-only tool, and does it **hide** that tool from Claude?
4. Do `openLink`, `sendMessage` and `updateModelContext` work?
5. Does it pass light/dark in the host context?
6. Does the view receive the tool result's `_meta` (the `"alerts/view"` payload)? The SDK passes the full `CallToolResult` to the view, but a host could strip it.

If 6 fails, move the view payload into app-only read tools the view calls on load. If 3 fails (Cowork exposes app-only tools to the model), stop and revisit option C before demoing. If 4 fails for `sendMessage`, Investigate falls back to opening the app (already designed).

## 8. Left to the builder

- File layout inside `apps/mcp-ui`, the bridge hook's shape, and how the MCP server finds `dist` (path relative to the package is fine).
- The exact `_meta` key layout under `"alerts/view"`, as long as Claude's text and `structuredContent` are unchanged.
- How the session map is cleaned up (idle timeout is fine; the demo runs for minutes).
- The test host's look: plain is fine.
- Whether `alert-list` caps its height and scrolls inside the card.
