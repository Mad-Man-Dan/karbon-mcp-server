// Smoke test: boots the built server over stdio and asserts the tool
// registration matrix across the flag combinations. Run via `npm test`
// (which builds first). Update EXPECTED when tools are added or removed.
import { spawn } from "node:child_process";
import assert from "node:assert";

const EXPECTED = {
  default: 50,
  paymentWrites: 53,
  readOnly: 31,
  readOnlyWithPaymentFlag: 31, // read-only always wins
};

const PAYMENT_WRITE_TOOLS = [
  "create_manual_payment",
  "delete_manual_payment",
  "reverse_manual_payment",
];

function listTools(env) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ["dist/index.js"], {
      env: {
        ...process.env,
        KARBON_BEARER_TOKEN: "dummy",
        KARBON_ACCESS_KEY: "dummy",
        ...env,
      },
      stdio: ["pipe", "pipe", "ignore"],
    });
    let out = "";
    proc.stdout.on("data", (d) => (out += d));
    proc.on("error", reject);
    const send = (m) => proc.stdin.write(JSON.stringify(m) + "\n");
    send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "smoke-test", version: "0.0.0" },
      },
    });
    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    const timer = setTimeout(() => {
      proc.kill();
      for (const line of out.split("\n").filter(Boolean)) {
        try {
          const msg = JSON.parse(line);
          if (msg.id === 2) {
            return resolve(msg.result.tools.map((t) => t.name));
          }
        } catch {}
      }
      reject(new Error("No tools/list response from server"));
    }, 3000);
    proc.on("exit", () => clearTimeout(timer));
  });
}

function setupPrint() {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, ["dist/index.js", "setup", "--print"], {
      stdio: ["ignore", "pipe", "ignore"],
    });
    let out = "";
    proc.stdout.on("data", (d) => (out += d));
    proc.on("error", reject);
    proc.on("exit", () => {
      try {
        resolve(JSON.parse(out));
      } catch (e) {
        reject(new Error("setup --print did not emit valid JSON: " + e.message));
      }
    });
  });
}

const defaults = await listTools({});
assert.strictEqual(
  defaults.length,
  EXPECTED.default,
  `default mode: expected ${EXPECTED.default} tools, got ${defaults.length}`,
);
for (const tool of PAYMENT_WRITE_TOOLS) {
  assert.ok(
    !defaults.includes(tool),
    `default mode must not expose ${tool} without KARBON_ALLOW_PAYMENT_WRITES`,
  );
}
// Counterpart to the read-only absence check below — a count offset by an
// added tool must not mask download_file disappearing entirely.
assert.ok(
  defaults.includes("download_file"),
  "default mode must expose download_file",
);
console.log(`ok - default mode registers ${defaults.length} tools, payment writes hidden`);

const withPayments = await listTools({ KARBON_ALLOW_PAYMENT_WRITES: "true" });
assert.strictEqual(
  withPayments.length,
  EXPECTED.paymentWrites,
  `payment-writes mode: expected ${EXPECTED.paymentWrites} tools, got ${withPayments.length}`,
);
for (const tool of PAYMENT_WRITE_TOOLS) {
  assert.ok(withPayments.includes(tool), `payment-writes mode must expose ${tool}`);
}
console.log(`ok - payment-writes mode registers ${withPayments.length} tools`);

const readOnly = await listTools({ KARBON_READ_ONLY: "true" });
assert.strictEqual(
  readOnly.length,
  EXPECTED.readOnly,
  `read-only mode: expected ${EXPECTED.readOnly} tools, got ${readOnly.length}`,
);
for (const tool of readOnly) {
  assert.ok(
    !/^(create|update|delete|set|add|remove|upload|reverse)_/.test(tool),
    `read-only mode leaked a write tool: ${tool}`,
  );
}
// download_file writes to the local disk, so it counts as a write tool.
assert.ok(
  !readOnly.includes("download_file"),
  "read-only mode must not expose download_file (it writes to local disk)",
);
console.log(`ok - read-only mode registers ${readOnly.length} tools, no writes`);

const readOnlyPlusFlag = await listTools({
  KARBON_READ_ONLY: "true",
  KARBON_ALLOW_PAYMENT_WRITES: "true",
});
assert.strictEqual(
  readOnlyPlusFlag.length,
  EXPECTED.readOnlyWithPaymentFlag,
  "read-only must win over KARBON_ALLOW_PAYMENT_WRITES",
);
console.log("ok - read-only wins over the payment-writes flag");

const printed = await setupPrint();
assert.deepStrictEqual(
  Object.keys(printed.karbon.env).sort(),
  [
    "KARBON_ACCESS_KEY",
    "KARBON_ALLOW_PAYMENT_WRITES",
    "KARBON_BEARER_TOKEN",
    "KARBON_READ_ONLY",
  ],
  "setup --print must emit exactly the four env keys",
);
assert.strictEqual(printed.karbon.env.KARBON_ALLOW_PAYMENT_WRITES, "false");
console.log("ok - setup --print emits the expected config");

console.log("\nAll smoke tests passed.");
