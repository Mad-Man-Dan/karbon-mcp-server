import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KarbonClient, odataQuery } from "../karbon-client.js";
import { jsonResult, listInputSchema, withErrorHandling } from "../tool-helpers.js";

export function registerOrganizationTools(
  server: McpServer,
  client: KarbonClient,
  readOnly: boolean,
) {
  server.registerTool(
    "list_organizations",
    {
      title: "List organizations",
      description:
        "List or search organization contacts in Karbon. Supports OData filtering, e.g. filter: \"contains(FullName,'Acme')\".",
      inputSchema: listInputSchema,
    },
    withErrorHandling(async (args) =>
      jsonResult(await client.get("/Organizations", odataQuery(args))),
    ),
  );

  server.registerTool(
    "get_organization",
    {
      title: "Get organization",
      description:
        "Get a single organization by OrganizationKey — or by your own UserDefinedIdentifier — optionally expanding related data (BusinessCards, AccountingDetail, ClientTeam, Contacts). Provide exactly one of organizationKey or userDefinedIdentifier.",
      inputSchema: {
        organizationKey: z.string().optional().describe("The Karbon OrganizationKey"),
        userDefinedIdentifier: z
          .string()
          .optional()
          .describe("Look up by your own external ID instead of the OrganizationKey"),
        expand: z
          .string()
          .optional()
          .describe(
            "Comma-separated related data to include: BusinessCards, AccountingDetail, ClientTeam, Contacts",
          ),
      },
    },
    withErrorHandling(async ({ organizationKey, userDefinedIdentifier, expand }) => {
      const path = organizationKey
        ? `/Organizations/${encodeURIComponent(organizationKey)}`
        : userDefinedIdentifier
          ? `/Organizations/GetOrganizationByUserDefinedIdentifier(UserDefinedIdentifier='${encodeURIComponent(userDefinedIdentifier.replace(/'/g, "''"))}')`
          : null;
      if (!path) throw new Error("Provide organizationKey or userDefinedIdentifier.");
      return jsonResult(
        await client.get(path, expand ? { $expand: expand } : undefined),
      );
    }),
  );

  if (readOnly) return;

  server.registerTool(
    "create_organization",
    {
      title: "Create organization",
      description: "Create a new organization contact in Karbon.",
      inputSchema: {
        FullName: z.string().describe("The organization's name"),
        ContactType: z
          .string()
          .optional()
          .describe(
            "Contact type label, e.g. 'Client', 'Prospect'. Valid values come from get_tenant_settings.",
          ),
        ClientOwner: z
          .string()
          .optional()
          .describe("Email address of the Karbon user who owns this client"),
        ClientManager: z.string().optional(),
        RestrictionLevel: z.enum(["Public", "Private", "Hidden"]).optional(),
        UserDefinedIdentifier: z
          .string()
          .optional()
          .describe("Your own external ID for this organization"),
      },
    },
    withErrorHandling(async (args) =>
      jsonResult(await client.post("/Organizations", args)),
    ),
  );

  server.registerTool(
    "update_organization",
    {
      title: "Update organization",
      description:
        "Update fields on an existing organization (partial update via PATCH). Only include the fields you want to change.",
      inputSchema: {
        organizationKey: z
          .string()
          .describe("The Karbon OrganizationKey to update"),
        FullName: z.string().optional(),
        ContactType: z.string().optional(),
        ClientOwner: z.string().optional(),
        ClientManager: z.string().optional(),
        RestrictionLevel: z.enum(["Public", "Private", "Hidden"]).optional(),
        UserDefinedIdentifier: z.string().optional(),
      },
    },
    withErrorHandling(async ({ organizationKey, ...fields }) => {
      const result = await client.patch(
        `/Organizations/${encodeURIComponent(organizationKey)}`,
        fields,
      );
      return jsonResult(result ?? { success: true, organizationKey });
    }),
  );
}
