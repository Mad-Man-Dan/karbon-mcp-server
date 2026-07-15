import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KarbonClient } from "../karbon-client.js";
import { jsonResult, withErrorHandling } from "../tool-helpers.js";

export function registerNoteTools(
  server: McpServer,
  client: KarbonClient,
  readOnly: boolean,
) {
  server.registerTool(
    "get_note",
    {
      title: "Get note",
      description: "Get a single note by its NoteID.",
      inputSchema: {
        noteId: z.string().describe("The Karbon NoteID"),
      },
    },
    withErrorHandling(async ({ noteId }) =>
      jsonResult(await client.get(`/Notes/${encodeURIComponent(noteId)}`)),
    ),
  );

  if (readOnly) return;

  server.registerTool(
    "create_note",
    {
      title: "Create note",
      description:
        "Create a note in Karbon, optionally linked to work items, contacts, organizations, or client groups via timelines. Notes linked to a work item also appear on the client's timeline.",
      inputSchema: {
        Subject: z.string(),
        Body: z.string().describe("Note body (supports basic HTML)"),
        AuthorEmailAddress: z
          .string()
          .describe("Email address of the Karbon user authoring the note"),
        AssigneeEmailAddress: z
          .string()
          .optional()
          .describe("Assign the note as a to-do for this Karbon user"),
        DueDate: z.string().optional().describe("ISO 8601 date"),
        TodoDate: z.string().optional().describe("ISO 8601 date"),
        Timelines: z
          .array(
            z.object({
              EntityType: z.enum([
                "WorkItem",
                "Contact",
                "Organization",
                "ClientGroup",
              ]),
              EntityKey: z.string(),
            }),
          )
          .optional()
          .describe("Entities to link this note to"),
      },
    },
    withErrorHandling(async (args) =>
      jsonResult(await client.post("/Notes", args)),
    ),
  );
}
