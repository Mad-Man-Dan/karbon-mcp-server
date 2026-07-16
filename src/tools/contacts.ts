import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KarbonClient, odataQuery } from "../karbon-client.js";
import { jsonResult, listInputSchema, withErrorHandling } from "../tool-helpers.js";

const businessCardSchema = z
  .object({
    EmailAddresses: z.array(z.string()).optional(),
    PhoneNumbers: z
      .array(
        z.object({
          Number: z.string(),
          Label: z.string().optional(),
        }),
      )
      .optional(),
    Addresses: z
      .array(
        z.object({
          AddressLines: z.string().optional(),
          City: z.string().optional(),
          StateProvinceCounty: z.string().optional(),
          ZipCode: z.string().optional(),
          CountryCode: z.string().optional(),
          Label: z.string().optional(),
        }),
      )
      .optional(),
    RoleOrTitle: z.string().optional(),
    WebSites: z.array(z.string()).optional(),
    OrganizationKey: z
      .string()
      .optional()
      .describe("Link this card to an organization the person works at"),
    IsPrimaryCard: z.boolean().optional(),
  })
  .describe("Contact details (email, phone, address)");

export function registerContactTools(
  server: McpServer,
  client: KarbonClient,
  readOnly: boolean,
) {
  server.registerTool(
    "list_contacts",
    {
      title: "List contacts",
      description:
        "List or search person contacts in Karbon. Supports OData filtering, e.g. filter: \"contains(FullName,'Smith')\" or \"ContactType eq 'Client'\".",
      inputSchema: listInputSchema,
    },
    withErrorHandling(async (args) =>
      jsonResult(await client.get("/Contacts", odataQuery(args))),
    ),
  );

  server.registerTool(
    "get_contact",
    {
      title: "Get contact",
      description:
        "Get a single person contact by ContactKey — or by your own UserDefinedIdentifier — optionally expanding related data (BusinessCards, AccountingDetail, ClientTeam). Provide exactly one of contactKey or userDefinedIdentifier.",
      inputSchema: {
        contactKey: z.string().optional().describe("The Karbon ContactKey"),
        userDefinedIdentifier: z
          .string()
          .optional()
          .describe("Look up by your own external ID instead of the ContactKey"),
        expand: z
          .string()
          .optional()
          .describe(
            "Comma-separated related data to include: BusinessCards, AccountingDetail, ClientTeam",
          ),
      },
    },
    withErrorHandling(async ({ contactKey, userDefinedIdentifier, expand }) => {
      const path = contactKey
        ? `/Contacts/${encodeURIComponent(contactKey)}`
        : userDefinedIdentifier
          ? `/Contacts/GetContactByUserDefinedIdentifier(UserDefinedIdentifier='${encodeURIComponent(userDefinedIdentifier.replace(/'/g, "''"))}')`
          : null;
      if (!path) throw new Error("Provide contactKey or userDefinedIdentifier.");
      return jsonResult(
        await client.get(path, expand ? { $expand: expand } : undefined),
      );
    }),
  );

  if (readOnly) return;

  server.registerTool(
    "create_contact",
    {
      title: "Create contact",
      description: "Create a new person contact in Karbon.",
      inputSchema: {
        FirstName: z.string(),
        LastName: z.string(),
        MiddleName: z.string().optional(),
        PreferredName: z.string().optional(),
        Salutation: z.string().optional(),
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
          .describe("Your own external ID for this contact"),
        BusinessCards: z.array(businessCardSchema).optional(),
      },
    },
    withErrorHandling(async (args) =>
      jsonResult(await client.post("/Contacts", args)),
    ),
  );

  server.registerTool(
    "update_contact",
    {
      title: "Update contact",
      description:
        "Update fields on an existing person contact (partial update via PATCH). Only include the fields you want to change.",
      inputSchema: {
        contactKey: z.string().describe("The Karbon ContactKey to update"),
        FirstName: z.string().optional(),
        LastName: z.string().optional(),
        MiddleName: z.string().optional(),
        PreferredName: z.string().optional(),
        Salutation: z.string().optional(),
        ContactType: z.string().optional(),
        ClientOwner: z.string().optional(),
        ClientManager: z.string().optional(),
        RestrictionLevel: z.enum(["Public", "Private", "Hidden"]).optional(),
        UserDefinedIdentifier: z.string().optional(),
      },
    },
    withErrorHandling(async ({ contactKey, ...fields }) => {
      const result = await client.patch(
        `/Contacts/${encodeURIComponent(contactKey)}`,
        fields,
      );
      return jsonResult(result ?? { success: true, contactKey });
    }),
  );
}
