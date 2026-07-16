import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KarbonClient } from "../karbon-client.js";
import { jsonResult, withErrorHandling } from "../tool-helpers.js";

export function registerTeamTools(server: McpServer, client: KarbonClient) {
  server.registerTool(
    "list_teams",
    {
      title: "List teams",
      description:
        "List teams in Karbon (read-only). Supports OData filtering, e.g. filter: \"contains(Name,'Tax')\".",
      inputSchema: {
        filter: z.string().optional().describe("OData $filter expression"),
        top: z.number().int().min(1).max(100).optional(),
        skip: z.number().int().min(0).optional(),
      },
    },
    withErrorHandling(async ({ filter, top, skip }) => {
      const query: Record<string, string> = {};
      if (filter) query["$filter"] = filter;
      if (top !== undefined) query["$top"] = String(top);
      if (skip !== undefined) query["$skip"] = String(skip);
      return jsonResult(await client.get("/Teams", query));
    }),
  );

  server.registerTool(
    "get_team",
    {
      title: "Get team",
      description:
        "Get a single team by TeamKey, including its members (users and sub-teams).",
      inputSchema: {
        teamKey: z.string().describe("The Karbon TeamKey"),
      },
    },
    withErrorHandling(async ({ teamKey }) =>
      jsonResult(await client.get(`/Teams/${encodeURIComponent(teamKey)}`)),
    ),
  );
}
