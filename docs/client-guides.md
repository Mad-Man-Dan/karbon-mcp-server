# Client setup walkthroughs

Step-by-step guides for connecting Karbon to each AI client. Written for firm staff, not developers — no coding required.

**Before any of these:** get your two Karbon API values ready. In Karbon, go to **Settings → Connected Apps → API Applications**. You'll see:

- your **Bearer Token** (Karbon calls it the *Application Authorization Token*) — a GUID like `1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d`
- your **Access Key** — a long token starting with `ey...`

Treat both like passwords. They're only ever stored in config files on machines you control.

---

## Claude Desktop

*Local install — runs on your computer, nothing hosted.*

1. **Run the installer.** Open PowerShell (Windows) or Terminal (Mac) and run:

   ```powershell
   # Windows
   irm https://raw.githubusercontent.com/Mad-Man-Dan/karbon-mcp-server/main/scripts/install.ps1 | iex
   ```

   ```sh
   # macOS
   curl -fsSL https://raw.githubusercontent.com/Mad-Man-Dan/karbon-mcp-server/main/scripts/install.sh | bash
   ```

   (If you already have Node.js: `npx -y karbon-mcp-server setup` does the same thing.)

2. **Answer the wizard's questions:**
   - *Install for…* → choose **2) Your user account**
   - *Bearer Token / Access Key* → paste them (input shows `*`, then a first-4/last-4 preview so you can confirm)
   - *Read-only mode?* → **y** is recommended to start; you can enable writes later

3. **Restart Claude Desktop** (fully quit from the system tray / menu bar, then reopen).

4. **Verify:** start a new chat and ask *"List my in-progress Karbon work items."* You should see Claude call the `karbon` tools. If it responds with setup instructions instead, a key was skipped or mistyped — re-run the wizard.

5. **Optional switches** (edit the config file the wizard points you to, then restart the client):
   - `"KARBON_READ_ONLY": "true"` — the AI can view everything but never create or change anything.
   - `"KARBON_ALLOW_PAYMENT_WRITES": "true"` — enables recording/deleting/reversing manual payments against invoices. Off by default because these touch financial records; leave it off unless you specifically want it.

---

## claude.ai (web chat) & Claude Cowork

*These can't run software on your computer — they connect to a URL. Someone at your firm hosts the server once; everyone on the team can then use it.*

**Requirements:** a machine or small server to run it on, and a claude.ai Pro/Max/Team/Enterprise plan (custom connectors).

1. **On the host machine**, run the server in HTTP mode with your keys (PowerShell example):

   ```powershell
   $env:KARBON_BEARER_TOKEN = "your-bearer-token"
   $env:KARBON_ACCESS_KEY   = "your-access-key"
   $env:KARBON_READ_ONLY    = "true"                    # recommended for remote use
   $env:KARBON_HTTP_SECRET  = "a-long-random-string"    # e.g. 30+ random characters
   npx -y karbon-mcp-server --http
   ```

2. **Expose it over HTTPS.** Easiest free option, in a second terminal:

   ```sh
   cloudflared tunnel --url http://localhost:8787
   ```

   Cloudflare prints a URL like `https://something-random.trycloudflare.com`. Your connector URL is that plus `/mcp/` plus your secret:

   ```
   https://something-random.trycloudflare.com/mcp/a-long-random-string
   ```

   > For an always-on setup, run this on a small VM or use a named Cloudflare Tunnel so the URL doesn't change between restarts.

3. **In claude.ai (or Cowork):** Settings → **Connectors** → **Add custom connector** → paste the URL → Add. The Karbon tools appear in the tools menu of new chats.

4. **Verify:** ask *"What work types does our Karbon account have?"* or *"Which invoices are awaiting payment?"*

**Security notes:** anyone with the full URL has the same access as your API keys — keep it private, use a long secret, and prefer read-only mode. Host it yourself; don't use anyone else's hosted instance of this server, because they'd hold your keys.

---

## ChatGPT (web)

*Same idea as claude.ai: ChatGPT only connects to remote URLs, so complete steps 1–2 from the claude.ai section first to get your connector URL.*

1. In ChatGPT: **Settings → Apps & Connectors** (may require enabling **Developer mode** under Settings → Apps & Connectors → Advanced, which needs a Plus/Pro/Team/Enterprise plan).
2. **Create** a new connector → paste your MCP server URL → save.
3. In a new chat, enable the connector from the tools/plus menu, then ask a Karbon question.

**Caveats:** ChatGPT's MCP support is the most restrictive of the major clients — full tool access sits behind developer mode, features vary by plan, and OpenAI changes this area frequently. If your firm mostly lives in ChatGPT, read-only mode is strongly recommended.

---

## Something not working?

- **Tools respond with setup instructions** → your keys are missing or still placeholders. Re-run `npx -y karbon-mcp-server setup` (Enter skips a key you don't want to change) or edit the config file it points you to.
- **Client doesn't show the karbon tools** → restart the client fully; for claude.ai/ChatGPT, re-check the connector URL (it must include the secret path).
- **HTTP 401/403 errors from Karbon** → a key is wrong or was regenerated. Get fresh values from Karbon → Settings → Connected Apps and re-run setup.
- Still stuck? [Open an issue](https://github.com/Mad-Man-Dan/karbon-mcp-server/issues).
