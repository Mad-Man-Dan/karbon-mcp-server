import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KarbonClient, odataQuery } from "../karbon-client.js";
import { jsonResult, listInputSchema, withErrorHandling } from "../tool-helpers.js";

export function registerInvoiceTools(server: McpServer, client: KarbonClient) {
  server.registerTool(
    "list_invoices",
    {
      title: "List invoices",
      description:
        "List invoices in Karbon (read-only). Supports OData filtering, e.g. filter: \"InvoiceStatus eq 'AwaitingPayment'\" or \"TotalAmountDue gt 0\". Statuses: Approved, AwaitingPayment, Paid, Exported, Voided.",
      inputSchema: listInputSchema,
    },
    withErrorHandling(async (args) =>
      jsonResult(await client.get("/Invoices", odataQuery(args))),
    ),
  );

  server.registerTool(
    "get_invoice",
    {
      title: "Get invoice",
      description:
        "Get a single invoice by InvoiceKey (read-only), optionally expanding related data (LineItems, Payments, Data).",
      inputSchema: {
        invoiceKey: z.string().describe("The Karbon InvoiceKey"),
        expand: z
          .string()
          .optional()
          .describe(
            "Comma-separated related data to include: LineItems, Payments, Data",
          ),
      },
    },
    withErrorHandling(async ({ invoiceKey, expand }) =>
      jsonResult(
        await client.get(
          `/Invoices/${encodeURIComponent(invoiceKey)}`,
          expand ? { $expand: expand } : undefined,
        ),
      ),
    ),
  );
}
