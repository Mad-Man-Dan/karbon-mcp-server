/**
 * Streamable HTTP transport: `karbon-mcp-server --http`
 *
 * Lets remote-only MCP clients (ChatGPT connectors, claude.ai custom
 * connectors, Claude Cowork) reach this server via a URL. Intended for
 * self-hosting: run it on your own machine/VM/container with your keys in
 * env vars, expose it over HTTPS (e.g. a Cloudflare tunnel), and point the
 * client at https://your-host/mcp.
 *
 * Stateless mode: a fresh server + transport pair per request, so no
 * session bookkeeping is needed and any instance can serve any request.
 *
 * Remote clients can't send custom headers, so optional access control is
 * a secret path segment: set KARBON_HTTP_SECRET=abc123 and the endpoint
 * becomes /mcp/abc123 (requests to anything else get 404).
 */
import * as http from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, ServerConfig } from "./server.js";

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

export function startHttpServer(
  config: ServerConfig,
  port: number,
  secret?: string,
): http.Server {
  const expectedPath = secret ? `/mcp/${secret}` : "/mcp";

  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }
    if (url.pathname !== expectedPath) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }

    try {
      const body = req.method === "POST" ? await readBody(req) : undefined;
      const mcpServer = createServer(config);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      res.on("close", () => {
        transport.close();
        mcpServer.close();
      });
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (error) {
      if (!res.headersSent) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32700,
              message: error instanceof Error ? error.message : "Bad request",
            },
            id: null,
          }),
        );
      }
    }
  });

  httpServer.listen(port, () => {
    console.error(
      `Karbon MCP server listening on http://localhost:${port}${expectedPath}` +
        `${config.readOnly ? " (read-only)" : ""}` +
        `${secret ? " (secret path enabled)" : ""}`,
    );
  });
  return httpServer;
}
