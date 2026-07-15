import { z } from "zod";
import { KarbonApiError } from "./karbon-client.js";

/** Shared OData input schema for list tools. */
export const listInputSchema = {
  filter: z
    .string()
    .optional()
    .describe(
      "OData $filter expression, e.g. \"contains(FullName,'Smith')\" or \"PrimaryStatus eq 'InProgress'\". Operators: eq, ne, gt, ge, lt, le, and, or, contains().",
    ),
  orderby: z
    .string()
    .optional()
    .describe('OData $orderby, e.g. "LastModifiedDateTime desc"'),
  top: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Max results to return (1-100, default 100)"),
  skip: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Number of results to skip, for pagination"),
};

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

export function jsonResult(data: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * Wrap a tool handler so Karbon API errors come back as readable tool
 * errors instead of crashing the request.
 */
export function withErrorHandling<Args>(
  handler: (args: Args) => Promise<ToolResult>,
): (args: Args) => Promise<ToolResult> {
  return async (args: Args) => {
    try {
      return await handler(args);
    } catch (error) {
      if (error instanceof KarbonApiError) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Karbon API error (HTTP ${error.status}): ${error.body}`,
            },
          ],
        };
      }
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  };
}
