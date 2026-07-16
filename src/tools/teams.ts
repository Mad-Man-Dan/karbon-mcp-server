import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KarbonClient } from "../karbon-client.js";
import { jsonResult, withErrorHandling } from "../tool-helpers.js";

export function registerTeamTools(
  server: McpServer,
  client: KarbonClient,
  readOnly: boolean,
) {
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

  if (readOnly) return;

  server.registerTool(
    "add_team_members",
    {
      title: "Add team members",
      description:
        "Add one or more users to a team by their UserKeys (find them with list_users). Users already on the team are skipped. Team membership can affect work visibility and assignment — confirm with the user before changing it.",
      inputSchema: {
        teamKey: z.string().describe("The Karbon TeamKey"),
        UserKeys: z
          .array(z.string())
          .min(1)
          .describe("UserKeys of the users to add"),
      },
    },
    withErrorHandling(async ({ teamKey, UserKeys }) => {
      const result = await client.post(
        `/Teams/${encodeURIComponent(teamKey)}/AddMembers`,
        { UserKeys },
      );
      return jsonResult(result ?? { success: true, teamKey, added: UserKeys });
    }),
  );

  server.registerTool(
    "remove_team_member",
    {
      title: "Remove team member",
      description:
        "Remove a user from a team by their UserKey. Team membership can affect work visibility and assignment — confirm with the user before changing it.",
      inputSchema: {
        teamKey: z.string().describe("The Karbon TeamKey"),
        UserKey: z.string().describe("UserKey of the user to remove"),
      },
    },
    withErrorHandling(async ({ teamKey, UserKey }) => {
      const result = await client.post(
        `/Teams/${encodeURIComponent(teamKey)}/RemoveMember`,
        { UserKey },
      );
      return jsonResult(result ?? { success: true, teamKey, removed: UserKey });
    }),
  );
}
