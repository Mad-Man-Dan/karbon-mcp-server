import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KarbonClient } from "../karbon-client.js";
import { jsonResult, withErrorHandling } from "../tool-helpers.js";

export function registerWorkScheduleTools(
  server: McpServer,
  client: KarbonClient,
  readOnly: boolean,
) {
  server.registerTool(
    "get_work_schedule",
    {
      title: "Get work schedule",
      description:
        "Get a recurring work schedule by WorkScheduleKey — the recurrence rules that automatically generate work items.",
      inputSchema: {
        workScheduleKey: z.string().describe("The Karbon WorkScheduleKey"),
      },
    },
    withErrorHandling(async ({ workScheduleKey }) =>
      jsonResult(
        await client.get(`/WorkSchedules/${encodeURIComponent(workScheduleKey)}`),
      ),
    ),
  );

  if (readOnly) return;

  server.registerTool(
    "create_work_schedule",
    {
      title: "Create work schedule",
      description:
        "Create a recurring work schedule from an existing work item. The schedule will automatically generate new work items on the recurrence you set — confirm the recurrence details with the user before calling. Note: RecurrenceFrequency cannot be changed after creation.",
      inputSchema: {
        CreatedFromWorkItemKey: z
          .string()
          .describe("The WorkItemKey the schedule is created from"),
        RecurrenceFrequency: z.enum([
          "Day",
          "Week",
          "SemiMonth",
          "Fortnight",
          "Month",
          "Quarter",
          "Year",
          "Custom",
        ]),
        CustomFrequencyUnits: z
          .enum(["Days", "Weeks", "Months", "Years"])
          .optional()
          .describe("Only when RecurrenceFrequency is Custom"),
        CustomFrequencyMultiple: z
          .number()
          .int()
          .describe("Multiple of the frequency unit; use 1 unless RecurrenceFrequency is Custom"),
        ScheduleStartDate: z.string().describe("ISO 8601 date the schedule starts"),
        ScheduleEndDate: z
          .string()
          .optional()
          .describe("ISO 8601 date the schedule stops; omit to run forever"),
        ScheduleDueDateMethod: z.enum([
          "DaysFromStartDate",
          "DayOfMonth",
          "LastDayOfMonth",
          "DayOfNextMonth",
          "DayOfSubsequentMonth",
          "NoDueDate",
        ]),
        ScheduleDueDateDays: z
          .number()
          .int()
          .optional()
          .describe("The day count for the due date method (not used with LastDayOfMonth/NoDueDate)"),
        ScheduleDueDateMonthMultiple: z
          .number()
          .int()
          .optional()
          .describe("Only with DayOfSubsequentMonth: how many months later"),
        PreventStartEndOnWeekend: z
          .boolean()
          .describe("If true, generated work items never start on a weekend"),
        InitializeBeforeStartDateUnits: z
          .enum(["Days", "Weeks", "Months", "Years"])
          .optional()
          .describe("Create the work item this long before its start date"),
        InitializeBeforeStartDateMultiple: z.number().int().optional(),
        InitializeTasksBeforeStartDateUnits: z
          .enum(["Days", "Weeks", "Months", "Years"])
          .describe("Create the work item's tasks/budget this long before its start date"),
        InitializeTasksBeforeStartDateMultiple: z.number().int(),
        WorkItemTitleDefinition: z
          .string()
          .describe(
            "Title format for generated work items; supports Karbon title tokens (e.g. period/date placeholders)",
          ),
        AssigneeUserKey: z
          .string()
          .optional()
          .describe("UserKey to assign generated work items to"),
      },
    },
    withErrorHandling(async (args) =>
      jsonResult(await client.post("/WorkSchedules", args)),
    ),
  );

  server.registerTool(
    "update_work_schedule",
    {
      title: "Update work schedule",
      description:
        "Update a work schedule (partial via PATCH). The API only supports changing the end date and the assignee here. Note: changing AssigneeUserKey reassigns every not-yet-started work item the schedule has generated — confirm with the user first.",
      inputSchema: {
        workScheduleKey: z.string().describe("The Karbon WorkScheduleKey to update"),
        ScheduleEndDate: z
          .string()
          .nullable()
          .optional()
          .describe("ISO 8601 date to stop the schedule; pass null to clear the end date (run forever)"),
        AssigneeUserKey: z.string().optional(),
      },
    },
    withErrorHandling(async ({ workScheduleKey, ...fields }) => {
      const result = await client.patch(
        `/WorkSchedules/${encodeURIComponent(workScheduleKey)}`,
        fields,
      );
      return jsonResult(result ?? { success: true, workScheduleKey });
    }),
  );
}
