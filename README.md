# Karbon MCP Server

> 🚧 **Early release** — this project is brand new and we're actively making updates over the next few days. Things may change quickly; pin a version if you need stability, and check back soon.

An unofficial [Model Context Protocol](https://modelcontextprotocol.io) server for [Karbon](https://karbonhq.com) practice management. Connect Claude Code, Claude Desktop, GitHub Copilot, or any MCP-compatible client to your Karbon instance and work with contacts, work items, notes, timesheets, and more using natural language.

> **Disclaimer:** This is a community project and is not affiliated with or endorsed by Karbon. Use at your own risk.

[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_Karbon_MCP-0098FF?logo=githubcopilot&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=karbon&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22karbon-mcp-server%22%5D%2C%22env%22%3A%7B%22KARBON_BEARER_TOKEN%22%3A%22YOUR_BEARER_TOKEN%22%2C%22KARBON_ACCESS_KEY%22%3A%22YOUR_ACCESS_KEY%22%7D%7D)
[![Install in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-Install_Karbon_MCP-24bfa5?logo=githubcopilot&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=karbon&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22karbon-mcp-server%22%5D%2C%22env%22%3A%7B%22KARBON_BEARER_TOKEN%22%3A%22YOUR_BEARER_TOKEN%22%2C%22KARBON_ACCESS_KEY%22%3A%22YOUR_ACCESS_KEY%22%7D%7D&quality=insiders)
[![Install in Cursor](https://img.shields.io/badge/Cursor-Install_Karbon_MCP-111111?logo=cursor&logoColor=white)](https://cursor.com/install-mcp?name=karbon&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImthcmJvbi1tY3Atc2VydmVyIl0sImVudiI6eyJLQVJCT05fQkVBUkVSX1RPS0VOIjoiWU9VUl9CRUFSRVJfVE9LRU4iLCJLQVJCT05fQUNDRVNTX0tFWSI6IllPVVJfQUNDRVNTX0tFWSJ9fQ%3D%3D)

## Features

| Area | Tools |
| --- | --- |
| Contacts | `list_contacts`, `get_contact`, `create_contact`, `update_contact` |
| Organizations | `list_organizations`, `get_organization`, `create_organization`, `update_organization` |
| Work items | `list_work_items`, `get_work_item`, `create_work_item`, `update_work_item` |
| Notes | `get_note`, `create_note` |
| Timesheets | `list_timesheets`, `get_timesheet`, `list_time_entries` (read-only) |
| Users | `list_users`, `get_user` |
| Account | `get_tenant_settings`, `list_work_templates` |

All list tools support OData filtering (`$filter`), ordering (`$orderby`), and pagination (`$top`/`$skip`) — so you can ask things like *"show my in-progress work items due this month"* and the AI can express that as a precise query.

## Prerequisites

- Node.js 18+
- Karbon API credentials. In Karbon go to **Settings → Connected Apps → API Applications** and copy your **Bearer Token** and **Access Key**. ([Karbon help article](https://help.karbonhq.com/en/articles/4324748-how-do-i-find-my-karbon-api-access-key))

## Setup

> **Step-by-step walkthroughs** for Claude Desktop, claude.ai/Cowork, and ChatGPT (written for non-developers) are in [docs/client-guides.md](docs/client-guides.md).

### One-line install (nothing to download first)

No Node.js? These check for it (installing via winget/Homebrew where possible), then run the setup wizard straight from npm — no repo clone, no manual download:

```powershell
# Windows (PowerShell)
irm https://raw.githubusercontent.com/Mad-Man-Dan/karbon-mcp-server/main/scripts/install.ps1 | iex
```

```sh
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/Mad-Man-Dan/karbon-mcp-server/main/scripts/install.sh | bash
```

### Quickest with Node.js installed: automatic setup

```sh
npx -y karbon-mcp-server setup
```

Setup asks a few quick questions — **project or user-level install**, your **API keys** (skippable), and whether to enable **read-only mode** — then does everything else automatically:

- **This project** (the default): writes `.mcp.json` (Claude Code), plus `.vscode/mcp.json` and `.cursor/mcp.json` if those folders exist in the project.
- **User account**: detects which MCP clients are installed on your machine — Claude Code, Codex, Claude Desktop, VS Code, Cursor — and adds the server to each (for Claude Code and Codex it uses their own `mcp add` CLI).

It then offers to take your two Karbon keys (Enter skips either one):

- Input is **masked** — you see a `*` per character, then a first-4/last-4 preview (like `1a2b****5c6d`, the same style Karbon's site uses) so you can confirm what was entered, with a gentle warning if the format looks off (the Bearer Token is a GUID; the Access Key starts with `ey...`).
- Keys are written **only to your MCP client's local config file** on your machine — the same file a manual setup would use. They are never sent anywhere else.
- If you skip, placeholder values are written and setup tells you exactly which file(s) to edit later.

It backs up every existing config file before touching it, merges rather than overwrites, and never replaces real credentials with placeholders (re-running and skipping the prompts keeps your existing keys). If you go project-level, gitignore the config files — your keys live in them in plain text.

Options:

```sh
npx -y karbon-mcp-server setup --scope project          # skip the question
npx -y karbon-mcp-server setup --scope user
npx -y karbon-mcp-server setup --read-only              # disable all write tools
npx -y karbon-mcp-server setup --client vscode,cursor   # only these clients
                    # ids: claude-code, codex, claude-desktop, vscode, cursor
npx -y karbon-mcp-server setup --print                  # just print the JSON
```

### One-click installs

The **Install in VS Code / Cursor** badges above create the server entry for you with placeholder credentials. After installing, replace `YOUR_BEARER_TOKEN` and `YOUR_ACCESS_KEY` with your real keys — in VS Code via the Command Palette → **MCP: Open User Configuration**, in Cursor by editing `~/.cursor/mcp.json`.

If you run the server before replacing the placeholders, it starts fine and every tool responds with setup instructions instead of failing cryptically — so you can even ask your AI assistant "why isn't Karbon working?" and it will tell you what to do.

Prefer to configure things by hand? Each client is below.

### Claude Code

```sh
claude mcp add karbon \
  --env KARBON_BEARER_TOKEN=your-bearer-token \
  --env KARBON_ACCESS_KEY=your-access-key \
  -- npx -y karbon-mcp-server
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "karbon": {
      "command": "npx",
      "args": ["-y", "karbon-mcp-server"],
      "env": {
        "KARBON_BEARER_TOKEN": "your-bearer-token",
        "KARBON_ACCESS_KEY": "your-access-key"
      }
    }
  }
}
```

### VS Code (GitHub Copilot)

Add to `.vscode/mcp.json` in your workspace (or your user `mcp.json`):

```json
{
  "servers": {
    "karbon": {
      "command": "npx",
      "args": ["-y", "karbon-mcp-server"],
      "env": {
        "KARBON_BEARER_TOKEN": "your-bearer-token",
        "KARBON_ACCESS_KEY": "your-access-key"
      }
    }
  }
}
```

### Cursor

Add to `~/.cursor/mcp.json` (or use the install badge above):

```json
{
  "mcpServers": {
    "karbon": {
      "command": "npx",
      "args": ["-y", "karbon-mcp-server"],
      "env": {
        "KARBON_BEARER_TOKEN": "your-bearer-token",
        "KARBON_ACCESS_KEY": "your-access-key"
      }
    }
  }
}
```

### Codex (OpenAI Codex CLI)

```sh
codex mcp add karbon \
  --env KARBON_BEARER_TOKEN=your-bearer-token \
  --env KARBON_ACCESS_KEY=your-access-key \
  -- npx -y karbon-mcp-server
```

Or add to `~/.codex/config.toml`:

```toml
[mcp_servers.karbon]
command = "npx"
args = ["-y", "karbon-mcp-server"]

[mcp_servers.karbon.env]
KARBON_BEARER_TOKEN = "your-bearer-token"
KARBON_ACCESS_KEY = "your-access-key"
```

### ChatGPT, claude.ai chat & Claude Cowork (remote connectors)

These clients can't launch local servers — they only connect to a **remote MCP server over HTTPS**. This package includes a streamable-HTTP mode for exactly that, so a firm can self-host it and keep their Karbon keys in their own infrastructure:

```sh
KARBON_BEARER_TOKEN=... KARBON_ACCESS_KEY=... KARBON_HTTP_SECRET=some-long-random-string \
  npx -y karbon-mcp-server --http --port 8787
```

This serves the MCP endpoint at `/mcp/<your-secret>` (plus a `/health` check). Expose it over HTTPS however you like — the quickest free option is a [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/):

```sh
cloudflared tunnel --url http://localhost:8787
```

Then add the URL (e.g. `https://your-tunnel.trycloudflare.com/mcp/your-secret`) as:

- **claude.ai / Cowork**: Settings → Connectors → **Add custom connector** (Pro/Max/Team/Enterprise plans)
- **ChatGPT**: Settings → Connectors (requires developer mode for full tool access)

> **Security notes:** anyone with the full URL has the same Karbon access as your API keys, so use a long random `KARBON_HTTP_SECRET`, always front it with HTTPS, and consider `KARBON_READ_ONLY=true` for remote use. There is deliberately no shared/hosted instance of this server — your keys should only ever live on infrastructure you control.

## Configuration

| Environment variable | Required | Description |
| --- | --- | --- |
| `KARBON_BEARER_TOKEN` | Yes | Bearer token from Karbon Connected Apps |
| `KARBON_ACCESS_KEY` | Yes | Access key (JWT) from Karbon Connected Apps |
| `KARBON_READ_ONLY` | No | Set to `true` to disable all create/update tools |
| `KARBON_API_BASE_URL` | No | Override the API base URL (default `https://api.karbonhq.com/v3`) |
| `KARBON_HTTP_SECRET` | No | HTTP mode only: secret path segment for the endpoint (`/mcp/<secret>`) |
| `PORT` | No | HTTP mode only: port to listen on (default 8787; `--port` wins) |

### Read-only mode

If you want a guarantee that the AI can never modify your Karbon data, set `KARBON_READ_ONLY=true` (or pass `--read-only`). Write tools are not registered at all in this mode, so the AI never sees them. The setup wizard asks about this.

**Changing it later:** setup always writes the toggle explicitly (`"KARBON_READ_ONLY": "true"` or `"false"`), so the switch is right there in your config file — flip the value and restart the client. Write tools appear or disappear accordingly (in read-only mode they aren't registered at all, so the AI never sees them). Alternatively, re-run setup and skip the key prompts (press Enter) — your saved keys are kept, and your new read-only answer is applied. One caveat: entries managed by the `claude` / `codex` CLIs aren't touched by a re-run — for those, run `claude mcp remove karbon` (or `codex mcp remove karbon`) first, then re-run setup.

### A note on credentials

Whether you type your keys into the setup wizard or paste them into a config file by hand, they end up in exactly one place: your own MCP client's local config file — the same file a fully manual setup would use. Nothing in this project transmits your keys anywhere else. Like every stdio MCP server, the keys live in that file in plain text, so treat it like a password: it grants the same access to your Karbon account as your keys do. If a key is ever exposed, regenerate it in Karbon under Settings → Connected Apps.

## Example prompts

- "Find the contact record for Jane Smith and show her business card details."
- "List all in-progress work items assigned to me, ordered by due date."
- "Create a work item for Acme Corp's 2025 tax return, assigned to alex@firm.com, starting next Monday."
- "Add a note to the Smith work item summarizing today's client call."
- "How many hours were logged against client work last week?"

## Development

```sh
git clone https://github.com/Mad-Man-Dan/karbon-mcp-server.git
cd karbon-mcp-server
npm install
npm run build
```

Test locally with the [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```sh
npx @modelcontextprotocol/inspector \
  -e KARBON_BEARER_TOKEN=... -e KARBON_ACCESS_KEY=... \
  node dist/index.js
```

The Karbon API is documented at [developers.karbonhq.com](https://developers.karbonhq.com/) with an OpenAPI spec at [karbonhq/karbon-api-reference](https://github.com/karbonhq/karbon-api-reference).

## Roadmap

- [ ] Client groups, invoices, and custom fields tools
- [ ] Files and comments
- [ ] One-click Claude Desktop extension (`.mcpb` bundle)
- [x] Remote mode (streamable HTTP) for ChatGPT / claude.ai / Cowork
- [ ] One-click "Deploy to Cloudflare Workers" template for the remote mode
- [ ] Publish to the MCP registry

Contributions welcome — open an issue or PR.

## License

[MIT](LICENSE)
