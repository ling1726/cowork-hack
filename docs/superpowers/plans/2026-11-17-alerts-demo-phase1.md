# Alerts Case Management Demo — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the standalone, deep-linkable alerts case management app (REST backend, React web app) plus an MCP server and Claude plugin that let Claude search and investigate alerts, act as the user, and submit writes into an in-app access queue for approval.

**Architecture:** A pnpm TypeScript monorepo. `@app/domain` holds Zod schemas, the state machine and the link builder. `apps/server` is a Hono + zod-openapi REST API over an in-memory, deterministically seeded store, with agent detection and an access queue. `@app/api-client` (openapi-fetch) is shared by `apps/web` (Vite, React, Fluent v9, TanStack Router/Query, Zustand) and `apps/mcp-server` (MCP SDK, Streamable HTTP). Presentational components live in `@app/ui` so phase 2 can reuse them in Cowork.

**Tech Stack:** Node ≥22 (dev on 25), pnpm 10+, TypeScript 6.0, zod 4, hono 4 + @hono/zod-openapi 1 + @hono/node-server, minisearch 7, @faker-js/faker 10, openapi-typescript 7 + openapi-fetch 0.17, React 19, @fluentui/react-components 9, @tanstack/react-router 1 + router-plugin, @tanstack/react-query 5, zustand 5, Vite 8, Vitest 5, @playwright/test 1.65, @modelcontextprotocol/sdk 1.32, oxlint (lint), oxfmt (format), tsx, concurrently.

**Spec:** `docs/superpowers/specs/2026-11-17-alerts-demo-design.md` (read it with this plan). Supporting: `docs/rehearsal-workflows.md`, `docs/why-mcp.md`.

## Global Constraints

- ESM only (`"type": "module"` everywhere). Strict TypeScript (`strict`, `noUncheckedIndexedAccess`). TS 6.0, not 7.
- Internal packages export TypeScript source (`"exports": { ".": "./src/index.ts" }`). There's no build step for packages. Vite, Vitest and tsx consume source, and `tsc -b` is used only for typechecking.
- Ports: server **3001**, web **5173** (Vite proxies `/api` → 3001), MCP **3002** at path **`/mcp`**.
- Env: server `PORT`, `SEED`, `AGENT_TOKEN`. MCP `API_BASE_URL`, `APP_BASE_URL`, `ACTING_USER_ID`, `AGENT_TOKEN`. Dev defaults go in `.env.example`: `AGENT_TOKEN=dev-agent-token`, `ACTING_USER_ID=U-01`, `SEED=1042`.
- IDs: alerts `ALT-####`, users `U-##`, action requests `AR-####`, timeline events `EV-#####`, links `LNK-####`, attachments `ATT-####`.
- Error body: `{ error: { code, message, details? } }`. Status codes: 400 validation, 403 forbidden for agent, 404, 409 illegal transition / already decided, 413 attachment over 5 MB.
- Agent detection only via `Authorization: Bearer <AGENT_TOKEN>`. No header claims `via`.
- URL arrays are **comma-separated** (`status=open,in_progress`) in both web URLs and API queries. Desk values are slugs (`eu-equities`).
- UI copy, exact: "via Claude", "approved by {name}", "Require approval for Claude's actions", "Open in app", queue nav label "Queue".
- Determinism: all seed timestamps derive from an injected `now`. Faker uses a fixed seed (`SEED`, default 1042).
- Every Playwright test calls `POST /api/admin/reset` first. No test depends on another.

## Review Focus

1. **Free text with odd input** (`q` of whitespace only, `"`, `(`, `*`, an emoji, or 500 chars). Whitespace-only is treated as absent, and nothing throws. Pinned in Task 7.
2. **Bad deep links** (`/alerts?status=bogus&page=0`, `/alerts/ALT-9999`, `/queue/AR-9999`). Invalid params fall back to their defaults without crashing, and an unknown ID shows a "not found" state with a link back. Pinned in Tasks 13, 14 and 16.
3. **Stale persisted user.** The Zustand-persisted `currentUserId` may not exist after a reset or a seed change. Fall back to `U-01` and don't send a bad `X-User-Id`. Pinned in Task 12.
4. **Double decisions** (approve twice, approve after reject, reject after approve). The second attempt returns 409 `already_decided` and changes nothing. Pinned in Task 9.
5. **Agent work appears without a reload.** When Claude submits a request while the app is open, the queue badge and the alert banner update within the polling interval. Pinned in Task 16.

---

## File Map

```
package.json, pnpm-workspace.yaml, tsconfig.base.json, tsconfig.json (references), .oxlintrc.json, .oxfmtrc.json, vitest.workspace.ts, .env.example, .gitignore, README.md
packages/domain/src/{index,enums,schemas,search-params,state-machine,links}.ts   test/*.test.ts
packages/api-client/src/{index,schema.d.ts}                                     test/client.test.ts
packages/ui/src/{index.ts, components/*.tsx}                                    test/*.test.tsx
apps/server/src/{main,app,context,errors,env}.ts
apps/server/src/store/{store,search}.ts
apps/server/src/seed/{index,users,rules,story,background,placeholder-files}.ts
apps/server/src/services/{commands,agent-gate}.ts
apps/server/src/routes/{users,meta,admin,alerts-read,alerts-write,attachments,action-requests,settings}.ts
apps/server/scripts/dump-openapi.ts                                              test/*.test.ts, test/helpers.ts
apps/web/{index.html,vite.config.ts,playwright.config.ts}
apps/web/src/{main.tsx, api.ts, store/ui-store.ts, router.tsx, routes/*, components/*}
apps/web/e2e/*.spec.ts
apps/mcp-server/src/{main,server,tools,format,env}.ts                             test/tools.test.ts
plugin/.claude-plugin/plugin.json, plugin/.mcp.json, plugin/skills/investigate-alert/SKILL.md
spikes/mcp-hello/ (throwaway), docs/spike-notes.md
```

---

### Task 1: Spike — check Cowork and Claude Code can reach a local MCP server (manual, throwaway)

Spec §14. This gates Task 17's transport and plugin choices. **It needs the user at the keyboard** for the Cowork part.

**Files:**
- Create: `spikes/mcp-hello/{package.json,server.ts}` (throwaway; deleted in Task 18), `docs/spike-notes.md`

- [ ] **Step 1:** Write `spikes/mcp-hello/server.ts`. It's a Streamable HTTP MCP server on `:3002/mcp` (stateless) with a read-only tool `hello` that returns `Open http://localhost:5173/alerts/ALT-1042` and a non-read-only tool `poke` (no destructive hint). Use whichever transport the installed SDK offers (see Task 17 Step 1). Run it with `npx tsx server.ts`.
- [ ] **Step 2:** Run `claude mcp add --transport http alerts-spike http://localhost:3002/mcp`. In Claude Code, ask "call the hello tool". Expected: the link is printed and Cmd-click opens it.
- [ ] **Step 3: Ask the user** to add the same URL as a connector in Cowork and run "call hello", then "call poke". Record in `docs/spike-notes.md`:
  - (a) whether localhost was reachable;
  - (b) the exact steps to add the connector or plugin in Cowork;
  - (c) whether Cowork prompted before `poke`;
  - (d) whether the link was clickable.
- [ ] **Step 4:** If (a) fails, stop and bring the options (a tunnel such as `cloudflared tunnel --url http://localhost:3002`, or another option) to the user before Task 17. Otherwise continue.
- [ ] **Step 5: Commit**: `git add spikes docs/spike-notes.md && git commit -m "spike: verify local MCP reachability from Cowork and Claude Code"`

---

### Task 2: Monorepo scaffold and domain schemas

**Files:**
- Create: root `package.json`, `pnpm-workspace.yaml` (`packages/*`, `apps/*`), `tsconfig.base.json`, `tsconfig.json`, `.oxlintrc.json`, `.oxfmtrc.json`, `vitest.workspace.ts`, `.gitignore` (node_modules, dist, test-results, playwright-report, .env), `.env.example`
- Create: `packages/domain/{package.json,tsconfig.json}`, `src/enums.ts`, `src/schemas.ts`, `src/index.ts`
- Test: `packages/domain/test/schemas.test.ts`

**Interfaces — Produces** (all exported from `@app/domain`):
- Enums as `z.enum` + TS type + `*_LABELS` record:
  - `AlertStatus` (`open | in_progress | closed`)
  - `Severity` (`low | medium | high | critical`, also with `SEVERITY_RANK` for sorting)
  - `Category` (the 8 values in spec §6)
  - `Desk` (`eu-equities | us-equities | us-rates | fx | commodities | credit`)
  - `UserRole`
  - `ResolutionOutcome`
  - `ActionRequestKind` (`add_comment | acknowledge`)
  - `ActionRequestStatus`
  - `Via` (`app | claude`)
  - `AlertTab` (`overview | timeline | materials | data`)
  - `AlertSort` (`createdAt | -createdAt | updatedAt | -updatedAt | severity | -severity`)
- Schemas + types, field-for-field from spec §6:
  - `UserSchema`
  - `RuleSchema` (with `indicators`)
  - `AlertSchema`
  - `AlertSummarySchema` (`id,title,status,severity,category,desk,trader,instrument,rule:{id,name},assignees,createdAt,updatedAt`)
  - `TimelineEventSchema` (discriminated union on `type`, common fields `id, alertId, at, actorId, via, actionRequestId?, approvedBy?`)
  - `ActionRequestSchema` (with `payload` as a union keyed by `kind`: `add_comment → {body}`, `acknowledge → {}`)
  - `UserSettingsSchema`
  - `AllowedAction` (`acknowledge | close | reopen | escalate | comment | edit_assignees | add_link | add_attachment`)
- Command bodies:
  - `CommentBody {body: string 1..5000}`
  - `CloseBody {outcome, note 1..2000}`
  - `ReopenBody {reason 1..2000}`
  - `EscalateBody {toUserId, reason 1..2000}`
  - `AssigneesBody {primaryId, backupId}` (must differ)
  - `LinkBody {title 1..200, url: http(s) URL}`
  - `AgentRationale {rationale 1..1000}`
- Timestamps are ISO strings (`z.iso.datetime()`).

- [ ] **Step 1: Scaffold the root.**
  - Root scripts:
    - `dev` = `concurrently -n server,web,mcp "pnpm --filter @app/server dev" "pnpm --filter @app/web dev" "pnpm --filter @app/mcp-server dev"`
    - `test` = `vitest run`
    - `typecheck` = `tsc -b`
    - `lint` = `oxlint && oxfmt --check`
    - `format` = `oxfmt`
    - `e2e` = `pnpm --filter @app/web e2e`
  - Set `"packageManager": "pnpm@<current>"` and `"engines": {"node": ">=22"}`.
  - Add `oxlint` and `oxfmt` as root devDependencies. Configure `.oxlintrc.json` (TypeScript and React plugins, `correctness` as errors) and `.oxfmtrc.json`. Ignore generated files in both (`packages/api-client/src/schema.d.ts`, `packages/api-client/src/openapi.json`, `dist`, `test-results`, `playwright-report`).
  - Run `corepack enable && pnpm install`.
- [ ] **Step 2: Write the failing test** `packages/domain/test/schemas.test.ts`:

```ts
it('AlertSchema parses a minimal valid alert and rejects bad status', () => {
  expect(AlertSchema.parse(fixtureAlert()).id).toBe('ALT-1042');
  expect(() => AlertSchema.parse({ ...fixtureAlert(), status: 'done' })).toThrow();
});
it('TimelineEventSchema discriminates on type', () => {
  const e = TimelineEventSchema.parse({ id: 'EV-00001', alertId: 'ALT-1042', at: '2026-11-17T09:00:00.000Z', actorId: 'U-01', via: 'claude', type: 'comment', body: 'x' });
  expect(e.type === 'comment' && e.body).toBe('x');
});
it('AssigneesBody rejects identical primary and backup', () => {
  expect(AssigneesBody.safeParse({ primaryId: 'U-01', backupId: 'U-01' }).success).toBe(false);
});
it('LinkBody rejects non-http urls', () => {
  expect(LinkBody.safeParse({ title: 'x', url: 'javascript:alert(1)' }).success).toBe(false);
});
```
  (`fixtureAlert()` lives in `packages/domain/test/fixtures.ts`. It's a full ALT-1042-shaped object reused by later domain tests.)
- [ ] **Step 3:** Run `pnpm vitest run packages/domain`. Expected: FAIL (modules missing).
- [ ] **Step 4:** Implement `enums.ts` and `schemas.ts` per the Interfaces above. Export everything from `index.ts`.
- [ ] **Step 5:** Run `pnpm vitest run packages/domain && pnpm typecheck && pnpm lint`. Expected: PASS.
- [ ] **Step 6: Commit**: `git commit -am "feat(domain): scaffold monorepo and domain schemas"` (add new files first).

---

### Task 3: Domain state machine

**Files:**
- Create: `packages/domain/src/state-machine.ts`
- Test: `packages/domain/test/state-machine.test.ts`

**Interfaces — Produces:**
- `type Transition = { kind: 'acknowledge' } | { kind: 'close'; outcome; note } | { kind: 'reopen'; reason } | { kind: 'escalate'; toUserId; reason }`
- `checkTransition(alert: Pick<Alert,'status'|'assignees'>, t: Transition): { ok: true; nextStatus: AlertStatus } | { ok: false; code: 'illegal_transition' | 'already_escalated'; message: string }`
- `allowedActions(alert: Pick<Alert,'status'>): AllowedAction[]`. The order is stable: lifecycle actions first, then `escalate`, `comment`, `edit_assignees`, `add_link`, `add_attachment`.

- [ ] **Step 1: Write failing tests.** Make them table-driven over every (status × transition) pair in spec §6:

```ts
it.each([
  ['open', 'acknowledge', true, 'in_progress'], ['in_progress', 'acknowledge', false], ['closed', 'acknowledge', false],
  ['in_progress', 'close', true, 'closed'], ['open', 'close', false], ['closed', 'close', false],
  ['closed', 'reopen', true, 'open'], ['open', 'reopen', false], ['in_progress', 'reopen', false],
  ['open', 'escalate', true, 'open'], ['in_progress', 'escalate', true, 'in_progress'], ['closed', 'escalate', false],
])('%s + %s → ok=%s', (status, kind, ok, next) => { /* build transition, assert ok and nextStatus */ });
it('escalating to an already-escalated user is already_escalated', ...);
it('allowedActions(open) = [acknowledge, escalate, comment, edit_assignees, add_link, add_attachment]', ...);
it('allowedActions(closed) = [reopen, comment, edit_assignees, add_link, add_attachment]', ...);
```
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement as a lookup table. There's no library.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(domain): alert state machine and allowedActions`

---

### Task 4: Search-param codec and link builder

The spec's deep-link contract (§6, §8) depends on this task.

**Files:**
- Create: `packages/domain/src/search-params.ts`, `packages/domain/src/links.ts`
- Test: `packages/domain/test/links.test.ts`

**Interfaces — Produces:**
- `AlertListSearchSchema`: optional `status: AlertStatus[]`, `severity: Severity[]`, `category: Category[]`, `desk: Desk[]`, `assigneeId`, `traderId`, `instrument`, `from`, `to` (ISO date `YYYY-MM-DD`), `q`, `sort: AlertSort`, `page` (int ≥1).
  - Invalid values are **dropped** (each field uses `.catch(undefined)`), so a bad link degrades instead of throwing.
  - `q` is trimmed, and becomes undefined if empty.
- `AlertListQuerySchema` (API) = `AlertListSearchSchema` + `updatedFrom`, `updatedTo` (ISO datetime), `involvedUserId`, `pageSize` (1..100, default 25). This schema rejects invalid values (400) instead of dropping them.
- `AlertDetailSearchSchema`: `{ tab: AlertTab (catch 'overview'), dataTab?: string }`.
- `QueueSearchSchema`: `{ status: ActionRequestStatus (catch 'pending') }`.
- `fromSearchParams(params: URLSearchParams, schema): T`. It splits array fields on `,`, then parses.
- `toSearchParams(search: object, schema): URLSearchParams`. It omits undefined, empty arrays and default values, joins arrays with `,`, and emits keys **in schema key order** so the output is canonical.
- `alertListUrl(base: string, search: AlertListSearch): string`
- `alertUrl(base: string, id: string, search?: Partial<AlertDetailSearch>): string`
- `queueUrl(base: string, search?: Partial<QueueSearch>): string`
- `actionRequestUrl(base: string, id: string): string` → `${base}/queue/${id}`

- [ ] **Step 1: Write failing tests:**

```ts
const B = 'http://localhost:5173';
it('builds the W1 link exactly', () => {
  expect(alertListUrl(B, { status: ['open'], severity: ['high'], desk: ['eu-equities'], q: 'layering' }))
    .toBe(`${B}/alerts?status=open&severity=high&desk=eu-equities&q=layering`);
});
it('round-trips: parse(build(x)) deep-equals x', () => {
  const x = { status: ['open', 'in_progress'], category: ['wash_trade'], traderId: 'T-0412', sort: '-severity', page: 2 } as const;
  const url = new URL(alertListUrl(B, x));
  expect(fromSearchParams(url.searchParams, AlertListSearchSchema)).toEqual(x);
});
it('drops invalid list params instead of throwing', () => {
  expect(fromSearchParams(new URLSearchParams('status=bogus,open&page=0&q=%20%20'), AlertListSearchSchema)).toEqual({ status: ['open'] });
});
it('alertUrl omits the default tab', () => {
  expect(alertUrl(B, 'ALT-1042')).toBe(`${B}/alerts/ALT-1042`);
  expect(alertUrl(B, 'ALT-1042', { tab: 'data', dataTab: 'orders' })).toBe(`${B}/alerts/ALT-1042?tab=data&dataTab=orders`);
});
it('actionRequestUrl', () => expect(actionRequestUrl(B, 'AR-0001')).toBe(`${B}/queue/AR-0001`));
```
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Array-element filtering for `status=bogus,open` means each array field is `z.array(z.string()).transform(keep valid enum members)`, and is undefined if the result is empty.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(domain): canonical search-param codec and deep-link builder`

---

### Task 5: Server store and deterministic seed

**Files:**
- Create: `apps/server/{package.json,tsconfig.json}`
- Create: `src/store/store.ts`, `src/store/search.ts`
- Create: `src/seed/{index,users,rules,story,background,placeholder-files}.ts`
- Test: `apps/server/test/seed.test.ts`, `apps/server/test/helpers.ts`

**Interfaces — Produces:**
- `buildSeed(opts: { now: Date; seed: number }): SeedData`, where `SeedData = { users: User[]; alerts: Alert[]; timeline: TimelineEvent[]; attachments: Array<{ meta; bytes: Uint8Array }> }`
- `class Store` (constructed with `SeedData` and `now: () => Date`):
  - `users`, `alerts`, `timeline` (Map alertId → events[]), `attachments`, `actionRequests`, `settings` (Map userId → UserSettings)
  - ID generators `nextId(prefix: 'EV'|'AR'|'LNK'|'ATT'): string`
  - `getAlert(id)`, `saveAlert(alert)` (bumps `updatedAt` and reindexes)
  - `appendEvent(e: Omit<TimelineEvent,'id'|'at'>): TimelineEvent`
  - `settingsFor(userId): UserSettings` (default `{ requireApprovalForAgentActions: true }`)
  - `reset(seed: SeedData)`
- `class AlertSearchIndex` (MiniSearch):
  - fields `title, summary, description, traderName, instrument, ruleName, comments`
  - `{ prefix: true, fuzzy: 0.2 }`
  - `search(q): Map<alertId, score>`, `upsert(alert, comments)`
- Test helper `T0 = new Date('2026-11-17T09:00:00.000Z')`.

**Seed contents.** These values are pinned for the rehearsal workflows. Times are relative to `now`.

| Record | Values |
| --- | --- |
| Users | U-01 Priya Shah, analyst, eu-equities (**acting/default user**) · U-02 Tom Becker, analyst, us-rates · U-03 Mei Lin, senior_analyst · U-04 Daniel Okafor, compliance_lead · U-05 Sarah Klein, cco · U-06 Raj Patel, analyst, fx |
| Rule MAR-12-1a "Layering / spoofing", EU MAR Art. 12(2)(c) | indicators: `otr` "Order-to-trade ratio" `> 20:1` · `fast_cancel` "Share of orders cancelled within 500 ms of an opposite-side fill" `> 60%` · `book_imbalance` "Resting size on one side as share of displayed depth" `> 80%` |
| ALT-1042 | spoofing_layering, **open**, high, eu-equities, trader T-0412 James Whitfield, instrument `SAP GY` SAP SE equity. Created now−2h. Primary U-01, backup U-03. Highlights: OTR **34:1** (danger), Fast cancels **72%** (danger), Book imbalance **64%** (neutral), Notional €18.4m. Data tabs `orders` (≥12 rows: time, side, price, qty, status, cancelLatencyMs) and `executions`. Description mentions "layering". 1 link, 1 attachment (`order-blotter.csv`). |
| T-0412 history | ALT-0911 spoofing_layering, closed false_positive by U-02, created now−49d. ALT-0958 wash_trade (rule MAR-12-1b "Wash trades"), closed false_positive by U-06, now−28d. ALT-1013 wash_trade, **in_progress**, now−14d, primary U-01 backup U-02. Each closure has a closing comment. |
| W4 pair | ALT-0987 restricted_list (rule RL-01 "Restricted list breach", firm policy + MAR Art. 14), instrument `NVLX` Novalux Pharma, trader T-0733 Elena Rossi, deal team "Project Kestrel". Closed by U-03 now−21d, note "Name added to restricted list after trade; timing benign". ALT-1051 restricted_list, open, high, same instrument, created now−1h. Data tab `trades` shows a trade at now−22d 14:05 and `restrictedListEntry` at now−22d 16:30, by a Project Kestrel member. |
| W1 set | Open + high + eu-equities: ALT-1042 and ALT-1047 (spoofing_layering, text mentions "layering"), plus ALT-1049 (marking_the_close, no "layering"). Background alerts never contain the word "layering" and never have desk eu-equities + severity high + status open. |
| W5 activity | U-01 comment on ALT-1013 at now−3h. U-01 acknowledged ALT-1033 (best_execution, open→in_progress) at now−2h. U-01 closed ALT-1029 (late_reporting) false_positive at now−1h. |
| Background | 45 alerts, IDs from ALT-0900 upward, skipping story IDs. Faker uses `seed`. They spread over now−90d..now, across all categories, desks and statuses, with realistic summaries. |

- [ ] **Step 1: Write failing tests** `seed.test.ts`:

```ts
const s = buildSeed({ now: T0, seed: 1042 });
it('is deterministic', () => expect(buildSeed({ now: T0, seed: 1042 })).toEqual(s));
it('every alert, event and user parses with domain schemas', ...);
it('has 6 users covering all 4 roles', ...);
it('ALT-1042 is open, high, eu-equities, T-0412, meets exactly 2 of 3 indicators via highlights', ...);
it('T-0412 has exactly 4 alerts within 49 days across 2 rules, 2 closed false_positive by different users', ...);
it('ALT-0987 closed with the benign note; ALT-1051 trade precedes restricted list entry', ...);
it('W1: exactly 3 open/high/eu-equities alerts; exactly 2 mention "layering"', ...);
it('W5: U-01 has 3 timeline events after now−24h', ...);
it('every timestamp is <= now', ...);
```
- [ ] **Step 2:** Run `pnpm vitest run apps/server`. Expected: FAIL.
- [ ] **Step 3:** Implement the seed modules, then `Store` and `AlertSearchIndex`. Generate placeholder attachment bytes: CSV/TXT as text, and PDF as a minimal valid one-page PDF built from a constant string.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(server): in-memory store and deterministic seed with story records`

---

### Task 6: Server app shell — identity, agent detection, errors, users/meta/admin/openapi

**Files:**
- Create: `apps/server/src/{app,context,errors,env,main}.ts`, `src/routes/{users,meta,admin}.ts`
- Test: `apps/server/test/app-shell.test.ts`

**Interfaces — Produces:**
- `createApp(opts: { store: Store; agentToken: string; now?: () => Date; seed?: number }): OpenAPIHono<Env>`. Routes are mounted under `/api`.
- Hono `Env.Variables`: `{ ctx: { userId?: string; via: Via; isAgent: boolean } }`.
- `requireUser(c)`: returns the userId or throws `ApiError(400,'missing_user')` / `ApiError(400,'unknown_user')`.
- `forbidAgent(c)`: throws `ApiError(403,'agent_forbidden')`.
- `class ApiError(status, code, message, details?)`, plus the `app.onError` mapping to the error body. The zod-openapi `defaultHook` maps validation failures to 400 `validation_error`.
- `GET /api/users`, `GET /api/meta` (enums with labels, desks, rules, traders), `POST /api/admin/reset` (rebuilds the seed with the current `now()`), `GET /api/openapi.json` (OpenAPI 3.1).
- `main.ts`: reads env (default `PORT=3001`, `SEED=1042`, `AGENT_TOKEN` required, failing fast if missing) and serves with `@hono/node-server`. `dev` script = `tsx watch src/main.ts`.
- Test helpers in `test/helpers.ts`: `makeApp()`, `asUser(id) → headers`, `asAgent(id) → headers` (adds `Authorization: Bearer test-agent-token`).

- [ ] **Step 1: Write failing tests:**

```ts
it('no token → via app; valid token → via claude; wrong token → via app', ...); // via a test-only echo route registered in the test, or GET /api/users plus a context spy
it('X-Via header is ignored', ...);
it('GET /api/users returns 6 users', ...);
it('GET /api/openapi.json is OpenAPI 3.1 with /api/alerts paths later', ...); // here: has openapi === '3.1.0'
it('POST /api/admin/reset restores seeded state', ...);
it('unknown route → 404 error body shape', ...);
```
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Compare tokens with a constant-time compare (`crypto.timingSafeEqual` on equal-length buffers).
- [ ] **Step 4:** Run. Expected: PASS. Then start it for real with `AGENT_TOKEN=x pnpm --filter @app/server dev` and run `curl localhost:3001/api/users`. Expected: JSON with 6 users.
- [ ] **Step 5: Commit**: `feat(server): app shell with agent detection, errors, users/meta/admin`

---

### Task 7: Alert read routes — list/search, detail, timeline, related

**Files:**
- Create: `apps/server/src/routes/alerts-read.ts`
- Test: `apps/server/test/alerts-read.test.ts`

**Interfaces — Produces:**
- `GET /api/alerts` (query `AlertListQuerySchema`) → `{ items: AlertSummary[]; total; page; pageSize }`.
  - Default sort is `-createdAt`, or relevance when `q` is present and `sort` is absent.
  - `involvedUserId` matches primary, backup, escalatedTo, or any timeline actor.
- `GET /api/alerts/{id}` → `Alert & { allowedActions: AllowedAction[]; pendingActionRequestIds: string[] }`.
- `GET /api/alerts/{id}/timeline` → `TimelineEvent[]`, oldest first.
- `GET /api/alerts/{id}/related?days=90` → `Array<{ alert: AlertSummary; matchedOn: Array<'trader'|'instrument'|'rule'>; resolution?: Resolution }>`. It excludes the alert itself and sorts by `createdAt` descending.

- [ ] **Step 1: Write failing tests:**

```ts
it('W1 filters: status=open&severity=high&desk=eu-equities → 3; plus q=layering → ALT-1042, ALT-1047', ...);
it('comma arrays: status=open,in_progress excludes closed', ...);
it('traderId=T-0412 → 4 alerts', ...);
it('involvedUserId=U-01&updatedFrom=<T0−24h> includes ALT-1013, ALT-1033, ALT-1029', ...);
it('q matches comment bodies (search "benign" finds ALT-0987)', ...);
it.each(['   ', '"', '(', '*', '🙂', 'x'.repeat(500)])('q=%j never errors (200)', ...);   // Review Focus 1
it('invalid status value → 400 validation_error', ...);
it('pageSize>100 → 400; paging returns stable slices', ...);
it('detail includes allowedActions; unknown id → 404 not_found', ...);
it('related for ALT-1042 lists ALT-0911, ALT-0958, ALT-1013 with matchedOn including trader', ...);
it('related for ALT-1051 lists ALT-0987 matchedOn instrument with resolution', ...);
```
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Use the structured filter first, then intersect with the MiniSearch results. Wrap the MiniSearch call so that query-syntax characters can't throw: search with plain terms and `combineWith: 'AND'`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(server): alert list/search, detail, timeline, related`

---

### Task 8: Human write routes via one command service

**Files:**
- Create: `apps/server/src/services/commands.ts`, `src/routes/alerts-write.ts`, `src/routes/attachments.ts`
- Test: `apps/server/test/alerts-write.test.ts`

**Interfaces — Produces:**
- `type Command = { kind:'add_comment'; body } | { kind:'acknowledge' } | { kind:'close'; outcome; note } | { kind:'reopen'; reason } | { kind:'escalate'; toUserId; reason } | { kind:'set_assignees'; primaryId; backupId } | { kind:'add_link'; title; url } | { kind:'add_attachment'; filename; mimeType; bytes }`
- `applyCommand(store: Store, alertId: string, cmd: Command, actor: { userId: string; via: Via; actionRequestId?: string; approvedBy?: string }): { alert: Alert; event: TimelineEvent }`. It throws `ApiError` 404, 409 (`illegal_transition` / `already_escalated`) or 400 (`unknown_user` for escalation or assignee targets).
  - This is the **single code path** for direct writes and for approved queue items (Task 9).
  - The `status_changed` event's `reason` = close note / reopen reason.
  - Close sets `resolution`, and reopen clears it.
  - Escalate appends to `assignees.escalatedTo`.
- Routes from spec §7: `POST comments | acknowledge | close | reopen | escalations`, `PUT assignees`, `POST links`, `POST attachments` (multipart field `file`, max 5 MB → 413 `too_large`), `GET /api/attachments/{id}/content` (sets the `Content-Type` and `Content-Disposition` filename).
  - Each returns `200 { alert, event }`.
  - Each requires `X-User-Id`.
  - In this task, agent requests get 403 on all of them. Task 9 replaces that for comments and acknowledge.

- [ ] **Step 1: Write failing tests:**

```ts
it('comment appends event with actorId U-01 via app', ...);
it('acknowledge open→in_progress; second acknowledge → 409 illegal_transition', ...);
it('close requires outcome+note (400 otherwise), sets resolution; reopen requires reason, clears it', ...);
it('escalate keeps status, adds to escalatedTo, records escalated event; repeat target → 409 already_escalated; closed → 409', ...);
it('assignees update; unknown user → 400; same primary/backup → 400', ...);
it('link added; attachment upload stored and downloadable with same bytes; 5MB+1 → 413', ...);
it('missing X-User-Id → 400 missing_user; unknown → 400 unknown_user', ...);
it('agent token on close/reopen/escalate/assignees/links/attachments → 403 agent_forbidden', ...);
it('writes update updatedAt and search index (new comment text becomes searchable)', ...);
```
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement `applyCommand` using `checkTransition` from Task 3, then implement the thin routes.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(server): alert write routes through a single command service`

---

### Task 9: Access queue — agent gate, action requests, settings

**Files:**
- Create: `apps/server/src/services/agent-gate.ts`, `src/routes/action-requests.ts`, `src/routes/settings.ts`
- Modify: `apps/server/src/routes/alerts-write.ts` (comments + acknowledge go through the gate)
- Test: `apps/server/test/access-queue.test.ts`

**Interfaces — Produces:**
- `submitOrApply(store, alertId, cmd: Extract<Command, {kind:'add_comment'|'acknowledge'}>, ctx, rationale?: string): { kind:'applied'; alert; event } | { kind:'queued'; actionRequest: ActionRequest }`
  - Human → apply.
  - Agent without `rationale` → 400.
  - Agent + setting off → apply with `via:'claude'`.
  - Agent + setting on → pre-check the transition (409 if illegal now), create `AR-####` pending, append an `action_requested` event (`via:'claude'`), and return queued.
- Agent bodies extend the human bodies with `AgentRationale` (comments: `{body, rationale}`, acknowledge: `{rationale}`). Humans may omit `rationale`.
- `POST /api/alerts/{id}/comments` and `/acknowledge` → 200 `{ alert, event }` or **202** `{ actionRequest }`.
- `GET /api/action-requests?status=&alertId=&onBehalfOf=` → `ActionRequest[]`, newest first. `status` uses the comma array.
- `GET /api/action-requests/{id}` → `ActionRequest & { alert: AlertSummary; resultEvent?: TimelineEvent }`.
- `POST /api/action-requests/{id}/approve`:
  - Human only (403 `agent_forbidden`), and only `onBehalfOf` (403 `not_owner`). Not pending → 409 `already_decided`.
  - Re-check: if illegal → status `failed` with `failure {code,message}` and return 200 with the request.
  - Else `applyCommand(..., { userId: onBehalfOf, via:'claude', actionRequestId, approvedBy: caller })` → `approved` with `resultEventId`.
- `POST /api/action-requests/{id}/reject` `{ reason? }`: the same guards. It appends an `action_rejected` event.
- `GET /api/users/{id}/settings`, `PUT /api/users/{id}/settings` (human only; caller must equal `{id}`).

- [ ] **Step 1: Write failing tests:**

```ts
it('agent comment with approval on → 202 pending AR, alert timeline unchanged except action_requested', ...);
it('agent without rationale → 400', ...);
it('approve applies comment as actorId U-01, via claude, approvedBy U-01, actionRequestId set', ...);
it('agent acknowledge on ALT-1042 queued; human acknowledges first; approve → request failed illegal_transition, alert unchanged', ...);
it('agent acknowledge on in_progress alert → 409 at submission', ...);
it('reject records action_rejected event with reason; request rejected', ...);
it.each([['approve','approve'],['reject','approve'],['approve','reject']])('%s then %s → second 409 already_decided', ...);  // Review Focus 4
it('agent token → 403 on approve, reject, PUT settings', ...);
it('other user approving → 403 not_owner', ...);
it('setting off → agent comment 200 applied immediately, via claude, no approvedBy', ...);
it('list filters by status and alertId; detail includes resultEvent after approval', ...);
it('alert detail pendingActionRequestIds reflects queue', ...);
```
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the whole server suite: `pnpm vitest run apps/server`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(server): access queue for agent writes with approval and settings`

---

### Task 10: Typed API client

**Files:**
- Create: `apps/server/scripts/dump-openapi.ts` (server script `openapi` = `tsx scripts/dump-openapi.ts ../../packages/api-client/src/openapi.json && openapi-typescript ../../packages/api-client/src/openapi.json -o ../../packages/api-client/src/schema.d.ts`)
- Create: `packages/api-client/{package.json,tsconfig.json}`, `src/index.ts`, generated `src/schema.d.ts` + `src/openapi.json` (committed)
- Test: `packages/api-client/test/client.test.ts`

**Interfaces — Produces:**
- `createApiClient(opts: { baseUrl: string; getUserId?: () => string | undefined; agentToken?: string; fetch?: typeof fetch }): ApiClient`
  - This is openapi-fetch `createClient<paths>` with `querySerializer: { array: { style: 'form', explode: false } }`.
  - A middleware sets `X-User-Id` (if any) and `Authorization: Bearer` (if `agentToken`).
- `type ApiClient`, re-exported `paths`, and component types.
- `unwrap<T>(r: { data?: T; error?: unknown; response: Response }): T`. It throws `ApiRequestError { status, code, message }` on error.

- [ ] **Step 1: Write the failing test.** Use an in-process server via `fetch: (req) => app.fetch(req)` with `makeApp()` from the server test helpers (import the path relatively, since the test-only dependency is allowed):

```ts
it('lists alerts with comma arrays', async () => { const r = unwrap(await api.GET('/api/alerts', { params: { query: { status: ['open','in_progress'] } } })); expect(r.items.every(a => a.status !== 'closed')).toBe(true); });
it('agent client gets 202 pending on comment', ...);
it('unwrap throws ApiRequestError with code on 409', ...);
it('schema.d.ts is up to date', () => { /* regenerate openapi.json in memory from createApp and deep-equal the committed src/openapi.json */ });
```
- [ ] **Step 2:** Run the tests. Expected: FAIL. Then run `pnpm --filter @app/server openapi`.
- [ ] **Step 3:** Implement `index.ts`.
- [ ] **Step 4:** Run `pnpm vitest run packages/api-client && pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(api-client): generated OpenAPI types and typed client`

---

### Task 11: Shared presentational UI package

**Files:**
- Create: `packages/ui/{package.json,tsconfig.json}`, `src/index.ts`
- Create: `src/components/{AlertStatusBadge,SeverityBadge,AlertHeader,AlertHighlights,AssigneesPanel,AlertTimeline,AlertSummaryCard,AlertTable,DataTabTable,ActionRequestCard,ViaClaudeTag}.tsx`
- Test: `packages/ui/test/components.test.tsx` (Vitest `environment: 'jsdom'` + `@testing-library/react`)

**Interfaces — Produces.** Props only. There are **no imports** of router, query or zustand, and an `import/no-restricted-paths`-style check in the test guards this (Step 1).
- `AlertStatusBadge({ status })`, `SeverityBadge({ severity })`, `ViaClaudeTag({ approvedByName? })`. The last renders "via Claude" and "· approved by {name}".
- `AlertHeader({ alert: AlertSummary; actions: AllowedAction[]; onAction(a: AllowedAction): void; pendingCount?: number })`. It shows lifecycle and escalate actions as buttons.
- `AlertHighlights({ highlights })`
- `AssigneesPanel({ assignees; users: User[]; onEdit?(): void })`
- `AlertTimeline({ events: TimelineEvent[]; users: User[]; renderLink?(href, label) })`
- `AlertSummaryCard({ alert; recentEvents; users; openInAppHref; renderLink? })`
- `AlertTable({ items: AlertSummary[]; sort?: AlertSort; onSortChange?(s); renderAlertLink(id, label): ReactNode })`. It uses Fluent `DataGrid`.
- `DataTabTable({ tab: DataTab })`. It formats by column `type` (currency in the tab's currency or EUR, datetime local).
- `ActionRequestCard({ request: ActionRequest; alert: AlertSummary; onApprove?(): void; onReject?(reason?: string): void; busy?: boolean; renderAlertLink })`. It shows kind, rationale, payload preview (the comment text verbatim) and status.

- [ ] **Step 1: Write failing tests:**

```ts
it('package source never imports @tanstack/* or zustand', () => { /* glob src/**, read files, assert no match */ });
it('AlertHeader renders Acknowledge for open and calls onAction("acknowledge")', ...);
it('ActionRequestCard shows rationale and exact comment body; Approve/Reject call callbacks; hides buttons when not pending', ...);
it('AlertTimeline marks claude events with "via Claude" and "approved by Priya Shah"', ...);
```
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement with Fluent v9 primitives (`Badge`, `Button`, `Card`, `DataGrid`, `Avatar`, `Persona`, `Text`), using `makeStyles` for layout. Don't use a custom theme.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(ui): shared presentational Fluent components`

---

### Task 12: Web app shell, providers, user switcher, Playwright harness

**Files:**
- Create: `apps/web/{package.json,tsconfig.json,index.html,vite.config.ts,playwright.config.ts}`
- Create: `src/{main.tsx,api.ts,router.tsx}`, `src/store/ui-store.ts`, `src/routes/{__root,index}.tsx`, `src/components/AppHeader.tsx`
- Test: `apps/web/e2e/shell.spec.ts`, `apps/web/e2e/fixtures.ts`

**Interfaces — Produces:**
- `useUiStore` (zustand `persist`, key `alerts-demo-ui`): `{ currentUserId: string; theme: 'light'|'dark'; density: 'comfortable'|'compact'; setCurrentUserId; setTheme; setDensity }`. The default `currentUserId` is `'U-01'`.
- `api` (`src/api.ts`): `createApiClient({ baseUrl: '', getUserId: () => useUiStore.getState().currentUserId })`.
- `queryKeys`: `alerts(list search)`, `alert(id)`, `timeline(id)`, `related(id)`, `users`, `meta`, `actionRequests(search)`, `actionRequest(id)`, `settings(userId)`.
- Router: a TanStack Router instance with **custom `parseSearch` / `stringifySearch`** built on `fromSearchParams` / `toSearchParams` from `@app/domain`, so app URLs match `alertListUrl` byte for byte. `/` redirects to `/alerts`.
- `AppHeader`: app name, nav ("Alerts", "Queue" + badge placeholder for Task 16), user switcher (Fluent `Dropdown` over `/api/users`), theme toggle.
- Switching user resets the query cache.
- If the persisted `currentUserId` isn't in the `/api/users` result, set it to `U-01` (Review Focus 3).
- Playwright: `webServer` starts the server (`AGENT_TOKEN=test-agent-token`) and `vite --port 5173`, with `baseURL` `http://localhost:5173`. `fixtures.ts` exports a `test` with an auto fixture that calls `POST /api/admin/reset`, and helpers `agentRequest(path, body)` (uses the agent token, `X-User-Id: U-01`).

- [ ] **Step 1: Write failing e2e tests** `shell.spec.ts`:

```ts
test('/ redirects to /alerts and header shows Priya Shah', ...);
test('switching user to Tom Becker persists across reload', ...);
test('stale persisted user falls back to U-01', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('alerts-demo-ui', JSON.stringify({ state: { currentUserId: 'U-99' }, version: 0 })));
  await page.goto('/alerts'); await expect(page.getByTestId('current-user')).toHaveText(/Priya Shah/);
});
test('theme toggle switches to dark', ...);
```
- [ ] **Step 2:** Run `pnpm --filter @app/web exec playwright install chromium && pnpm e2e`. Expected: FAIL.
- [ ] **Step 3:** Implement the shell (the `/alerts` route can be a placeholder for now).
- [ ] **Step 4:** Run `pnpm e2e`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(web): app shell, providers, user switcher, Playwright harness`

---

### Task 13: Alerts list route — URL-driven filters, search, table, pagination

**Files:**
- Create: `apps/web/src/routes/alerts.index.tsx`, `src/components/{FilterBar,SearchBox,Pagination}.tsx`
- Test: `apps/web/e2e/alerts-list.spec.ts`

**Interfaces:**
- Consumes: `AlertListSearchSchema` (route `validateSearch`), `AlertTable`, `api`.
- Produces: the filter state **only** in URL search params. Every control writes through `navigate({ search })`. `q` is debounced 300 ms. Changing any filter resets `page`. The count shows "{total} alerts". There's an "Assigned to me" toggle (`assigneeId = currentUserId`).

- [ ] **Step 1: Write failing e2e tests:**

```ts
test('W1 deep link renders exactly 2 rows and the filters are set', async ({ page }) => {
  await page.goto(alertListUrl('', { status: ['open'], severity: ['high'], desk: ['eu-equities'], q: 'layering' }));
  await expect(page.getByRole('row').filter({ hasText: /ALT-/ })).toHaveCount(2);
  await expect(page.getByTestId('result-count')).toHaveText('2 alerts');
  await expect(page.getByRole('searchbox')).toHaveValue('layering');
});
test('setting filters via UI produces the canonical URL', ...); // expect(page).toHaveURL(alertListUrl(base, {...}))
test('row link opens /alerts/ALT-1042', ...);
test('bad params degrade: /alerts?status=bogus&page=0 shows all alerts, no error', ...); // Review Focus 2
test('sorting by severity updates URL sort=-severity', ...);
```
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(web): URL-driven alert list with filters and search`

---

### Task 14: Alert detail route — header, highlights, assignees, tabs, comments

**Files:**
- Create: `apps/web/src/routes/alerts.$alertId.tsx`, `src/components/{CommentComposer,MaterialsTab,DataTab}.tsx`
- Test: `apps/web/e2e/alert-detail.spec.ts`

**Interfaces:**
- Consumes: `AlertDetailSearchSchema`, and `AlertHeader`, `AlertHighlights`, `AssigneesPanel`, `AlertTimeline`, `DataTabTable` from `@app/ui`.
- Produces: tabs bound to `?tab=`, and the data tab picker bound to `?dataTab=` (the default is the first tab).
  - The comment composer posts to `/comments` and invalidates the alert, timeline and list queries.
  - Materials shows links (opening in a new tab) and attachments (download via `/api/attachments/{id}/content`).
  - An unknown alert ID shows a not-found state with a link back to `/alerts`.

- [ ] **Step 1: Write failing e2e tests:**

```ts
test('alertUrl(…, {tab:"data", dataTab:"orders"}) opens Data tab on orders table', ...);
test('highlights show OTR 34:1 and Fast cancels 72%', ...);
test('posting a comment appears in timeline with my name', ...);
test('materials lists order-blotter.csv and it downloads', ...);
test('/alerts/ALT-9999 shows not found with link back', ...); // Review Focus 2
```
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(web): alert detail with tabs, highlights, assignees, comments`

---

### Task 15: Alert action dialogs — lifecycle, escalation, assignees, links, attachments

**Files:**
- Create: `apps/web/src/components/dialogs/{AcknowledgeDialog,CloseDialog,ReopenDialog,EscalateDialog,AssigneesDialog,AddLinkDialog,UploadAttachmentDialog}.tsx`, `src/hooks/useAlertMutations.ts`
- Test: `apps/web/e2e/alert-actions.spec.ts`

**Interfaces:**
- Produces: `useAlertMutations(alertId)` → `{ acknowledge, close, reopen, escalate, setAssignees, addLink, uploadAttachment }`. These are React Query mutations that invalidate `alert(id)`, `timeline(id)`, `alerts(*)` and `related(*)`.
  - Errors show a Fluent `MessageBar` with the server `message`.
  - The dialogs enforce the required fields from spec §6. Submit stays disabled until they're valid.
  - Header buttons come from `allowedActions` only.

- [ ] **Step 1: Write failing e2e tests:**

```ts
test('acknowledge ALT-1042 → status In Progress, Acknowledge button gone', ...);
test('W3 app side: escalate ALT-1013 to Daniel Okafor → escalated event, assignee added, status unchanged', ...);
test('close requires outcome and note; closed alert offers Reopen', ...);
test('W4 app side: reopen ALT-0987 requires a reason; timeline shows Closed → Open with reason', ...);
test('edit assignees; add link; upload a small file shows in materials', ...);
```
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(web): lifecycle, escalation, assignee and materials dialogs`

---

### Task 16: Access queue UI, Claude markers, settings

**Files:**
- Create: `apps/web/src/routes/{queue.index,queue.$requestId}.tsx`, `src/components/{PendingRequestsBanner,SettingsDialog}.tsx`, `src/hooks/useActionRequests.ts`
- Modify: `apps/web/src/components/AppHeader.tsx` (queue badge, settings entry), `apps/web/src/routes/alerts.$alertId.tsx` (banner)
- Test: `apps/web/e2e/access-queue.spec.ts`

**Interfaces:**
- Produces:
  - `usePendingCount()`: queries `/api/action-requests?status=pending&onBehalfOf=currentUserId` with `refetchInterval: 3000`.
  - `useDecide(id)`: `{ approve, reject }`, which invalidates the action-request, alert, timeline and list queries.
  - `/queue` lists `ActionRequestCard`s filtered by `?status`.
  - `/queue/$requestId` shows one card, then "View alert" after a decision. A failed request shows the failure message.
  - The alert banner lists pending requests for that alert with inline Approve and Reject.
  - The settings dialog toggles "Require approval for Claude's actions".

- [ ] **Step 1: Write failing e2e tests** (requests are created via the `agentRequest` fixture):

```ts
test('badge shows 1 within 5s after an agent comment is submitted while page is open', ...); // Review Focus 5
test('approve from /queue/AR-xxxx → comment in timeline with "via Claude" and "approved by Priya Shah"', ...);
test('approve from alert banner for queued acknowledge → status In Progress', ...);
test('reject with reason → request rejected; timeline shows rejection', ...);
test('stale approve: human acknowledges first, then approve shows failed message', ...);
test('/queue/AR-9999 shows not found', ...); // Review Focus 2
test('turning the setting off makes the next agent comment apply directly (via Claude, no approval)', ...);
```
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the full e2e suite with `pnpm e2e`. Expected: all PASS.
- [ ] **Step 5: Commit**: `feat(web): access queue, Claude markers, approval setting`

---

### Task 17: MCP server

**Files:**
- Create: `apps/mcp-server/{package.json,tsconfig.json}`, `src/{env,main,server,tools,format}.ts`
- Test: `apps/mcp-server/test/tools.test.ts`

**Interfaces:**
- Consumes:
  - `createApiClient` with `agentToken` + `getUserId: () => ACTING_USER_ID`.
  - Link builders from `@app/domain` with `APP_BASE_URL`.
  - The spike's findings (`docs/spike-notes.md`).
- Produces:
  - `createMcpServer(deps: { api: ApiClient; appBaseUrl: string }): McpServer`, which registers the 8 tools in spec §10.
  - `startHttp({ port, deps }): Promise<{ close(): Promise<void> }>`, which serves Streamable HTTP at `/mcp`. It's stateless, building a new server and transport per request.
  - Tool input schemas come from `@app/domain`:
    - `search_alerts` = `AlertListQuerySchema` minus `page` plus `limit` (1..25, default 10).
    - `get_alert` / `get_alert_timeline` / `find_related_alerts` take `{ alertId }`, and `find_related_alerts` adds an optional `days`.
    - `add_comment` takes `{ alertId, body, rationale }`.
    - `acknowledge_alert` takes `{ alertId, rationale }`.
    - `get_action_request` takes `{ requestId }`.
  - Annotations follow spec §10, with `title` set on each.
  - Every result has `content: [{ type:'text', text }]` (a concise human-readable summary built by `format.ts`) plus `structuredContent`:
    - `search_alerts`: `{ items, total, listUrl }`
    - `get_alert`: `{ alert, url, tabUrls }`
    - `get_alert_timeline` and `find_related_alerts`: their data plus the `url` of each alert
    - writes: `{ status: 'pending_approval', requestId, approveUrl }` or `{ status: 'applied', event, url }`
    - `get_action_request`: `{ request, url, approveUrl }`
  - Pending write text, exact: "Nothing has changed yet. {Priya Shah} must approve this in the app: {approveUrl}". The user name is resolved from `/api/users`.
  - API errors become `isError: true` results with the server message.

- [ ] **Step 1: Choose the transport.** If `@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js` exists in the installed SDK, use it inside a Hono `app.all('/mcp', c => transport.handleRequest(c.req.raw))`. Otherwise use `@hono/mcp`'s `StreamableHTTPTransport`. Record the choice in a comment in `main.ts`.
- [ ] **Step 2: Write failing tests.** Start the backend in-process (`createApp`, served by `@hono/node-server` on an ephemeral port, token `test-agent-token`) and `startHttp` on an ephemeral port. Connect `Client` + `StreamableHTTPClientTransport`.

```ts
it('lists exactly the 8 tools with readOnlyHint true on the 6 reads and false on the 2 writes', ...);
it('search_alerts W1 → 2 items and listUrl === alertListUrl(APP, {status:["open"],severity:["high"],desk:["eu-equities"],q:"layering"})', ...);
it('get_alert ALT-1042 includes rule.indicators and tabUrls.data', ...);
it('find_related_alerts ALT-1042 returns the 3 T-0412 alerts', ...);
it('add_comment → pending_approval with approveUrl ending /queue/AR-…; backend shows AR pending, onBehalfOf U-01, via claude', ...);
it('text of a pending write starts with "Nothing has changed yet."', ...);
it('after human approve via API, get_action_request → approved with resultEvent', ...);
it('acknowledge_alert on in_progress alert → isError with illegal_transition message', ...);
```
- [ ] **Step 3:** Run `pnpm vitest run apps/mcp-server`. Expected: FAIL.
- [ ] **Step 4:** Implement. The `dev` script is `tsx watch src/main.ts`. Env defaults come from `.env.example`, and a missing `AGENT_TOKEN` fails fast.
- [ ] **Step 5:** Run. Expected: PASS. Then run `pnpm test && pnpm typecheck && pnpm lint`. Expected: PASS.
- [ ] **Step 6: Commit**: `feat(mcp-server): 8 tools over Streamable HTTP with deep links and queued writes`

---

### Task 18: Claude plugin, README, end-to-end rehearsal

**Files:**
- Create: `plugin/.claude-plugin/plugin.json` (`name: "alerts-demo"`, `version: "0.1.0"`, description), `plugin/.mcp.json` (`{"mcpServers": {"alerts": {"type": "http", "url": "http://localhost:3002/mcp"}}}`), `plugin/skills/investigate-alert/SKILL.md`, `README.md`
- Delete: `spikes/`

**Interfaces — Produces:**
- `SKILL.md`:
  - Frontmatter `name: investigate-alert` and a description that triggers on investigating, triaging or recommending on financial surveillance alerts.
  - The body follows spec §11 step by step:
    1. Gather context with `get_alert`, `get_alert_timeline` and `find_related_alerts`.
    2. Test each `rule.indicators` threshold against the data tabs, giving numbers.
    3. Recommend exactly one next action, with 2–3 supporting facts, 1 counter-fact and a confidence level (low/medium/high).
    4. Always link the alert (and the relevant tab).
    5. Offer to acknowledge and comment. Submit only after the user agrees, always with a rationale.
    6. Give the `approveUrl`, and never say a change happened until `get_action_request` shows `approved`.
  - Add a short section on shift handovers (W5): `search_alerts` with `involvedUserId` + `updatedFrom` = the start of today.
- `README.md`:
  - Prerequisites (Node ≥22, corepack).
  - `pnpm install`, `cp .env.example .env`, `pnpm dev`.
  - The ports.
  - How to install the plugin in Claude Code (`claude --plugin-dir ./plugin`, or a local marketplace) and in Cowork (from `docs/spike-notes.md`).
  - Test commands.
  - A link to the rehearsal doc.

- [ ] **Step 1:** Write the plugin files and the README.
- [ ] **Step 2: Verification (Claude Code).** Run `pnpm dev`, then run `claude --plugin-dir ./plugin` and confirm `/mcp` shows `alerts` connected with 8 tools. Run W1, W2 (approve in the app), W3 (escalate in the app), W4 (reopen in the app) and W5 using the prompts in `docs/rehearsal-workflows.md`. For each, check that the deep links open the described view. Record any issues as fixes to the skill or tool descriptions.
- [ ] **Step 3: Verification (Cowork). Ask the user** to install the plugin in Cowork per `docs/spike-notes.md` and run W1 and W2. Note the outcomes in `docs/spike-notes.md`.
- [ ] **Step 4:** Run `pnpm test && pnpm typecheck && pnpm lint && pnpm e2e`. Expected: all PASS.
- [ ] **Step 5: Commit**: `feat(plugin): alerts-demo plugin with investigate-alert skill; README; remove spike`

---

## Spec coverage check

| Spec section | Task(s) |
| --- | --- |
| §5 layout, runtime, ports, env | 2, 6, 12, 17 |
| §6 schemas, state machine, links, ActionRequest, settings | 2, 3, 4 |
| §7 identity, agent detection, access queue, every route, store, search, seed | 5, 6, 7, 8, 9 |
| §8 routes, state ownership, header, agent visibility, deep-link contract | 12, 13, 14, 15, 16 |
| §9 shared UI | 11 |
| §10 MCP tools, identity, transport | 17 |
| §11 plugin and skill | 18 |
| §13 testing matrix, workflow independence | 5, 7–9, 12–17 |
| §14 spike | 1 |
| §12 phase 2 | Out of scope (unblocked by 11 and 17's `structuredContent`) |
