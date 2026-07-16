import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KarbonClient, odataQuery } from "../karbon-client.js";
import { jsonResult, listInputSchema, withErrorHandling } from "../tool-helpers.js";

export function registerTenantSettingsTools(
  server: McpServer,
  client: KarbonClient,
) {
  server.registerTool(
    "get_tenant_settings",
    {
      title: "Get tenant settings",
      description:
        "Get this Karbon account's configuration: valid work statuses (secondary statuses), work types, and contact types. Call this before creating or updating work items or contacts with tenant-specific values.",
      inputSchema: {},
    },
    withErrorHandling(async () => jsonResult(await client.get("/TenantSettings"))),
  );

  server.registerTool(
    "list_work_templates",
    {
      title: "List work templates",
      description:
        "List work templates available on this account. Use a WorkTemplateKey with create_work_item to create templated work.",
      inputSchema: listInputSchema,
    },
    withErrorHandling(async (args) =>
      jsonResult(await client.get("/WorkTemplates", odataQuery(args))),
    ),
  );

  server.registerTool(
    "get_work_template",
    {
      title: "Get work template",
      description:
        "Get a single work template by WorkTemplateKey, including its task and section structure.",
      inputSchema: {
        workTemplateKey: z.string().describe("The Karbon WorkTemplateKey"),
      },
    },
    withErrorHandling(async ({ workTemplateKey }) =>
      jsonResult(
        await client.get(`/WorkTemplates/${encodeURIComponent(workTemplateKey)}`),
      ),
    ),
  );
}
