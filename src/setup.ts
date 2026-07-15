/**
 * Setup: `npx karbon-mcp-server setup`
 *
 * Asks two things: project-level or user-level install, and (optionally)
 * the Karbon API credentials. Key input is masked (* per character) and
 * confirmed with a first-4/last-4 preview, matching how Karbon's own site
 * displays keys. Pressing Enter skips key entry and writes placeholder
 * values instead, which the user can replace in the config file later.
 *
 * Config files are backed up before being modified and merged rather than
 * overwritten. Existing real credentials are kept unless the user just
 * typed new ones.
 */
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as readline from "node:readline";
import {
  PLACEHOLDER_ACCESS_KEY,
  PLACEHOLDER_BEARER,
  credentialsNotConfigured,
} from "./karbon-client.js";

interface ServerEntry {
  command: string;
  args: string[];
  env: Record<string, string>;
}

interface ConfigureResult {
  client: string;
  status: "configured" | "already" | "skipped" | "failed";
  detail: string;
  /** Set when the user still needs to paste real keys into this file. */
  fileNeedingKeys?: string;
}

// ---------------------------------------------------------------------------
// Prompt plumbing
//
// One shared readline interface with a persistent "line" listener feeding a
// queue — rl.question() per prompt drops lines that arrive between questions
// when stdin is piped. Secret prompts on a TTY use raw mode instead, so the
// shared interface is released first and recreated on the next line prompt.
// ---------------------------------------------------------------------------

let rl: readline.Interface | null = null;
let stdinClosed = false;
const lineQueue: string[] = [];
let lineWaiter: ((line: string) => void) | null = null;

function getRl(): readline.Interface {
  if (!rl) {
    const instance = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: process.stdin.isTTY,
    });
    rl = instance;
    instance.on("line", (line) => {
      if (lineWaiter) {
        const waiter = lineWaiter;
        lineWaiter = null;
        waiter(line);
      } else {
        lineQueue.push(line);
      }
    });
    // Only treat a close as end-of-input if it wasn't us intentionally
    // releasing the interface (closePrompts nulls `rl` first). Marking
    // intentional closes as EOF made every later prompt auto-answer "".
    instance.on("close", () => {
      if (rl !== instance) return;
      rl = null;
      stdinClosed = true;
      if (lineWaiter) {
        const waiter = lineWaiter;
        lineWaiter = null;
        waiter("");
      }
    });
  }
  return rl;
}

function closePrompts(): void {
  const current = rl;
  rl = null;
  current?.close();
}

function promptLine(text: string): Promise<string> {
  getRl();
  process.stdout.write(text);
  if (lineQueue.length > 0) {
    return Promise.resolve(lineQueue.shift()!.trim());
  }
  if (stdinClosed) return Promise.resolve("");
  return new Promise((resolve) => {
    lineWaiter = (line) => resolve(line.trim());
  });
}

/** Masked input: echoes * per character. TTY only. */
function promptSecretTty(text: string): Promise<string> {
  // The shared readline interface would also consume these keypresses.
  closePrompts();
  return new Promise((resolve) => {
    process.stdout.write(text);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    let value = "";
    const onData = (chunk: Buffer) => {
      for (const char of chunk.toString("utf8")) {
        const code = char.charCodeAt(0);
        if (code === 13 || code === 10) {
          // Enter
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          resolve(value.trim());
          return;
        }
        if (code === 3) {
          // Ctrl-C
          stdin.setRawMode(false);
          process.stdout.write("\n");
          process.exit(1);
        }
        if (code === 127 || code === 8) {
          // Backspace / Delete
          if (value.length > 0) {
            value = value.slice(0, -1);
            process.stdout.write("\b \b");
          }
          continue;
        }
        if (code < 32) continue; // ignore other control characters
        value += char;
        process.stdout.write("*");
      }
    };
    stdin.on("data", onData);
  });
}

function promptSecret(text: string): Promise<string> {
  return process.stdin.isTTY ? promptSecretTty(text) : promptLine(text);
}

/** "1a2b************9f0e" — first/last 4 characters, like Karbon's own UI. */
function maskPreview(value: string): string {
  if (value.length <= 8) return "*".repeat(value.length);
  const middle = "*".repeat(Math.min(value.length - 8, 16));
  return `${value.slice(0, 4)}${middle}${value.slice(-4)}`;
}

const GUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function promptCredentials(): Promise<{
  bearer: string;
  accessKey: string;
}> {
  console.log("Karbon API credentials");
  console.log("----------------------");
  console.log(
    "Both values come from Karbon: Settings → Connected Apps → API Applications.",
  );
  console.log(
    "Your keys are written ONLY to your MCP client's local config file on this",
  );
  console.log(
    "machine — the same file a manual setup would use. They are never sent",
  );
  console.log("anywhere else.\n");
  console.log(
    "Input is hidden — you'll see a * for each character, and a partial preview",
  );
  console.log(
    "after each entry so you can confirm it. Press Enter to skip either one;",
  );
  console.log(
    "a placeholder is written instead and you can paste the real key into the",
  );
  console.log("config file later.\n");

  const bearer = await promptSecret(
    'Bearer Token — shown as your "Application Authorization Token" in Karbon,\n' +
      'a GUID that looks like "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d": ',
  );
  if (bearer) {
    console.log(`  Entered: ${maskPreview(bearer)}`);
    if (!GUID_PATTERN.test(bearer)) {
      console.log(
        "  Note: that doesn't look like a GUID — double-check it's the Bearer Token.",
      );
    }
  } else {
    console.log("  Skipped — a placeholder will be written.");
  }

  const accessKey = await promptSecret(
    '\nAccess Key — a long token that starts with "ey...": ',
  );
  if (accessKey) {
    console.log(`  Entered: ${maskPreview(accessKey)}`);
    if (!accessKey.startsWith("ey")) {
      console.log(
        '  Note: Karbon Access Keys normally start with "ey" — double-check this one.',
      );
    }
  } else {
    console.log("  Skipped — a placeholder will be written.");
  }
  console.log("");

  return {
    bearer: bearer || PLACEHOLDER_BEARER,
    accessKey: accessKey || PLACEHOLDER_ACCESS_KEY,
  };
}

/** The scope question: project-level or user-level install. */
async function promptScope(): Promise<"project" | "user"> {
  if (!process.stdin.isTTY) {
    console.log(
      "No terminal detected — defaulting to this project only " +
        "(pass --scope user for a global install).\n",
    );
    return "project";
  }
  console.log("Install the Karbon server for:");
  console.log(
    "  1) This project only   (.mcp.json / .vscode / .cursor in this folder)",
  );
  console.log(
    "  2) Your user account   (all projects — Claude Code, Codex, Claude Desktop, VS Code, Cursor)\n",
  );
  const answer = await promptLine("Choice [1]: ");
  console.log("");
  return answer === "2" ? "user" : "project";
}

// ---------------------------------------------------------------------------
// Client config locations
// ---------------------------------------------------------------------------

function appDataDir(): string {
  return process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming");
}

function claudeDesktopDir(): string {
  if (process.platform === "win32") return path.join(appDataDir(), "Claude");
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "Claude");
  }
  return path.join(os.homedir(), ".config", "Claude");
}

function vscodeUserDir(): string {
  if (process.platform === "win32") {
    return path.join(appDataDir(), "Code", "User");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "Code", "User");
  }
  return path.join(os.homedir(), ".config", "Code", "User");
}

function cursorDir(): string {
  return path.join(os.homedir(), ".cursor");
}

function codexDir(): string {
  return path.join(os.homedir(), ".codex");
}

function cliAvailable(command: string): boolean {
  const result = spawnSync(command, ["--version"], {
    shell: process.platform === "win32",
    stdio: "ignore",
    timeout: 15000,
  });
  return result.status === 0;
}

// ---------------------------------------------------------------------------
// Configuration writers
// ---------------------------------------------------------------------------

/** Merge the karbon entry into a JSON config file. */
function writeClientConfig(
  client: string,
  filePath: string,
  rootKey: "mcpServers" | "servers",
  entry: ServerEntry,
): ConfigureResult {
  let config: Record<string, any> = {};
  const newEntry: ServerEntry = { ...entry, env: { ...entry.env } };
  const newHasRealKeys = !credentialsNotConfigured(
    newEntry.env.KARBON_BEARER_TOKEN ?? "",
    newEntry.env.KARBON_ACCESS_KEY ?? "",
  );
  let credentialsKept = false;

  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, "utf8");
    if (raw.trim()) {
      try {
        config = JSON.parse(raw);
      } catch {
        return {
          client,
          status: "failed",
          detail: `${filePath} exists but is not valid JSON — fix it and re-run setup.`,
        };
      }
    }
    // If we're writing placeholders, never clobber existing real credentials.
    // If the user just typed real keys, those win.
    const oldEnv = config[rootKey]?.karbon?.env ?? {};
    if (
      !newHasRealKeys &&
      !credentialsNotConfigured(
        oldEnv.KARBON_BEARER_TOKEN ?? "",
        oldEnv.KARBON_ACCESS_KEY ?? "",
      )
    ) {
      newEntry.env.KARBON_BEARER_TOKEN = oldEnv.KARBON_BEARER_TOKEN;
      newEntry.env.KARBON_ACCESS_KEY = oldEnv.KARBON_ACCESS_KEY;
      credentialsKept = true;
    }
    const backup = `${filePath}.backup-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}`;
    fs.copyFileSync(filePath, backup);
  } else {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  config[rootKey] = { ...(config[rootKey] ?? {}), karbon: newEntry };
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + "\n");

  return {
    client,
    status: "configured",
    detail: credentialsKept
      ? `${filePath} (kept your existing credentials)`
      : filePath,
    fileNeedingKeys: credentialsKept || newHasRealKeys ? undefined : filePath,
  };
}

function configureClaudeCode(env: Record<string, string>): ConfigureResult {
  const shell = process.platform === "win32";
  const placeholderMode = credentialsNotConfigured(
    env.KARBON_BEARER_TOKEN ?? "",
    env.KARBON_ACCESS_KEY ?? "",
  );
  const existing = spawnSync("claude", ["mcp", "get", "karbon"], {
    shell,
    stdio: "ignore",
    timeout: 30000,
  });
  if (existing.status === 0) {
    return {
      client: "Claude Code",
      status: "already",
      detail: 'a "karbon" server is already configured — left it unchanged.',
    };
  }

  const args = ["mcp", "add", "-s", "user", "karbon"];
  for (const [key, value] of Object.entries(env)) {
    args.push("--env", `${key}=${value}`);
  }
  args.push("--", "npx", "-y", "karbon-mcp-server");

  const result = spawnSync("claude", args, {
    shell,
    encoding: "utf8",
    timeout: 60000,
  });
  if (result.status !== 0) {
    return {
      client: "Claude Code",
      status: "failed",
      detail: (result.stderr || result.stdout || "claude mcp add failed").trim(),
    };
  }
  return {
    client: "Claude Code",
    status: "configured",
    detail: "user-scope config (via `claude mcp add`)",
    fileNeedingKeys: placeholderMode
      ? "~/.claude.json — or re-run `claude mcp add -s user karbon ...` with real values"
      : undefined,
  };
}

/**
 * Codex stores MCP servers in TOML (~/.codex/config.toml). Prefer the
 * `codex mcp add` CLI; fall back to appending a TOML block ourselves.
 */
function configureCodex(env: Record<string, string>): ConfigureResult {
  const shell = process.platform === "win32";
  const configPath = path.join(codexDir(), "config.toml");
  const placeholderMode = credentialsNotConfigured(
    env.KARBON_BEARER_TOKEN ?? "",
    env.KARBON_ACCESS_KEY ?? "",
  );

  if (cliAvailable("codex")) {
    const existing = spawnSync("codex", ["mcp", "get", "karbon"], {
      shell,
      stdio: "ignore",
      timeout: 30000,
    });
    if (existing.status === 0) {
      return {
        client: "Codex",
        status: "already",
        detail: 'a "karbon" server is already configured — left it unchanged.',
      };
    }
    const args = ["mcp", "add", "karbon"];
    for (const [key, value] of Object.entries(env)) {
      args.push("--env", `${key}=${value}`);
    }
    args.push("--", "npx", "-y", "karbon-mcp-server");
    const result = spawnSync("codex", args, {
      shell,
      encoding: "utf8",
      timeout: 60000,
    });
    if (result.status === 0) {
      return {
        client: "Codex",
        status: "configured",
        detail: "via `codex mcp add`",
        fileNeedingKeys: placeholderMode ? configPath : undefined,
      };
    }
    // CLI exists but subcommand failed (older version) — fall through to TOML.
  }

  let existingToml = "";
  if (fs.existsSync(configPath)) {
    existingToml = fs.readFileSync(configPath, "utf8");
    if (existingToml.includes("[mcp_servers.karbon]")) {
      return {
        client: "Codex",
        status: "already",
        detail: `a "karbon" entry already exists in ${configPath} — left it unchanged.`,
      };
    }
    const backup = `${configPath}.backup-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}`;
    fs.copyFileSync(configPath, backup);
  } else {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
  }

  const envLines = Object.entries(env)
    .map(([key, value]) => `${key} = "${value}"`)
    .join("\n");
  const block =
    `\n[mcp_servers.karbon]\n` +
    `command = "npx"\n` +
    `args = ["-y", "karbon-mcp-server"]\n\n` +
    `[mcp_servers.karbon.env]\n` +
    `${envLines}\n`;
  fs.writeFileSync(
    configPath,
    existingToml.endsWith("\n") || existingToml === ""
      ? existingToml + block
      : existingToml + "\n" + block,
  );
  return {
    client: "Codex",
    status: "configured",
    detail: configPath,
    fileNeedingKeys: placeholderMode ? configPath : undefined,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): {
  readOnly: boolean;
  print: boolean;
  clients: string[] | null;
  scope: "project" | "user" | null;
} {
  const readOnly = argv.includes("--read-only");
  const print = argv.includes("--print");
  let clients: string[] | null = null;
  const clientIndex = argv.indexOf("--client");
  if (clientIndex !== -1 && argv[clientIndex + 1]) {
    clients = argv[clientIndex + 1].split(",").map((c) => c.trim().toLowerCase());
  }
  let scope: "project" | "user" | null = null;
  const scopeIndex = argv.indexOf("--scope");
  if (scopeIndex !== -1 && argv[scopeIndex + 1]) {
    const value = argv[scopeIndex + 1].toLowerCase();
    if (value === "project" || value === "user") scope = value;
  }
  return { readOnly, print, clients, scope };
}

interface Target {
  id: string;
  name: string;
  detected: () => boolean;
  configure: () => ConfigureResult;
  skipDetail?: string;
}

function projectTargets(cwd: string, entry: ServerEntry): Target[] {
  return [
    {
      id: "claude-code",
      name: "Claude Code",
      detected: () => true,
      configure: () =>
        writeClientConfig(
          "Claude Code",
          path.join(cwd, ".mcp.json"),
          "mcpServers",
          entry,
        ),
    },
    {
      id: "vscode",
      name: "VS Code",
      detected: () => fs.existsSync(path.join(cwd, ".vscode")),
      skipDetail:
        "no .vscode folder in this project (pass --client vscode to add anyway)",
      configure: () =>
        writeClientConfig(
          "VS Code",
          path.join(cwd, ".vscode", "mcp.json"),
          "servers",
          entry,
        ),
    },
    {
      id: "cursor",
      name: "Cursor",
      detected: () => fs.existsSync(path.join(cwd, ".cursor")),
      skipDetail:
        "no .cursor folder in this project (pass --client cursor to add anyway)",
      configure: () =>
        writeClientConfig(
          "Cursor",
          path.join(cwd, ".cursor", "mcp.json"),
          "mcpServers",
          entry,
        ),
    },
  ];
}

export async function runSetup(argv: string[]): Promise<void> {
  const { readOnly, print, clients, scope: scopeFlag } = parseArgs(argv);

  if (print) {
    const printEnv: Record<string, string> = {
      KARBON_BEARER_TOKEN: PLACEHOLDER_BEARER,
      KARBON_ACCESS_KEY: PLACEHOLDER_ACCESS_KEY,
      KARBON_READ_ONLY: readOnly ? "true" : "false",
    };
    console.log(
      JSON.stringify(
        {
          karbon: {
            command: "npx",
            args: ["-y", "karbon-mcp-server"],
            env: printEnv,
          },
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log("Karbon MCP Server — setup");
  console.log("=========================\n");

  try {
    const scope = scopeFlag ?? (await promptScope());
    const { bearer, accessKey } = await promptCredentials();
    const realKeys = !credentialsNotConfigured(bearer, accessKey);

    // Ask about read-only unless the flag already decided it. Skipped on
    // non-TTY runs, which default to read/write like the flagless CLI.
    let effectiveReadOnly = readOnly;
    if (!readOnly && process.stdin.isTTY) {
      const answer = await promptLine(
        "Read-only mode? The AI can view your Karbon data but never create or\n" +
          "change anything. You can turn this off later by removing\n" +
          'KARBON_READ_ONLY from the config file. [y/N]: ',
      );
      effectiveReadOnly = answer.toLowerCase().startsWith("y");
      console.log("");
    }

    // Always write the flag (explicit "false" included) so users can see
    // the toggle in their config file and flip it by hand later.
    const env: Record<string, string> = {
      KARBON_BEARER_TOKEN: bearer,
      KARBON_ACCESS_KEY: accessKey,
      KARBON_READ_ONLY: effectiveReadOnly ? "true" : "false",
    };
    const entry: ServerEntry = {
      command: "npx",
      args: ["-y", "karbon-mcp-server"],
      env,
    };

    const userTargets: Target[] = [
      {
        id: "claude-code",
        name: "Claude Code",
        detected: () => cliAvailable("claude"),
        configure: () => configureClaudeCode(env),
      },
      {
        id: "codex",
        name: "Codex",
        detected: () => cliAvailable("codex") || fs.existsSync(codexDir()),
        configure: () => configureCodex(env),
      },
      {
        id: "claude-desktop",
        name: "Claude Desktop",
        detected: () => fs.existsSync(claudeDesktopDir()),
        configure: () =>
          writeClientConfig(
            "Claude Desktop",
            path.join(claudeDesktopDir(), "claude_desktop_config.json"),
            "mcpServers",
            entry,
          ),
      },
      {
        id: "vscode",
        name: "VS Code",
        detected: () => fs.existsSync(vscodeUserDir()),
        configure: () =>
          writeClientConfig(
            "VS Code",
            path.join(vscodeUserDir(), "mcp.json"),
            "servers",
            entry,
          ),
      },
      {
        id: "cursor",
        name: "Cursor",
        detected: () => fs.existsSync(cursorDir()),
        configure: () =>
          writeClientConfig(
            "Cursor",
            path.join(cursorDir(), "mcp.json"),
            "mcpServers",
            entry,
          ),
      },
    ];

    const isProject = scope === "project";
    const targets = isProject
      ? projectTargets(process.cwd(), entry)
      : userTargets;
    console.log(
      isProject
        ? `Configuring this project (${process.cwd()})...\n`
        : "Detecting installed MCP clients...\n",
    );

    const results: ConfigureResult[] = [];
    if (isProject && clients) {
      for (const id of clients) {
        if (!targets.some((t) => t.id === id)) {
          results.push({
            client: id,
            status: "skipped",
            detail: "only supports user-level config — re-run with --scope user",
          });
        }
      }
    }
    for (const target of targets) {
      if (clients && !clients.includes(target.id)) continue;
      const forced = clients !== null;
      if (!forced && !target.detected()) {
        results.push({
          client: target.name,
          status: "skipped",
          detail: target.skipDetail ?? "not detected on this machine",
        });
        continue;
      }
      try {
        results.push(target.configure());
      } catch (error) {
        results.push({
          client: target.name,
          status: "failed",
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const icon = {
      configured: "[ok]",
      already: "[ok]",
      skipped: "[--]",
      failed: "[!!]",
    } as const;
    for (const result of results) {
      console.log(`${icon[result.status]} ${result.client}: ${result.detail}`);
    }

    const configured = results.some((r) => r.status === "configured");
    const needKeys = results.filter((r) => r.fileNeedingKeys);
    if (needKeys.length > 0) {
      console.log("\nFinish setup — one step left:");
      console.log(
        "  Get your Bearer Token and Access Key from Karbon\n" +
          "  (Settings → Connected Apps → API Applications), then replace\n" +
          `  ${PLACEHOLDER_BEARER} and ${PLACEHOLDER_ACCESS_KEY} in:`,
      );
      for (const result of needKeys) {
        console.log(`    - ${result.fileNeedingKeys}`);
      }
      console.log("\nThen restart the client(s). Until then, Karbon tools will");
      console.log("respond with these same setup instructions.");
    } else if (configured) {
      console.log("\nAll set — restart the client(s) to pick up the new server.");
    }

    if (isProject && configured && (realKeys || needKeys.length > 0)) {
      console.log(
        realKeys
          ? "\nHeads up: your API keys are now in file(s) inside this project —\nmake sure they are gitignored before committing."
          : "\nHeads up: these files live inside your project. Once you paste real\nkeys into them, make sure they are gitignored before committing.",
      );
    }

    if (results.some((r) => r.status === "failed")) {
      process.exitCode = 1;
    }
  } finally {
    closePrompts();
  }
}
