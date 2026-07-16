import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KarbonClient } from "../karbon-client.js";
import { jsonResult, withErrorHandling } from "../tool-helpers.js";

export function registerCustomFieldTools(
  server: McpServer,
  client: KarbonClient,
  readOnly: boolean,
) {
  server.registerTool(
    "list_custom_fields",
    {
      title: "List custom field definitions",
      description:
        "List all custom field definitions for the Karbon tenant — field names, types (Text, Number, Date, Boolean, Colleague, ListSingleSelect, ListMultipleSelect), list options, and which entities they apply to.",
      inputSchema: {},
    },
    withErrorHandling(async () => jsonResult(await client.get("/CustomFields"))),
  );

  server.registerTool(
    "get_custom_field_values",
    {
      title: "Get custom field values",
      description:
        "Get the custom field values set on a specific entity (contact, organization, or client group) by its entity key.",
      inputSchema: {
        entityKey: z
          .string()
          .describe("The ContactKey, OrganizationKey, or ClientGroupKey"),
      },
    },
    withErrorHandling(async ({ entityKey }) =>
      jsonResult(
        await client.get(`/CustomFieldValues/${encodeURIComponent(entityKey)}`),
      ),
    ),
  );

  if (readOnly) return;

  server.registerTool(
    "set_custom_field_values",
    {
      title: "Set custom field values",
      description:
        "Set custom field values on an entity (contact, organization, or client group). Use list_custom_fields for the available definitions and get_custom_field_values to see what's currently set. Values are always passed as an array of strings, even for single values.",
      inputSchema: {
        entityKey: z
          .string()
          .describe("The ContactKey, OrganizationKey, or ClientGroupKey"),
        CustomFieldValues: z
          .array(
            z.object({
              Key: z
                .string()
                .optional()
                .describe("The custom field definition key (from list_custom_fields)"),
              Name: z
                .string()
                .optional()
                .describe("The custom field name — alternative to Key"),
              Value: z
                .array(z.string())
                .describe(
                  "The value(s) to set, as strings. Single-value fields take a one-element array.",
                ),
            }),
          )
          .describe("The custom field values to set on the entity"),
      },
    },
    withErrorHandling(async ({ entityKey, CustomFieldValues }) => {
      const result = await client.put(
        `/CustomFieldValues/${encodeURIComponent(entityKey)}`,
        { EntityKey: entityKey, CustomFieldValues },
      );
      return jsonResult(result ?? { success: true, entityKey });
    }),
  );

  server.registerTool(
    "create_custom_field",
    {
      title: "Create custom field definition",
      description:
        "Create a new custom field definition for the whole Karbon tenant. This changes the firm's shared configuration, not just one record — state the field name, type, and visibility to the user and get their explicit confirmation before calling.",
      inputSchema: {
        Name: z.string().describe("The field name shown in Karbon"),
        Type: z.enum([
          "Text",
          "Number",
          "Date",
          "Boolean",
          "Colleague",
          "ListSingleSelect",
          "ListMultipleSelect",
        ]),
        IsVisibleToContacts: z.boolean().optional(),
        IsVisibleToOrganizations: z.boolean().optional(),
        ListOptions: z
          .array(z.string())
          .optional()
          .describe("Options for list-type fields"),
      },
    },
    withErrorHandling(async (args) =>
      jsonResult(await client.post("/CustomFields", args)),
    ),
  );

  server.registerTool(
    "delete_custom_field",
    {
      title: "Delete custom field definition",
      description:
        "DESTRUCTIVE AND IRREVERSIBLE: deleting a custom field definition permanently removes the field AND every value stored in it across all contacts, organizations, and client groups in the tenant. Never call this without first telling the user exactly which field will be deleted (by name, via list_custom_fields) and receiving their explicit confirmation for that specific field.",
      inputSchema: {
        customFieldDefinitionKey: z
          .string()
          .describe("The CustomFieldDefinitionKey to delete (from list_custom_fields)"),
      },
    },
    withErrorHandling(async ({ customFieldDefinitionKey }) => {
      const result = await client.request(
        "DELETE",
        `/CustomFields/${encodeURIComponent(customFieldDefinitionKey)}`,
      );
      return jsonResult(result ?? { success: true, customFieldDefinitionKey });
    }),
  );
}
