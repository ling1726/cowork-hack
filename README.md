# Alerts case management demo

This demo has a trade-surveillance app, an MCP server and a Claude plugin. An analyst starts an investigation in Claude (Cowork or Claude Code). Claude finds the alerts, examines the evidence and recommends one next step. The analyst finishes the work in the app.

Claude cannot change an alert alone. Each change that Claude requests waits for the analyst to approve it.

## What you need

- Node 22 or later.
- pnpm 10 or later. To get pnpm, run `corepack enable`.
- Claude Desktop, for Cowork.
- `cloudflared`, for Cowork. To get it, run `brew install cloudflared`.

## Start the app

1. Install the packages:

   ```bash
   pnpm install
   ```

2. Start all the servers:

   ```bash
   pnpm dev
   ```

3. Open http://localhost:5173.

`pnpm dev` builds the Cowork cards first. Then it starts three servers:

| Server     | Address                   |
| ---------- | ------------------------- |
| Web app    | http://localhost:5173     |
| API        | http://localhost:3001/api |
| MCP server | http://localhost:3002/mcp |

## Connect Cowork

Cowork runs on Anthropic servers. It cannot connect to `localhost`. Thus you must use a public tunnel to the MCP server.

1. Make sure that `pnpm dev` runs.
2. Open a new terminal. Start the tunnel:

   ```bash
   cloudflared tunnel --url http://localhost:3002
   ```

3. Find the public address in the output. For example: `https://example-words.trycloudflare.com`.
4. Open the `.env` file in the root folder. If there is no `.env` file, make one.
5. Add this line. Use your host name. Do not include `https://`.

   ```
   ALLOWED_HOSTS=example-words.trycloudflare.com
   ```

6. Stop `pnpm dev` (Ctrl+C). Then start it again.
7. In Claude, go to **Customize > Connectors**. Add a custom connector with this address:

   ```
   https://example-words.trycloudflare.com/mcp
   ```

8. Click **Refresh tools list**.
9. Start a new Cowork chat. Type: `Show me ALT-1042`.

> **WARNING:** The tunnel is public. A person who has the address can use the tools as the demo user. Stop the tunnel (Ctrl+C) when you complete the test.

The tunnel address changes each time you start `cloudflared`. When this occurs, do steps 3 to 9 again.

If the MCP tools change, click **Refresh tools list** again. If you do not, Claude uses the old tools and shows no cards.

## Connect Claude Code

1. Start Claude Code with the plugin:

   ```bash
   claude --plugin-dir ./plugin
   ```

2. Type `/mcp`. Make sure that `alerts` shows as connected.

Claude Code connects to `localhost`. It does not need the tunnel.

## Open Cowork from the app

The app has buttons with a sparkle icon, for example **Investigate with Cowork**. Each button opens a prompt that you can edit.

- **Open in Cowork** opens a new Cowork chat with the prompt. Claude Desktop must be installed. Claude does not start until you click Send.
- **Copy prompt** copies the prompt. Use it if Cowork does not open.

## Settings

The servers read `.env.example` and then `.env`. Put your changes in `.env`. Git ignores this file.

| Setting          | Default            | Function                                                                                                                    |
| ---------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `ALLOWED_HOSTS`  | (none)             | Other host names that the MCP server accepts. Put the tunnel host here.                                                     |
| `ACTING_USER_ID` | `U-01`             | The user that Claude acts for (Priya Shah). The app also starts as this user.                                               |
| `AGENT_TOKEN`    | `dev-agent-token`  | Marks a request as from Claude. The API and the MCP server must use one value.                                              |
| `COWORK_TOKEN`   | `dev-cowork-token` | Lets the Cowork card approve or reject a request. Must not be equal to `AGENT_TOKEN`. Remove it to approve only in the app. |

## Reset the data

The data is in memory. Each start uses the same data. To reset it, do one of these steps:

- Stop `pnpm dev` and start it again.
- Send `POST http://localhost:3001/api/admin/reset`.

## See the cards without Cowork

The test host shows the Cowork cards in a browser.

1. Make sure that `pnpm dev` runs.
2. Start the test host:

   ```bash
   pnpm --filter @app/mcp-ui host
   ```

3. Open http://localhost:5174/?tool=get_alert&args={"alertId":"ALT-1042"}

To use dark mode, add `&theme=dark` to the address.

## Run the tests

Stop `pnpm dev` before you run `pnpm e2e`. The end-to-end tests use the same ports.

```bash
pnpm test        # unit tests
pnpm typecheck   # TypeScript
pnpm lint        # lint and format check (pnpm format corrects the format)
pnpm e2e         # browser tests
```

Before the first `pnpm e2e`, install the browser:

```bash
pnpm --filter @app/web exec playwright install chromium
```

## Folders

```
packages/domain       Schemas, state machine, links
packages/api-client   Typed API client (regenerate: pnpm --filter @app/server openapi)
packages/ui           Shared components for the app and the Cowork cards
apps/server           REST API, in-memory data, approval queue
apps/web              Web app
apps/mcp-server       MCP server, with cards for clients that show MCP Apps
apps/mcp-ui           Cowork cards and the test host
plugin                Claude plugin: MCP connection and the investigate-alert skill
```

## Documents

- `docs/rehearsal-workflows.md`: the demo workflows W1 to W6
- `docs/spike-notes.md`: Cowork checks
- `docs/why-mcp.md`: why we use MCP
- `docs/superpowers/specs/`: designs
