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
}
