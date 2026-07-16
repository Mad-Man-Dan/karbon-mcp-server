import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KarbonClient, odataQuery } from "../karbon-client.js";
import { jsonResult, listInputSchema, withErrorHandling } from "../tool-helpers.js";

const memberSchema = z.object({
  ContactKey: z.string().optional().describe("ContactKey of a person to include in the group"),
  OrganizationKey: z.string().optional().describe("OrganizationKey of an organization to include in the group"),
});

export function registerClientGroupTools(
  server: McpServer,
  client: KarbonClient,
  readOnly: boolean,
) {
  server.registerTool(
    "list_client_groups",
    {
      title: "List client groups",
      description:
        "List or search client groups in Karbon. Supports OData filtering, e.g. filter: \"contains(FullName,'Smith Family')\" or \"UserDefinedIdentifier eq 'ABC123'\".",
      inputSchema: listInputSchema,
    },
    withErrorHandling(async (args) =>
      jsonResult(await client.get("/ClientGroups", odataQuery(args))),
    ),
  );

  server.registerTool(
    "get_client_group",
    {
      title: "Get client group",
      description:
        "Get a single client group by ClientGroupKey — or by your own UserDefinedIdentifier — optionally expanding related data (BusinessCard, ClientTeam). Includes the group's members (contacts and organizations). Provide exactly one of clientGroupKey or userDefinedIdentifier.",
      inputSchema: {
        clientGroupKey: z.string().optional().describe("The Karbon ClientGroupKey"),
        userDefinedIdentifier: z
          .string()
          .optional()
          .describe("Look up by your own external ID instead of the ClientGroupKey"),
        expand: z
          .string()
          .optional()
          .describe("Comma-separated related data to include: BusinessCard, ClientTeam"),
      },
    },
    withErrorHandling(async ({ clientGroupKey, userDefinedIdentifier, expand }) => {
      const path = clientGroupKey
        ? `/ClientGroups/${encodeURIComponent(clientGroupKey)}`
        : userDefinedIdentifier
          ? `/ClientGroups/GetClientGroupByUserDefinedIdentifier(UserDefinedIdentifier='${encodeURIComponent(userDefinedIdentifier.replace(/'/g, "''"))}')`
          : null;
      if (!path) throw new Error("Provide clientGroupKey or userDefinedIdentifier.");
      return jsonResult(
        await client.get(path, expand ? { $expand: expand } : undefined),
      );
    }),
  );

  if (readOnly) return;

  server.registerTool(
    "create_client_group",
    {
      title: "Create client group",
      description:
        "Create a new client group in Karbon. Members are existing contacts and/or organizations.",
      inputSchema: {
        FullName: z.string().describe("The full name of the client group"),
        ClientOwner: z
          .string()
          .optional()
          .describe("Email address of the Karbon user who owns this client relationship"),
        ClientManager: z.string().optional(),
        ContactType: z
          .string()
          .optional()
          .describe(
            "Contact type label, e.g. 'Client'. Valid values come from get_tenant_settings.",
          ),
        UserDefinedIdentifier: z
          .string()
          .optional()
          .describe("Your own external ID for this client group"),
        RestrictionLevel: z.enum(["Public", "Private", "Hidden"]).optional(),
        PrimaryContact: z
          .string()
          .optional()
          .describe("ContactKey of the group's main contact"),
        EntityDescription: z
          .object({ Text: z.string() })
          .optional()
          .describe("Free-form description of the client group"),
        Members: z.array(memberSchema).optional(),
      },
    },
    withErrorHandling(async (args) =>
      jsonResult(await client.post("/ClientGroups", args)),
    ),
  );

  server.registerTool(
    "update_client_group",
    {
      title: "Update client group",
      description:
        "Update fields on an existing client group (partial update via PATCH). Only include the fields you want to change.",
      inputSchema: {
        clientGroupKey: z.string().describe("The Karbon ClientGroupKey to update"),
        FullName: z.string().optional(),
        ClientOwner: z.string().optional(),
        ClientManager: z.string().optional(),
        ContactType: z.string().optional(),
        UserDefinedIdentifier: z.string().optional(),
        RestrictionLevel: z.enum(["Public", "Private", "Hidden"]).optional(),
        PrimaryContact: z.string().optional(),
        EntityDescription: z.object({ Text: z.string() }).optional(),
      },
    },
    withErrorHandling(async ({ clientGroupKey, ...fields }) => {
      const result = await client.patch(
        `/ClientGroups/${encodeURIComponent(clientGroupKey)}`,
        fields,
      );
      return jsonResult(result ?? { success: true, clientGroupKey });
    }),
  );
}
