# Phase 2: Alerts in Cowork (MCP Apps) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the alert list, alert card and Claude's request cards inside Cowork from MCP tool results, built from `@app/ui`, with Approve/Reject on the request card recorded as a human decision made in Cowork.

**Architecture:** The backend gains a `COWORK_TOKEN` that is accepted only on approve/reject and records `decidedIn: 'cowork'`. The MCP server switches to stateful sessions so it can read the client's MCP Apps capability at initialise: capable clients get three `ui://` resources, view metadata on five tools, view-only payload in result `_meta`, and two app-only decision tools; other clients get exactly the phase 1 surface. A new `apps/mcp-ui` builds three single-file HTML views that wrap `@app/ui` components and talk to the host through a small bridge adapter. A dev-only test host page drives Playwright end to end without Cowork.

**Tech Stack:** TypeScript, Hono, `@modelcontextprotocol/sdk` 1.32, `@modelcontextprotocol/ext-apps` 1.7.5, Vite 8 + `vite-plugin-singlefile` 2.3.4, React 19, `@app/ui` (shadcn/Base UI, Tailwind v4), Vitest 5, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-17-mcp-apps-phase2-design.md`

## Global Constraints

- `@modelcontextprotocol/ext-apps` pinned to **1.7.5** (peers on `@modelcontextprotocol/sdk ^1.29`). No MCP SDK v2 migration.
- `vite-plugin-singlefile` pinned to **2.3.4**. No `minimumReleaseAgeExclude` entries may be added.
- `@app/ui` stays presentational: no router, React Query, Zustand, bridge or `@/` alias imports (the guard test in `packages/ui/test/components.test.tsx` must stay green).
- The iframe makes no network calls. All view data comes from tool results or bridge tool calls.
- Phase 1 clients (no MCP Apps capability) see exactly the 8 phase 1 tools, no resources, no `_meta.ui`, and unchanged result text.
- `via` keeps its meaning (app vs Claude authored). Where a request was decided is `decidedIn: 'app' | 'cowork'`.
- The Cowork token is allowed **only** on `POST /api/action-requests/{id}/approve` and `/reject`. Everything else, reads included, is 403 `cowork_forbidden`.
- Decision tools: `approve_action_request { requestId }`, `reject_action_request { requestId, reason? }` (reason ≤ 1000 chars), `_meta.ui.visibility: ["app"]`.
- Resource URIs: `ui://alerts/alert-list`, `ui://alerts/alert-card`, `ui://alerts/action-request`. MIME `text/html;profile=mcp-app`.
- View payload lives in the tool result's `_meta["alerts/view"]`. Claude's text and `structuredContent` stay as in phase 1.
- Copy: "Approved by {name} in Cowork" / "in the app"; "via Claude · approved by {name} in Cowork"; "Applied immediately (approval is off for this user)"; "Review in app"; "Open in app"; "Investigate"; investigate message text `Investigate {id}`; model context line `The user approved request {id} ({kind label} {alertId}) in Cowork.` (and `rejected` with `Reason: {reason}` appended when given).
- Polling: request card every **3000 ms** while pending and visible; alert card every **5000 ms** while visible, plus once on becoming visible.
- Fixed ports: API 3001, web 5173, MCP 3002, test host 5174. Playwright runs one suite at a time (`workers: 1`).
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A decision that races the app.** The user clicks Approve on the card after the request was already decided in the app. Expected: the card shows "Already decided in the app", re-reads the request and shows its real status. Never a stuck spinner or a false "Approved". *(Task 6 test `approve after an app decision shows the conflict and the real status`)*
2. **Double click on Approve.** Expected: exactly one `approve_action_request` call. *(Task 6 test `approve is sent once on a double click`)*
3. **MCP server restarted mid-demo.** Cowork still holds an old session id. Expected: 404 for the unknown session, so the client re-initialises; never a 500. *(Task 4 test `an unknown session id gets 404`)*
4. **Views not built.** `apps/mcp-ui/dist` is missing. Expected: the MCP server starts, logs a warning, and serves text-only results to everyone (no resources, no `_meta.ui`), with decision tools still absent. *(Task 5 test `without built views, a UI client gets no resources and no decision tools`)*
5. **Polling never stops.** Expected: the request card stops polling once decided, and both cards pause while the document is hidden. *(Task 6 test `polling stops after a decision and pauses while hidden`)*

---

### Task 1: Domain: where a decision was made, and view payload types

**Files:**
- Modify: `packages/domain/src/enums.ts`, `packages/domain/src/schemas.ts`, `packages/domain/src/index.ts`
- Create: `packages/domain/src/mcp-views.ts`
- Test: `packages/domain/test/schemas.test.ts`

**Interfaces:**
- Produces: `DecisionSurface = z.enum(['app', 'cowork'])`, `type DecisionSurface`, `DECISION_SURFACE_LABELS: Record<DecisionSurface, string> = { app: 'in the app', cowork: 'in Cowork' }`.
- Produces: optional `decidedIn: DecisionSurface` on `actionRequestBase` and on `eventBase` (so on every `TimelineEvent`).
- Produces (types only, in `mcp-views.ts`):
  ```ts
  export const VIEW_META_KEY = 'alerts/view';
  export type ActionRequestDetail = ActionRequest & { alert: AlertSummary; resultEvent?: TimelineEvent };
  export interface AlertListView { users: User[] }
  export interface AlertCardView { recentEvents: TimelineEvent[]; users: User[] }
  export type ActionRequestView =
    | { kind: 'request'; detail: ActionRequestDetail; users: User[]; requestUrl: string; canDecide: boolean }
    | { kind: 'applied'; url: string; summary: string };
  export const RESOURCE_URIS = {
    alertList: 'ui://alerts/alert-list',
    alertCard: 'ui://alerts/alert-card',
    actionRequest: 'ui://alerts/action-request',
  } as const;
  ```

- [ ] **Step 1: Write failing tests** in `schemas.test.ts`: `ActionRequestSchema` parses a request with `decidedIn: 'cowork'` and keeps it; parses one without `decidedIn` (old data); rejects `decidedIn: 'slack'`. `TimelineEventSchema` parses an `action_rejected` event with `decidedIn: 'cowork'`. `DECISION_SURFACE_LABELS.cowork === 'in Cowork'`.
- [ ] **Step 2: Run** `pnpm vitest run packages/domain`. Expected: FAIL (`DecisionSurface` / `DECISION_SURFACE_LABELS` not exported, `decidedIn` stripped).
- [ ] **Step 3: Implement** the enum, labels, optional fields and `mcp-views.ts`. Export `mcp-views.ts` from `index.ts`. In `apps/server/src/services/agent-gate.ts`, replace the local `ActionRequestDetail` type with the domain one.
- [ ] **Step 4: Run** `pnpm vitest run packages/domain && pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(domain): decidedIn and MCP view payload types`.

### Task 2: Backend: the Cowork token

**Files:**
- Modify: `apps/server/src/env.ts`, `apps/server/src/context.ts`, `apps/server/src/app.ts`, `apps/server/src/main.ts`, `apps/server/src/routes/action-requests.ts`, `apps/server/src/services/agent-gate.ts`, `apps/server/src/services/commands.ts`, `apps/server/test/helpers.ts`, `.env.example`
- Create: `apps/server/test/cowork.test.ts`
- Modify test: `apps/server/test/access-queue.test.ts`

**Interfaces:**
- Consumes: `DecisionSurface` (Task 1).
- Produces: `ServerEnv.coworkToken?: string` (from `COWORK_TOKEN`, unset or empty → undefined); `AppOptions.coworkToken?: string`; `RequestCtx.surface: DecisionSurface` (`'cowork'` only for a valid Cowork bearer, else `'app'`; agent requests also `'app'`); `contextMiddleware(store, agentToken, coworkToken?)`.
- Produces: `coworkScope()` middleware, mounted after the context middleware on `/api/*`, that throws `ApiError(403, 'cowork_forbidden', 'The Cowork token can only approve or reject requests')` unless the request is `POST` and its path matches `^/api/action-requests/[^/]+/(approve|reject)$`.
- Produces: `approveRequest(store, id, caller, decidedIn: DecisionSurface)` and `rejectRequest(store, id, caller, decidedIn: DecisionSurface, reason?)`. Both set `decidedIn` on the request. Approval passes it through `Actor.decidedIn?: DecisionSurface` onto the applied event. Rejection puts it on the `action_rejected` event. Routes pass `c.get('ctx').surface`.
- Produces (test helpers): `COWORK_TOKEN = 'test-cowork-token'`, `asCowork(id)` (`X-User-Id` + `Authorization: Bearer test-cowork-token`), and `makeApp` passes `coworkToken: COWORK_TOKEN`.

- [ ] **Step 1: Write failing tests** in `cowork.test.ts` (queue a request first with `asAgent('U-01')`, as `access-queue.test.ts` does):
  - `cowork token approves the acting user's pending request`: 200, `status: 'approved'`, `decidedIn: 'cowork'`, `decidedBy: 'U-01'`; the applied event has `via: 'claude'`, `approvedBy: 'U-01'`, `decidedIn: 'cowork'`.
  - `cowork token rejects with a reason`: 200, `decidedIn: 'cowork'`, `rejectReason` set; the `action_rejected` event has `decidedIn: 'cowork'`.
  - `cowork token is refused everywhere else`: 403 with `error.code === 'cowork_forbidden'` for `GET /api/alerts`, `GET /api/action-requests`, `POST /api/alerts/ALT-1042/comments`, `POST /api/alerts/ALT-1042/acknowledge`, `PUT /api/users/U-01/settings`, `POST /api/admin/reset`, and `GET /api/action-requests/{id}/approve` (wrong method).
  - `cowork token cannot decide someone else's request`: 403 `not_owner` with `asCowork('U-02')`.
  - `cowork token on an already decided request`: 409 `already_decided`.
  - `without COWORK_TOKEN configured, the bearer is ordinary`: an app built with `coworkToken: undefined`; `asCowork('U-01')` can `GET /api/alerts` (200), and approving records `decidedIn: 'app'`.
  - In `access-queue.test.ts`, extend `approve applies the comment…` and `reject records action_rejected…` to assert `decidedIn: 'app'` on the request and on the event.
- [ ] **Step 2: Run** `pnpm vitest run apps/server`. Expected: FAIL (no Cowork path; `decidedIn` undefined).
- [ ] **Step 3: Implement** per Interfaces. Compare tokens with the existing constant-time `tokenMatches`. Check the agent token first. A token equal to both is a configuration error that `loadEnv` rejects (`AGENT_TOKEN and COWORK_TOKEN must differ`). Add `COWORK_TOKEN=dev-cowork-token` under `# Server` in `.env.example`, with a one-line comment saying it lets the Cowork cards approve or reject only.
- [ ] **Step 4: Run** `pnpm vitest run apps/server && pnpm typecheck`. Expected: PASS, including every existing server test.
- [ ] **Step 5: Commit** `feat(server): Cowork token scoped to approve/reject, decidedIn recorded`.

### Task 3: Shared UI and web app: show where a decision was made

**Files:**
- Modify: `packages/ui/src/components/ActionRequestCard.tsx`, `packages/ui/src/components/ViaClaudeTag.tsx`, `packages/ui/src/components/AlertTimeline.tsx`, `packages/ui/src/components/AlertTable.tsx`
- Modify: `apps/web/src/components/RequestCard.tsx` (the web app's only `ActionRequestCard` caller), `apps/web/src/components/RequestRow.tsx`, `apps/web/playwright.config.ts`
- Test: `packages/ui/test/components.test.tsx`, `apps/web/e2e/access-queue.spec.ts` (or the existing queue spec)

**Interfaces:**
- Consumes: `DecisionSurface`, `DECISION_SURFACE_LABELS` (Task 1).
- Produces: `ActionRequestCardProps` gains `decidedByName?: string` and `link?: { href: string; label: 'Open in app' | 'Review in app' }` plus `renderLink?: (href: string, label: string) => ReactNode` (same pattern as `AlertSummaryCard`). When decided and `decidedByName` is given, the card shows `data-testid="decision"` with `{Approved|Rejected} by {decidedByName} {DECISION_SURFACE_LABELS[decidedIn ?? 'app']}`. A `failed` request was approved and then could not be applied, so it reads `Approved by …` and the existing failure line gives the cause. When `link` is given, the footer renders it (via `renderLink`, else an `<a target="_blank" rel="noreferrer">`).
- Produces: `ViaClaudeTag({ approvedByName?, decidedIn? })`. The text is `via Claude · approved by {name} in Cowork` when `decidedIn === 'cowork'`; otherwise unchanged. `AlertTimeline` passes `e.decidedIn`. The `action_rejected` summary becomes `Rejected request {id} in Cowork` when `decidedIn === 'cowork'`.
- Produces: `AlertTableProps.renderRowAction?: (alert: AlertSummary) => ReactNode`. When given, it adds a last column with a visually hidden header `Actions`. Row clicks already ignore `a, button`.
- Web: `RequestCard` passes `decidedByName` (from users) to `ActionRequestCard`. `RequestRow` shows `in Cowork` next to the status badge when `decidedIn === 'cowork'`. `playwright.config.ts` backend env adds `COWORK_TOKEN: 'test-cowork-token'`.

- [ ] **Step 1: Write failing tests.**
  - In `components.test.tsx`:
    - `ActionRequestCard shows who decided and where`: request approved, `decidedIn: 'cowork'`, `decidedByName: 'Priya Shah'` → text `Approved by Priya Shah in Cowork`.
    - `ActionRequestCard renders its link slot`: `link={{ href: 'http://x/queue/AR-1', label: 'Review in app' }}` → a link named `Review in app`.
    - `ViaClaudeTag names Cowork`: → `via Claude · approved by Priya Shah in Cowork`.
    - `AlertTable renders a row action and the row click ignores it`: clicking the action button doesn't call `onRowClick`.
  - In the e2e spec, `a request approved in Cowork is marked in the queue and the timeline`:
    1. Queue a comment with the agent token.
    2. `POST /api/action-requests/{id}/approve` with headers `X-User-Id: U-01` and `Authorization: Bearer test-cowork-token`.
    3. `/queue/{id}` shows `Approved by Priya Shah in Cowork`.
    4. `/alerts/ALT-1042?tab=timeline` shows `via Claude · approved by Priya Shah in Cowork`.
- [ ] **Step 2: Run** `pnpm vitest run packages/ui` then `pnpm e2e -g "approved in Cowork"`. Expected: FAIL.
- [ ] **Step 3: Implement** per Interfaces.
- [ ] **Step 4: Run** `pnpm vitest run packages/ui && pnpm e2e && pnpm typecheck && pnpm lint`. Expected: PASS (all existing e2e green).
- [ ] **Step 5: Commit** `feat(ui,web): show where a request was decided; AlertTable row action`.

### Task 4: MCP server: stateful sessions and capability detection

**Files:**
- Modify: `apps/mcp-server/src/server.ts`, `apps/mcp-server/src/tools.ts` (signature only), `apps/mcp-server/package.json` (add `@modelcontextprotocol/ext-apps` `1.7.5`)
- Test: `apps/mcp-server/test/tools.test.ts`, create `apps/mcp-server/test/sessions.test.ts`

**Interfaces:**
- Produces: `createMcpServer(deps: McpDeps, opts: { ui: boolean }): McpServer` and `registerTools(server, deps, opts: { ui: boolean })`. In this task `ui` changes nothing yet, beyond being threaded through.
- Produces: `startHttp` keeps its signature and result. Internally: a `Map<string, { server: McpServer; transport: WebStandardStreamableHTTPServerTransport }>`.
  - A POST without `mcp-session-id` must be an initialize request (`isInitializeRequest` from the SDK types); otherwise 400 JSON-RPC error `-32000` "Bad Request: no session". On initialize: `ui = getUiCapability(body.params.capabilities) !== undefined` (from `@modelcontextprotocol/ext-apps/server`). Create the server and a transport with `sessionIdGenerator: () => randomUUID()`, `enableJsonResponse: true`, `onsessioninitialized` storing it and `onsessionclosed` deleting it. Call `transport.handleRequest(c.req.raw, { parsedBody: body })`.
  - With a known `mcp-session-id`: delegate to that transport (POST, GET and DELETE).
  - With an unknown one: 404 JSON-RPC error `-32001` "Session not found".
  - Host/Origin checks stay first and unchanged.
- Produces: `close()` also closes every live session.

- [ ] **Step 1: Write failing tests** in `sessions.test.ts` (same backend + `startHttp` setup as `tools.test.ts`):
  - `a client keeps one session across calls`: two `callTool` calls succeed, and the transport's `sessionId` is set and unchanged.
  - `an unknown session id gets 404`: raw `fetch` POST to `/mcp` with `mcp-session-id: nope` and a `tools/list` body → status 404.
  - `a non-initialize request without a session gets 400`.
  - `DELETE ends the session`: after `transport.terminateSession()`, a POST with the old id → 404.
  - `the UI capability is detected`: assert through the next task's behaviour. Here, assert only that a client created with `capabilities: { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } } }` connects and lists the 8 phase 1 tools.
- [ ] **Step 2: Run** `pnpm vitest run apps/mcp-server`. Expected: FAIL (`unknown session` is served statelessly; no session id).
- [ ] **Step 3: Implement** per Interfaces. Idle-session cleanup is your call; the spec allows a simple idle timeout.
- [ ] **Step 4: Run** `pnpm vitest run apps/mcp-server && pnpm typecheck`. Expected: PASS, including every existing tool and Host/Origin test.
- [ ] **Step 5: Commit** `feat(mcp): stateful sessions with MCP Apps capability detection`.

### Task 5: MCP server: UI resources, view payload and decision tools

**Files:**
- Create: `apps/mcp-server/src/ui.ts`, `apps/mcp-server/test/fixtures/ui/{alert-list,alert-card,action-request}.html` (tiny placeholder HTML), `apps/mcp-server/test/ui.test.ts`
- Modify: `apps/mcp-server/src/tools.ts`, `apps/mcp-server/src/server.ts`, `apps/mcp-server/src/env.ts`, `apps/mcp-server/src/main.ts`, `apps/mcp-server/test/env.test.ts`

**Interfaces:**
- Consumes: `VIEW_META_KEY`, `RESOURCE_URIS`, view payload types (Task 1); Cowork token semantics (Task 2); `createMcpServer(deps, { ui })` (Task 4).
- Produces: `McpDeps` gains `decisionApi?: ApiClient` (built with `agentToken: coworkToken`, i.e. it sends `Bearer <COWORK_TOKEN>`) and `uiDir?: string`. `McpEnv.coworkToken?: string` from `COWORK_TOKEN`. `main.ts` builds `decisionApi` only when set, and passes `uiDir` = `apps/mcp-ui/dist` resolved from the package (`fileURLToPath(new URL('../../mcp-ui/dist', import.meta.url))`).
- Produces in `ui.ts`:
  - `loadViews(uiDir: string | undefined): Partial<Record<keyof typeof RESOURCE_URIS, string>>` reads the three HTML files once (missing file → warn and skip).
  - `registerViews(server, views)` uses `registerAppResource` for each loaded view.
  - `toolUiMeta(uri)` returns `{ ui: { resourceUri: uri } }` plus the legacy `RESOURCE_URI_META_KEY` key.
  - `withView(result: CallToolResult, payload): CallToolResult` sets `result._meta[VIEW_META_KEY]`.
  - `registerDecisionTools(server, deps)` registers the two decision tools with `registerAppTool`.
- **The effective UI mode is `opts.ui && all three views loaded`.** When it is on:
  - Resources are registered.
  - The five view tools carry `_meta: toolUiMeta(...)`: `search_alerts` → alertList, `get_alert` → alertCard, and `add_comment`, `acknowledge_alert`, `get_action_request` → actionRequest.
  - Results carry the view payload:
    - `search_alerts` → `{ users }`
    - `get_alert` → `{ recentEvents: last 3 of GET /timeline, users }`
    - writes and `get_action_request` → a `{ kind: 'request', detail, users, requestUrl: actionRequestUrl(base, id), canDecide: !!deps.decisionApi }` view, or `{ kind: 'applied', url, summary }` when the write applied immediately.
  - The decision tools are registered when `deps.decisionApi` is set.
  - When the mode is off, nothing in this list happens.
- Decision tools: input `{ requestId: z.string().min(1) }` and `{ requestId, reason: z.string().max(1000).optional() }`. Annotations: `title`, `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false`, `openWorldHint: false`. `_meta: { ui: { resourceUri: RESOURCE_URIS.actionRequest, visibility: ['app'] } }`. Each calls `decisionApi.POST('/api/action-requests/{id}/approve' | '/reject')`. It returns `ok(text, { request, url, approveUrl })` in the same shape as `get_action_request`, plus the request view. Text: `Approved {id} in Cowork.` / `Rejected {id} in Cowork.` Errors go through the existing `safe()`.

- [ ] **Step 1: Write failing tests** in `ui.test.ts`. Use `uiDir` = fixtures, `decisionApi` built with `agentToken: COWORK_TOKEN` from the server test helpers, and a backend made by `makeApp()` (which now knows the Cowork token). Use two clients: `uiClient` (with the extension capability from Task 4) and `plainClient`.
  - `a UI client sees the three resources with the MCP App MIME type`: `listResources` → the three URIs. `readResource` → `mimeType === 'text/html;profile=mcp-app'`, and the text equals the fixture.
  - `a UI client sees resourceUri on the five view tools and the decision tools as app-only`: per the mapping. Both decision tools have `_meta.ui.visibility` equal to `['app']`.
  - `a plain client sees the phase 1 surface exactly`: 8 tools, no `_meta.ui` on any, `listResources` empty or unsupported, and `search_alerts` text identical to `uiClient`'s.
  - `view payload stays out of the text`: `get_alert ALT-1042` via `uiClient` has `_meta['alerts/view'].recentEvents.length <= 3` and `users.length === 6`, and its text equals the `plainClient` text.
  - `approve_action_request approves as the human in Cowork`: queue via `acknowledge_alert`, then `approve_action_request`. `structuredContent.request.status === 'approved'` and `decidedIn === 'cowork'`. The backend alert ALT-1042 is `in_progress`.
  - `reject_action_request records the reason`, and `a reason over 1000 chars is a validation error`.
  - `approving twice is a tool error naming the conflict`: the second call has `isError: true`, and the text contains `already_decided`.
  - `with approval off, a write renders the applied view`: `_meta['alerts/view'].kind === 'applied'`.
  - `without built views, a UI client gets no resources and no decision tools`: `uiDir` set to an empty temp dir. A UI client sees 8 tools and no `_meta.ui`, and the server does not throw.
  - `without COWORK_TOKEN, the request view has canDecide false and no decision tools`.
  - In `env.test.ts`: `COWORK_TOKEN` read when set, undefined when empty.
- [ ] **Step 2: Run** `pnpm vitest run apps/mcp-server`. Expected: FAIL (no resources, no decision tools).
- [ ] **Step 3: Implement** per Interfaces. Keep `tools.ts` to the phase 1 tools plus the `_meta` hooks. Put the new code in `ui.ts`.
- [ ] **Step 4: Run** `pnpm vitest run apps/mcp-server && pnpm typecheck && pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(mcp): ui:// views, view payload in _meta, app-only decision tools`.

### Task 6: `apps/mcp-ui`: the three views

**Files:**
- Create: `apps/mcp-ui/package.json` (`@app/mcp-ui`; deps `@app/domain`, `@app/ui`, `@modelcontextprotocol/ext-apps` `1.7.5`, `@modelcontextprotocol/sdk` (same range as mcp-server), `react`, `react-dom`; dev `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `tailwindcss`, `vite-plugin-singlefile` `2.3.4`, testing-library + jsdom as in `packages/ui`), `tsconfig.json` (references domain, ui), `vite.config.ts`, `vitest.config.ts` (jsdom, `src/**/*.test.tsx`), `scripts/build.ts`
- Create: `apps/mcp-ui/src/bridge.ts`, `src/useView.ts`, `src/views/{AlertListView,AlertCardView,ActionRequestView}.tsx`, `src/entries/{alert-list,alert-card,action-request}.html` + matching `.tsx` mounts, `src/index.css` (`@import '@app/ui/styles.css';`)
- Test: `apps/mcp-ui/src/views/*.test.tsx`
- Modify: root `tsconfig.json` (add reference), root `package.json` (`"build:ui": "pnpm --filter @app/mcp-ui build"`; `dev` runs `build:ui` once before `concurrently`)

**Interfaces:**
- Consumes: view payload types, `VIEW_META_KEY`, `DECISION_SURFACE_LABELS` (Task 1); `ActionRequestCard` link/decision props, `AlertTable.renderRowAction` (Task 3); tool names and result shapes (Task 5).
- Produces `bridge.ts`:
  ```ts
  export interface ViewBridge {
    callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult>;
    openLink(url: string): Promise<void>;
    /** false when the host refuses */
    sendMessage(text: string): Promise<boolean>;
    updateModelContext(text: string): Promise<void>;
  }
  export function bridgeFromApp(app: App): ViewBridge;
  ```
  `sendMessage` sends `{ role: 'user', content: [{ type: 'text', text }] }` and resolves `false` on rejection or `isError`. `updateModelContext` sends the line as text content.
- Produces `useView.ts`: `useToolResult(app): CallToolResult | undefined` (latest from `ontoolresult`, replaceable by refresh results) and `useVisiblePolling(fn, ms, enabled)` (interval only while `document.visibilityState === 'visible'`; runs `fn` once on becoming visible).
- Each mount: `useApp({ appInfo: { name: 'alerts-<view>', version: '0.1.0' }, capabilities: {} })`; toggle `.dark` on `<html>` from host context `theme` (initial + `onhostcontextchanged`); `useAutoResize`.
- Views take `{ result: CallToolResult; bridge: ViewBridge }` so tests pass a fake bridge:
  - **`AlertListView`**: `AlertTable` over `structuredContent.items`. Sorting is client-side over those items, reusing the `AlertSort` values. `renderRowAction` is a button `Investigate` → `bridge.sendMessage('Investigate ' + id)`, falling back to `bridge.openLink(item.url)` when it returns false. A footer reads `Showing {items.length} of {total}`, plus `Open in app` → `openLink(listUrl)` when present. Alert links → `openLink(item.url)`.
  - **`AlertCardView`**: `AlertSummaryCard` with `renderLink` → a button calling `openLink(url)`. It refreshes with `callTool('get_alert', { alertId })` via `useVisiblePolling(…, 5000, true)`.
  - **`ActionRequestView`**: `kind: 'applied'` → the text `Applied immediately (approval is off for this user)` plus `Open in app`. `kind: 'request'` → `ActionRequestCard` with:
    - `onApprove`/`onReject` only when pending and `canDecide`;
    - `link` = `Review in app` when pending and not `canDecide`, else `Open in app`;
    - `decidedByName` from users;
    - `busy` while a decision is in flight.
    - **On decide:** call the tool. On success, replace the result and call `updateModelContext` with the Global Constraints line. On `isError`, show `role="alert"`: `Already decided in the app` when the text contains `already_decided`, else the error text. Then call `get_action_request` and replace the result.
    - It polls `get_action_request` every 3000 ms while pending.

- [ ] **Step 1: Write failing tests** (React Testing Library, fake bridge with `vi.fn()`, fake timers where needed):
  - `the list shows the items and Investigate sends the prompt`: `sendMessage` called with `Investigate ALT-1042`.
  - `Investigate falls back to opening the alert when the host refuses`.
  - `the alert card opens the app through the bridge`.
  - `a pending request with canDecide shows Approve and Reject; without it shows Review in app`.
  - `approve calls the tool, shows the decision and tells Claude`: after Approve, text `Approved by Priya Shah in Cowork`, and `updateModelContext` called with `The user approved request AR-0001 (Acknowledge ALT-1042) in Cowork.` (use the kind label from `ACTION_REQUEST_KIND_LABELS`).
  - `reject sends the reason`: `callTool('reject_action_request', { requestId, reason: 'Not yet' })`, and the model context ends with `Reason: Not yet`.
  - `approve after an app decision shows the conflict and the real status` (Review Focus 1).
  - `approve is sent once on a double click` (Review Focus 2).
  - `polling stops after a decision and pauses while hidden` (Review Focus 5).
  - `the applied view shows Applied immediately`.
- [ ] **Step 2: Run** `pnpm vitest run apps/mcp-ui`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** per Interfaces. `scripts/build.ts` runs `vite build` three times with `VIEW=<name>` (singlefile inlines dynamic imports, which Rollup forbids with multiple inputs), `outDir: dist`, `emptyOutDir` only on the first run. Each output is flattened to `dist/<name>.html`.
- [ ] **Step 4: Run** `pnpm vitest run apps/mcp-ui && pnpm --filter @app/mcp-ui build && ls apps/mcp-ui/dist`. Expected: tests PASS, and exactly `alert-list.html alert-card.html action-request.html`. Then run `grep -L '<script src=\|<link rel="stylesheet" href=' apps/mcp-ui/dist/*.html | wc -l`. Expected: `3`, meaning no external script or stylesheet references. Then `pnpm typecheck && pnpm lint && pnpm vitest run packages/ui`. Expected: PASS (the guard test is still green).
- [ ] **Step 5: Commit** `feat(mcp-ui): alert list, alert card and request card views`.

### Task 7: Test host and end-to-end tests

**Files:**
- Create: `apps/mcp-ui/test-host/index.html`, `apps/mcp-ui/test-host/main.ts`, `apps/mcp-ui/test-host/vite.config.ts`, `apps/mcp-ui/playwright.config.ts`, `apps/mcp-ui/e2e/views.spec.ts`
- Modify: `apps/mcp-ui/package.json` (`"host": "vite --config test-host/vite.config.ts"`, `"e2e": "playwright test"`, devDep `@playwright/test` same range as web), root `package.json` (`"e2e": "pnpm --filter @app/web e2e && pnpm --filter @app/mcp-ui e2e"`)

**Interfaces:**
- Consumes: everything above.
- **Test host:**
  - **Server and connection.** A Vite dev server on 5174 proxies `/mcp` → `http://localhost:3002`. Same origin, so no CORS, and the Host/Origin checks see `localhost`. The page creates an SDK `Client` with the MCP Apps extension capability, connected through `StreamableHTTPClientTransport(new URL('/mcp', location.href))`.
  - **Driving a tool from the URL.** `?tool=<name>&args=<url-encoded JSON>&theme=light|dark` calls the tool, reads `_meta.ui.resourceUri` from `listTools`, then `readResource`. It renders the HTML in `<iframe sandbox="allow-scripts" srcdoc=…>` and connects `new AppBridge(client, { name: 'test-host', version: '0' }, { openLinks: {}, serverTools: {}, updateModelContext: { text: {} }, logging: {} })` via `PostMessageTransport`, then calls `sendToolResult(result)`.
  - **Recording what the view sends.** `onopenlink`, `onmessage` and `onupdatemodelcontext` append to `window.__hostLog: Array<{ type: 'openLink' | 'message' | 'modelContext'; value: string }>`. `onmessage` returns success.
  - **Theme.** `setHostContext({ theme })` before connecting.
- **Playwright** (`workers: 1`, `reuseExistingServer: false`) web servers:
  - backend 3001 (`AGENT_TOKEN=test-agent-token`, `COWORK_TOKEN=test-cowork-token`);
  - web 5173 (`pnpm --filter @app/web dev`);
  - `pnpm --filter @app/mcp-ui build` then the MCP server 3002 (`AGENT_TOKEN=test-agent-token`, `COWORK_TOKEN=test-cowork-token`, `ACTING_USER_ID=U-01`, `APP_BASE_URL=http://localhost:5173`, `API_BASE_URL=http://localhost:3001`);
  - the host 5174.
  - Each test starts with `POST http://localhost:3001/api/admin/reset`.

- [ ] **Step 1: Write failing tests** in `views.spec.ts` (locate inside the iframe with `page.frameLocator('iframe')`):
  - `the list renders the W1 alerts and Investigate asks Claude`: tool `search_alerts` with `{ status: ['open'], severity: ['high'], desk: ['eu-equities'] }` → the rows include ALT-1042. Clicking its `Investigate` adds `{ type: 'message', value: 'Investigate ALT-1042' }` to `__hostLog`.
  - `the alert card renders ALT-1042 and opens the app`: header text `Possible layering in SAP GY`. `Open in app` logs `openLink` with `http://localhost:5173/alerts/ALT-1042`.
  - `approve on the card is recorded as a Cowork decision`:
    1. `acknowledge_alert { alertId: 'ALT-1042', rationale: 'OTR 34:1 meets the threshold.' }`.
    2. Click `Approve` → text `Approved by Priya Shah in Cowork`.
    3. `__hostLog` has a `modelContext` entry starting `The user approved request`.
    4. A new page at `http://localhost:5173/alerts/ALT-1042?tab=timeline` shows `via Claude · approved by Priya Shah in Cowork`, and the status badge reads `In Progress`.
  - `reject with a reason`: `add_comment` → `Reject`, fill `Rejection reason` with `Not yet`, `Confirm reject` → `Rejected by Priya Shah in Cowork` and `Reason: Not yet`.
  - `a decision in the app flips the card`: render the pending request card. Approve via the API as a human (`X-User-Id: U-01`, no token). Within 5 s the card shows `Approved by Priya Shah in the app`.
  - `with approval off, the write shows Applied immediately`: `PUT /api/users/U-01/settings { requireApprovalForAgentActions: false }` as `U-01` first.
  - `a dark host renders the dark theme`: `theme=dark` → the iframe's `<html>` has class `dark`.
- [ ] **Step 2: Run** `pnpm --filter @app/mcp-ui e2e`. Expected: FAIL (no host yet).
- [ ] **Step 3: Implement** the host and config per Interfaces.
- [ ] **Step 4: Run** `pnpm --filter @app/mcp-ui e2e` and then `pnpm e2e` (both suites, sequentially). Expected: all PASS. Stop any dev server holding ports 3001/3002/5173/5174 first.
- [ ] **Step 5: Commit** `test(mcp-ui): test host and end-to-end coverage of the Cowork views`.

### Task 8: Skill, docs and the spike checklist

**Files:**
- Modify: `plugin/skills/investigate-alert/SKILL.md`, `docs/rehearsal-workflows.md`, `docs/spike-notes.md`, `README.md`, `docs/superpowers/specs/2026-11-17-alerts-demo-design.md` (§12: one line pointing to the phase 2 spec)

**Interfaces:**
- Consumes: the behaviour delivered in Tasks 2–7.

- [ ] **Step 1: Skill.**
  - **Ground rules:** writes are still requests. In Cowork the analyst may approve on the request card or in the app. Treat a context line "The user approved/rejected request …" as the decision. Otherwise call `get_action_request` before saying a change happened.
  - **Step 6:** say "approve on the card or in the app (link)".
  - Keep the skill under its current length plus ten lines.
- [ ] **Step 2: W6.** Rewrite W6 as the four-beat demo in spec §1, with no mention of Fluent. Its "Watch for" list:
  - the card must match the app;
  - Investigate needs host `sendMessage` support (otherwise it opens the app);
  - run `pnpm build:ui` before the MCP server.
- [ ] **Step 3: Spike notes.** Add a "Cowork: MCP Apps" section with the six checks from spec §7, each with a blank answer line, plus the decision rule: if check 3 fails, stop and revisit option C; if check 6 fails, move the payload to app-only read tools.
- [ ] **Step 4: README.** Add:
  - `apps/mcp-ui` to the layout;
  - `COWORK_TOKEN` to the env table, saying it lets the Cowork cards approve or reject only;
  - `pnpm build:ui`;
  - `pnpm --filter @app/mcp-ui host` (test host at http://localhost:5174, for example `?tool=get_alert&args={"alertId":"ALT-1042"}`) as the rehearsal fallback.
- [ ] **Step 5: Verify** `pnpm lint && pnpm typecheck && pnpm test`. Expected: PASS.
- [ ] **Step 6: Commit** `docs: phase 2 demo, skill and spike checklist for MCP Apps`.
