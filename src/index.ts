#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main() {
  if (process.argv[2] === "setup") {
    const { runSetup } = await import("./setup.js");
    await runSetup(process.argv.slice(3));
    process.exit(process.exitCode ?? 0);
  }

  const bearerToken = process.env.KARBON_BEARER_TOKEN ?? "";
  const accessKey = process.env.KARBON_ACCESS_KEY ?? "";

  // Don't exit on missing/placeholder credentials — start anyway so tool
  // calls can explain what to fix instead of the client showing a dead server.
  const { credentialsNotConfigured } = await import("./karbon-client.js");
  if (credentialsNotConfigured(bearerToken, accessKey)) {
    console.error(
      "Warning: KARBON_BEARER_TOKEN / KARBON_ACCESS_KEY are missing or still " +
        "placeholders. Tools will return setup instructions until real keys are " +
        "set (Karbon → Settings → Connected Apps → API Applications).",
    );
  }

  const readOnly =
    process.env.KARBON_READ_ONLY?.toLowerCase() === "true" ||
    process.argv.includes("--read-only");

  const allowPaymentWrites =
    process.env.KARBON_ALLOW_PAYMENT_WRITES?.toLowerCase() === "true" ||
    process.argv.includes("--allow-payment-writes");

  const config = {
    bearerToken,
    accessKey,
    readOnly,
    allowPaymentWrites,
    baseUrl: process.env.KARBON_API_BASE_URL,
  };

  if (process.argv.includes("--http")) {
    const portIndex = process.argv.indexOf("--port");
    const port =
      portIndex !== -1
        ? Number(process.argv[portIndex + 1])
        : Number(process.env.PORT ?? 8787);
    const { startHttpServer } = await import("./http.js");
    startHttpServer(config, port, process.env.KARBON_HTTP_SECRET);
    return;
  }

  const server = createServer(config);
  await server.connect(new StdioServerTransport());
  console.error(
    `Karbon MCP server running (stdio${readOnly ? ", read-only" : ""})`,
  );
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
