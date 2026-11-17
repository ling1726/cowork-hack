# Alerts case management demo

A small trade-surveillance case management app, plus an MCP server and a Claude plugin that let an analyst **start an investigation in Claude (Cowork or Claude Code) and finish it in the app** through deep links. Claude searches, reasons over the evidence against the rule, and recommends one next step. Anything Claude wants to change waits in an approval queue in the app until the analyst approves it.

- `docs/superpowers/specs/2026-11-17-alerts-demo-design.md`: design
- `docs/rehearsal-workflows.md`: the scripted demo workflows W1 to W6
- `docs/why-mcp.md`: why MCP
- `docs/spike-notes.md`: Cowork reachability checklist

## Prerequisites

- Node 22 or later (developed on Node 25)
- pnpm 10 or later (`corepack enable`, or `npm i -g pnpm`)

## Run it

```bash
pnpm install
cp .env.example .env        # optional: the dev scripts also read .env.example
pnpm dev
```

| Process    | URL                       | Notes                                                           |
| ---------- | ------------------------- | --------------------------------------------------------------- |
| Web app    | http://localhost:5173     | Vite, proxies `/api` to the API                                 |
| API        | http://localhost:3001/api | in-memory, re-seeded on restart. OpenAPI at `/api/openapi.json` |
| MCP server | http://localhost:3002/mcp | Streamable HTTP, loopback only (`HOST=::` to widen)             |

The seed is deterministic: restart `pnpm dev` before a rehearsal or a live run for a clean state, or call `POST /api/admin/reset`. `AGENT_TOKEN` must be the same for the API and the MCP server; a request that carries it is treated as Claude and is marked "via Claude" everywhere. `ACTING_USER_ID` (default `U-01`, Priya Shah) is the user Claude acts for and the web app's default user.

## Install the Claude plugin

The plugin (`plugin/`) bundles the MCP connection and the `investigate-alert` skill.

- **Claude Code:** `claude --plugin-dir ./plugin`, then check `/mcp` shows `alerts` with 8 tools.
- **Cowork:** see `docs/spike-notes.md`. The exact steps are recorded there once verified.

## Tests

```bash
pnpm test        # Vitest: domain, server, API client, UI components, MCP server
pnpm typecheck   # tsc -b
pnpm lint        # oxlint and oxfmt --check (pnpm format to fix)
pnpm e2e         # Playwright, starts its own API and web servers (stop pnpm dev first)
```

First time only: `pnpm --filter @app/web exec playwright install chromium`.

## Layout

```
packages/domain       Zod schemas, state machine, search-param codec and link builder
packages/api-client   OpenAPI types and a typed client (regenerate: pnpm --filter @app/server openapi)
packages/ui           Presentational Fluent UI components (reused by MCP Apps in phase 2)
apps/server           Hono REST API, in-memory store, seed, access queue
apps/web              Vite + React app
apps/mcp-server       MCP over Streamable HTTP
plugin                Claude plugin: .mcp.json and the investigate-alert skill
```
