import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KarbonClient } from "../karbon-client.js";
import { jsonResult, withErrorHandling } from "../tool-helpers.js";

export function registerBusinessCardTools(
  server: McpServer,
  client: KarbonClient,
  readOnly: boolean,
) {
  server.registerTool(
    "get_business_card",
    {
      title: "Get business card",
      description:
        "Get a single business card by BusinessCardKey. Business cards hold the contact details (email, phone, address, websites) of a contact, organization, or client group. Find the key by expanding BusinessCards on get_contact / get_organization / get_client_group.",
      inputSchema: {
        businessCardKey: z.string().describe("The Karbon BusinessCardKey"),
      },
    },
    withErrorHandling(async ({ businessCardKey }) =>
      jsonResult(
        await client.get(`/BusinessCards/${encodeURIComponent(businessCardKey)}`),
      ),
    ),
  );

  if (readOnly) return;

  server.registerTool(
    "update_business_card",
    {
      title: "Update business card",
      description:
        "Update a business card (full replace via PUT) — this is how you change a contact's, organization's, or client group's email addresses, phone numbers, and addresses. Fetch the card first with get_business_card and send back the complete card with your changes, since omitted fields are cleared.",
      inputSchema: {
        businessCardKey: z.string().describe("The Karbon BusinessCardKey to update"),
        EntityType: z
          .enum(["Contact", "Organization", "ClientGroup"])
          .describe("The type of entity this business card belongs to"),
        EntityKey: z
          .string()
          .describe("The key of the contact, organization, or client group this card belongs to"),
        IsPrimaryCard: z.boolean().optional(),
        OrganizationKey: z
          .string()
          .optional()
          .describe("For a contact's card: the organization the contact works at"),
        RoleOrTitle: z.string().optional(),
        EmailAddresses: z.array(z.string()).optional(),
        WebSites: z.array(z.string()).optional(),
        PhoneNumbers: z
          .array(
            z.object({
              Number: z.string(),
              CountryCode: z.string().optional(),
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
              CountryCode: z
                .string()
                .optional()
                .describe("Two-letter ISO 3166-1 country code, e.g. US, AU"),
              Label: z.string().optional(),
            }),
          )
          .optional(),
        FacebookLink: z.string().optional(),
        LinkedInLink: z.string().optional(),
        TwitterLink: z.string().optional(),
        SkypeLink: z.string().optional(),
      },
    },
    withErrorHandling(async ({ businessCardKey, ...fields }) => {
      const result = await client.put(
        `/BusinessCards/${encodeURIComponent(businessCardKey)}`,
        fields,
      );
      return jsonResult(result ?? { success: true, businessCardKey });
    }),
  );
}
