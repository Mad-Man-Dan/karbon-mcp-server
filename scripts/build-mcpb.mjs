// Builds the Claude Desktop one-click bundle (karbon-mcp-server.mcpb).
// Run `npm run build` first (or use `npm run build:mcpb`, which does both).
// Output: dist-mcpb/karbon-mcp-server.mcpb
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const staging = path.join(root, "dist-mcpb", "staging");

fs.rmSync(path.join(root, "dist-mcpb"), { recursive: true, force: true });
fs.mkdirSync(staging, { recursive: true });

// Server code + production dependencies
fs.cpSync(path.join(root, "dist"), path.join(staging, "dist"), { recursive: true });
fs.copyFileSync(path.join(root, "LICENSE"), path.join(staging, "LICENSE"));
fs.writeFileSync(
  path.join(staging, "package.json"),
  JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      type: "module",
      dependencies: pkg.dependencies,
    },
    null,
    2,
  ),
);
execSync("npm install --omit=dev --no-audit --no-fund --loglevel=error", {
  cwd: staging,
  stdio: "inherit",
  shell: true,
});

const manifest = {
  manifest_version: "0.3",
  name: "karbon-mcp-server",
  display_name: "Karbon",
  version: pkg.version,
  description: "Connect Claude to your Karbon practice management instance.",
  long_description:
    "Work with your Karbon data in natural language: contacts, organizations, client groups, " +
    "work items, notes, timesheets, invoices, payments, files, teams, and custom fields.\n\n" +
    "You need two values from Karbon (Settings → Connected Apps → API Applications): your " +
    "**Bearer Token** and your **Access Key**. They are stored securely on your computer and " +
    "only ever sent to Karbon's API.\n\nUnofficial community project — not affiliated with Karbon.",
  author: { name: pkg.author, url: "https://github.com/Mad-Man-Dan" },
  repository: { type: "git", url: "https://github.com/Mad-Man-Dan/karbon-mcp-server.git" },
  homepage: pkg.homepage,
  documentation:
    "https://github.com/Mad-Man-Dan/karbon-mcp-server/blob/main/docs/client-guides.md",
  support: pkg.bugs.url,
  server: {
    type: "node",
    entry_point: "dist/index.js",
    mcp_config: {
      command: "node",
      args: ["${__dirname}/dist/index.js"],
      env: {
        KARBON_BEARER_TOKEN: "${user_config.bearer_token}",
        KARBON_ACCESS_KEY: "${user_config.access_key}",
        KARBON_READ_ONLY: "${user_config.read_only}",
        KARBON_ALLOW_PAYMENT_WRITES: "${user_config.allow_payment_writes}",
      },
    },
  },
  tools: [
    { name: "list_contacts", description: "Search person contacts" },
    { name: "list_organizations", description: "Search organizations" },
    { name: "list_client_groups", description: "Search client groups" },
    { name: "list_work_items", description: "Search work items (jobs/engagements)" },
    { name: "get_estimate_summary", description: "Budget vs. actual on a work item" },
    { name: "list_timesheets", description: "Timesheets and time entries" },
    { name: "list_invoices", description: "Invoices and their status" },
    { name: "list_payments", description: "Payments recorded against invoices" },
    { name: "list_entity_files", description: "Files attached to work items and clients" },
    { name: "get_tenant_settings", description: "Your account's work types and statuses" },
  ],
  tools_generated: true,
  keywords: ["karbon", "accounting", "practice-management", "productivity", "api"],
  license: pkg.license,
  compatibility: {
    platforms: ["darwin", "win32", "linux"],
    runtimes: { node: ">=18.0.0" },
  },
  user_config: {
    bearer_token: {
      type: "string",
      title: "Karbon Bearer Token",
      description:
        "From Karbon → Settings → Connected Apps → API Applications. Karbon calls it the Application Authorization Token (looks like 1a2b3c4d-...).",
      sensitive: true,
      required: true,
    },
    access_key: {
      type: "string",
      title: "Karbon Access Key",
      description:
        "From the same Karbon page — the long key starting with 'ey...'.",
      sensitive: true,
      required: true,
    },
    read_only: {
      type: "boolean",
      title: "Read-only mode",
      description:
        "Recommended to start: Claude can view your Karbon data but never create or change anything. Untick later to enable writes.",
      required: false,
      default: true,
    },
    allow_payment_writes: {
      type: "boolean",
      title: "Allow payment writes",
      description:
        "Lets Claude record, delete, or reverse manual payments against invoices. Leave off unless you specifically want this.",
      required: false,
      default: false,
    },
  },
};

fs.writeFileSync(
  path.join(staging, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);

const outFile = path.join(root, "dist-mcpb", `karbon-mcp-server.mcpb`);
execSync(
  `npx --yes @anthropic-ai/mcpb pack "${staging}" "${outFile}"`,
  { cwd: root, stdio: "inherit", shell: true },
);
console.log(`\nBundle written to ${outFile}`);
