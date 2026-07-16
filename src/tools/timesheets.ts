import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KarbonClient, odataQuery } from "../karbon-client.js";
import { jsonResult, listInputSchema, withErrorHandling } from "../tool-helpers.js";

export function registerTimesheetTools(server: McpServer, client: KarbonClient) {
  server.registerTool(
    "list_timesheets",
    {
      title: "List timesheets",
      description:
        "List timesheets (read-only). Useful filters: \"StartDate ge 2026-07-01\", \"UserKey eq '...'\".",
      inputSchema: listInputSchema,
    },
    withErrorHandling(async (args) =>
      jsonResult(await client.get("/Timesheets", odataQuery(args))),
    ),
  );

  server.registerTool(
    "get_timesheet",
    {
      title: "Get timesheet",
      description:
        "Get a single timesheet by TimesheetKey, optionally expanding TimeEntries.",
      inputSchema: {
        timesheetKey: z.string().describe("The Karbon TimesheetKey"),
        expandTimeEntries: z
          .boolean()
          .optional()
          .describe("Include individual time entries"),
      },
    },
    withErrorHandling(async ({ timesheetKey, expandTimeEntries }) =>
      jsonResult(
        await client.get(
          `/Timesheets/${encodeURIComponent(timesheetKey)}`,
          expandTimeEntries ? { $expand: "TimeEntries" } : undefined,
        ),
      ),
    ),
  );

  server.registerTool(
    "list_time_entries",
    {
      title: "List time entries",
      description:
        "List individual time entries (read-only). Useful for reporting on time logged against clients or work items.",
      inputSchema: listInputSchema,
    },
    withErrorHandling(async (args) =>
      jsonResult(await client.get("/IndividualTimeEntries", odataQuery(args))),
    ),
  );

  server.registerTool(
    "get_time_entry",
    {
      title: "Get time entry",
      description:
        "Get a single individual time entry by its IndividualTimeEntryKey (read-only).",
      inputSchema: {
        timeEntryKey: z.string().describe("The Karbon IndividualTimeEntryKey"),
      },
    },
    withErrorHandling(async ({ timeEntryKey }) =>
      jsonResult(
        await client.get(
          `/IndividualTimeEntries/${encodeURIComponent(timeEntryKey)}`,
        ),
      ),
    ),
  );
}
