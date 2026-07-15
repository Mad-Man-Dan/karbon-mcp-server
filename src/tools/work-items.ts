import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KarbonClient, odataQuery } from "../karbon-client.js";
import { jsonResult, listInputSchema, withErrorHandling } from "../tool-helpers.js";

export function registerWorkItemTools(
  server: McpServer,
  client: KarbonClient,
  readOnly: boolean,
) {
  server.registerTool(
    "list_work_items",
    {
      title: "List work items",
      description:
        "List or search work items (jobs/engagements) in Karbon. Useful filters: \"PrimaryStatus eq 'InProgress'\", \"AssigneeEmailAddress eq 'user@firm.com'\", \"DueDate lt 2026-08-01\". PrimaryStatus values: Planned, ReadyToStart, InProgress, Waiting, Completed.",
      inputSchema: listInputSchema,
    },
    withErrorHandling(async (args) =>
      jsonResult(await client.get("/WorkItems", odataQuery(args))),
    ),
  );

  server.registerTool(
    "get_work_item",
    {
      title: "Get work item",
      description: "Get a single work item by WorkItemKey.",
      inputSchema: {
        workItemKey: z.string().describe("The Karbon WorkItemKey"),
      },
    },
    withErrorHandling(async ({ workItemKey }) =>
      jsonResult(
        await client.get(`/WorkItems/${encodeURIComponent(workItemKey)}`),
      ),
    ),
  );

  if (readOnly) return;

  server.registerTool(
    "create_work_item",
    {
      title: "Create work item",
      description:
        "Create a new work item in Karbon. WorkType and status values are tenant-specific — call get_tenant_settings first if unsure.",
      inputSchema: {
        Title: z.string().max(200),
        ClientKey: z
          .string()
          .describe(
            "Key of the client this work is for (ContactKey, OrganizationKey, or ClientGroupKey)",
          ),
        ClientType: z.enum(["Contact", "Organization", "ClientGroup"]),
        AssigneeEmailAddress: z
          .string()
          .describe("Email address of the Karbon user assigned to this work"),
        StartDate: z
          .string()
          .describe("ISO 8601 date or date-time, e.g. 2026-08-01"),
        DueDate: z.string().optional().describe("ISO 8601 date or date-time"),
        DeadlineDate: z.string().optional(),
        WorkType: z
          .string()
          .optional()
          .describe("Tenant-specific work type label, e.g. 'Tax Return'"),
        PrimaryStatus: z
          .enum(["Planned", "ReadyToStart", "InProgress", "Waiting", "Completed"])
          .optional(),
        SecondaryStatus: z
          .string()
          .optional()
          .describe("Tenant-specific status label from get_tenant_settings"),
        WorkTemplateKey: z
          .string()
          .optional()
          .describe("Create from a work template (see list_work_templates)"),
        EstimatedBudget: z.number().optional(),
        Description: z.string().optional(),
      },
    },
    withErrorHandling(async (args) =>
      jsonResult(await client.post("/WorkItems", args)),
    ),
  );

  server.registerTool(
    "update_work_item",
    {
      title: "Update work item",
      description:
        "Update fields on an existing work item (partial update via PATCH). Only include the fields you want to change.",
      inputSchema: {
        workItemKey: z.string().describe("The Karbon WorkItemKey to update"),
        Title: z.string().max(200).optional(),
        Description: z.string().optional(),
        StartDate: z.string().optional().describe("ISO 8601 date or date-time"),
        DueDate: z.string().optional(),
        DeadlineDate: z.string().optional(),
        AssigneeEmailAddress: z
          .string()
          .optional()
          .describe("Must be an existing Karbon user's email"),
        WorkType: z.string().optional(),
      },
    },
    withErrorHandling(async ({ workItemKey, ...fields }) => {
      const result = await client.patch(
        `/WorkItems/${encodeURIComponent(workItemKey)}`,
        fields,
      );
      return jsonResult(result ?? { success: true, workItemKey });
    }),
  );
}
