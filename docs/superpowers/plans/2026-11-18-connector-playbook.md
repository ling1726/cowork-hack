# Connector Playbook and Tool-Naming Prompts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send the investigate-alert playbook to every MCP client as server `instructions`, and make the six Open in Cowork prompts name the tools to call instead of a skill or an app URL.

**Architecture:** `apps/mcp-server/src/main.ts` reads `plugin/skills/investigate-alert/SKILL.md`, strips its front matter, and passes the body through `startHttp` → `createMcpServer` → `new McpServer(info, { instructions })`. `packages/domain/src/cowork.ts` gets a new prefix, new prompt bodies and a `searchArgs` helper; the triage case loses its `base`.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk` 1.32, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-18-connector-playbook-design.md`

## Global Constraints

- Prompt prefix: `Using the alerts tools, ` (exact). No prompt may contain `http` or `skill`.
- Prompt bodies: exactly the table in the spec's Design section.
- Triage JSON key order: `status, severity, category, desk, assigneeId, traderId, instrument, from, to, q, sort`; empty or missing values and `page` are left out; `JSON.stringify` with no spacing.
- A missing `SKILL.md` must not stop the MCP server.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Front matter leaks into the instructions** (the `name:`/`description:` block). Expected: the instructions start at the body. *(Task 1 test `instructions carry the playbook body without front matter`)*
2. **Triage with no filters.** Expected: `search_alerts with {}`, still valid arguments. *(Task 2 test `triage with no filters passes empty arguments`)*
3. **Triage with an empty array or blank text** in the search object. Expected: left out of the JSON. *(Task 2 test `searchArgs drops empty values and page`)*
4. **Plain clients** (no MCP Apps capability) must get the instructions too. *(Task 1 test runs with a plain client)*
5. **Other prompts still reference URLs.** Expected: none contain `http`. *(Task 2 test `no prompt mentions a URL or the skill`)*

---

### Task 1: Playbook as MCP instructions

**Files:**
- Create: `apps/mcp-server/src/playbook.ts`
- Modify: `apps/mcp-server/src/server.ts`, `apps/mcp-server/src/main.ts`
- Test: `apps/mcp-server/test/playbook.test.ts`

**Interfaces:**
- Produces: `loadPlaybook(path: string): string | undefined` (file body without a leading `---…---` front-matter block, trimmed; `undefined` and a `console.warn` when unreadable). `startHttp` opts gain `instructions?: string`; `createMcpServer(deps, opts: { ui: boolean; instructions?: string })`.

- [ ] **Step 1: Write failing tests** in `playbook.test.ts`:
  - `loadPlaybook strips the front matter`: on the real `plugin/skills/investigate-alert/SKILL.md` the result starts with `# Investigate an alert` and contains no `name: investigate-alert`.
  - `loadPlaybook returns undefined for a missing file`.
  - `instructions carry the playbook body without front matter`: start a backend + `startHttp({ ..., instructions: loadPlaybook(<path>) })`; a **plain** client's `getInstructions()` starts with `# Investigate an alert`.
  - `without instructions the server still starts`: `getInstructions()` is `undefined` and `listTools` returns 8 tools.
- [ ] **Step 2: Run** `pnpm vitest run apps/mcp-server/test/playbook.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** per Interfaces; `main.ts` resolves the path with `fileURLToPath(new URL('../../../plugin/skills/investigate-alert/SKILL.md', import.meta.url))`.
- [ ] **Step 4: Run** `pnpm vitest run apps/mcp-server && pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(mcp): send the investigate-alert playbook as MCP instructions`.

### Task 2: Prompts that name tools

**Files:**
- Modify: `packages/domain/src/cowork.ts`, `apps/web/src/components/list/ListToolbar.tsx`, `apps/web/e2e/open-in-cowork.spec.ts`
- Test: `packages/domain/test/cowork.test.ts`

**Interfaces:**
- Produces: `COWORK_PROMPT_PREFIX = 'Using the alerts tools, '`; triage case `{ kind: 'triage'; search: AlertListSearch }` (no `base`); `searchArgs(search: AlertListSearch): Record<string, unknown>`.

- [ ] **Step 1: Write failing tests**: replace the six prompt expectations with the spec's exact text (triage example: search `{ status: ['open'], severity: ['high'], desk: ['eu-equities'], q: 'layering' }` → `…call search_alerts with {"status":["open"],"severity":["high"],"desk":["eu-equities"],"q":"layering"}, then rank the results and say why.`), plus:
  - `searchArgs drops empty values and page`: `{ status: [], q: '  ', page: 3, traderId: 'T-0412', sort: '-severity' }` → `{ traderId: 'T-0412', sort: '-severity' }`.
  - `triage with no filters passes empty arguments`: `…call search_alerts with {}, then…`.
  - `no prompt mentions a URL or the skill`: every case's prompt lacks `http` and `skill`.
- [ ] **Step 2: Run** `pnpm vitest run packages/domain`. Expected: FAIL.
- [ ] **Step 3: Implement**; update `ListToolbar` (drop `base`) and the triage e2e expectation (drop `base`).
- [ ] **Step 4: Run** `pnpm test && pnpm typecheck && pnpm lint`, then `pnpm --filter @app/web e2e -g "Cowork|cowork|triage|handover|explain|second opinion"` (ports free). Expected: PASS.
- [ ] **Step 5: Commit** `feat(domain): Open in Cowork prompts name the tools, no URL or skill`.

### Task 3: Docs

**Files:** Modify `docs/spike-notes.md` (Open in Cowork check 4 → "Does Claude follow the playbook (connector instructions) and call the tools named in the prompt?"), `README.md` (one line: the connector carries the playbook as MCP instructions, so a URL-only connector such as Cowork needs no plugin).

- [ ] **Step 1: Edit**, then **Run** `pnpm lint`. Expected: PASS.
- [ ] **Step 2: Commit** `docs: connector instructions in README and spike notes`.
