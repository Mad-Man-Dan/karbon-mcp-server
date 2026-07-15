import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KarbonClient, odataQuery } from "../karbon-client.js";
import { jsonResult, listInputSchema, withErrorHandling } from "../tool-helpers.js";

export function registerUserTools(server: McpServer, client: KarbonClient) {
  server.registerTool(
    "list_users",
    {
      title: "List users",
      description: "List Karbon users (team members) on this account.",
      inputSchema: listInputSchema,
    },
    withErrorHandling(async (args) =>
      jsonResult(await client.get("/Users", odataQuery(args))),
    ),
  );

  server.registerTool(
    "get_user",
    {
      title: "Get user",
      description: "Get a single Karbon user by their UserId.",
      inputSchema: {
        userId: z.string().describe("The Karbon UserId"),
      },
    },
    withErrorHandling(async ({ userId }) =>
      jsonResult(await client.get(`/Users/${encodeURIComponent(userId)}`)),
    ),
  );
}
