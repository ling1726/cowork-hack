# Spike notes: local MCP reachability

Status: **not yet verified by a person.** Tasks 1, 18 (steps 2 and 3) in the plan need someone at the keyboard with Cowork and Claude Code. Everything below is the checklist to run and a place to record the answers.

The throwaway `spikes/mcp-hello` server from the plan was skipped. The real MCP server (`apps/mcp-server`, tested end to end over Streamable HTTP) answers the same questions, so use it:

```bash
pnpm install
cp .env.example .env
pnpm dev
```

It serves `http://localhost:3002/mcp` (loopback only). `get_alert` returns links like `http://localhost:5173/alerts/ALT-1042`, and `add_comment` is a non-read-only tool, which is what the plan's `hello` and `poke` tools were for.

## Claude Code

```bash
claude --plugin-dir ./plugin
```

Then `/mcp` should list `alerts` as connected with 8 tools.

- [ ] Connected, 8 tools listed
- [ ] "Call get_alert for ALT-1042" prints a link, and Cmd-click opens it in the browser

## Cowork

Record the answers here:

- (a) Was `http://localhost:3002/mcp` reachable from Cowork? ______
- (b) The exact steps to add the connector or install the plugin in Cowork: ______
- (c) Did Cowork ask for confirmation before calling `add_comment` (a tool that is not read-only)? ______
- (d) Was a link in a reply clickable? ______

If (a) is no, the options are a tunnel (`cloudflared tunnel --url http://localhost:3002`, then put the tunnel URL in `plugin/.mcp.json` and start the MCP server with `ALLOWED_HOSTS=<the tunnel's hostname>`, because it only answers requests addressed to localhost, 127.0.0.1 or [::1] by default) or another route. No code changes are needed either way: the links Claude hands out come from `APP_BASE_URL`, which must stay a URL the analyst's browser can open.
