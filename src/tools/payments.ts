import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KarbonClient } from "../karbon-client.js";
import { jsonResult, withErrorHandling } from "../tool-helpers.js";

export function registerPaymentTools(
  server: McpServer,
  client: KarbonClient,
  readOnly: boolean,
  allowPaymentWrites: boolean,
) {
  server.registerTool(
    "list_payments",
    {
      title: "List payments",
      description:
        "List payments recorded against invoices in Karbon (read-only). Supports pagination only — the Payments endpoint does not accept OData filters.",
      inputSchema: {
        top: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Max results to return (1-100)"),
        skip: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Number of results to skip, for pagination"),
      },
    },
    withErrorHandling(async ({ top, skip }) => {
      const query: Record<string, string> = {};
      if (top !== undefined) query["$top"] = String(top);
      if (skip !== undefined) query["$skip"] = String(skip);
      return jsonResult(await client.get("/Payments", query));
    }),
  );

  server.registerTool(
    "get_payment",
    {
      title: "Get payment",
      description: "Get a single payment by PaymentKey (read-only).",
      inputSchema: {
        paymentKey: z.string().describe("The Karbon PaymentKey"),
      },
    },
    withErrorHandling(async ({ paymentKey }) =>
      jsonResult(await client.get(`/Payments/${encodeURIComponent(paymentKey)}`)),
    ),
  );

  // Payment writes create, delete, and reverse financial records, so they sit
  // behind their own opt-in (KARBON_ALLOW_PAYMENT_WRITES=true) on top of the
  // read-only gate.
  if (readOnly || !allowPaymentWrites) return;

  server.registerTool(
    "create_manual_payment",
    {
      title: "Create manual payment",
      description:
        "Record a manual payment against an invoice. The amount must be greater than 0 and no more than the invoice's outstanding balance. This creates a financial record — confirm the details with the user before calling.",
      inputSchema: {
        InvoiceKey: z.string().describe("The InvoiceKey of the invoice being paid"),
        PaymentMethod: z.enum([
          "Bank Transfer",
          "Direct Debit",
          "Credit Card Online",
          "Credit Card Office",
          "Check",
          "Cash",
          "Other",
        ]),
        PaymentDate: z
          .string()
          .describe("ISO 8601 date the payment is recorded for, e.g. 2026-07-15"),
        TotalAmount: z
          .number()
          .positive()
          .describe("Payment amount in the invoice's currency"),
        Reference: z.string().optional().describe("Optional payment reference"),
      },
    },
    withErrorHandling(async (args) =>
      jsonResult(await client.post("/ManualPayments", args)),
    ),
  );

  server.registerTool(
    "delete_manual_payment",
    {
      title: "Delete manual payment",
      description:
        "Delete a manual payment by its ManualPaymentKey. This removes a financial record — confirm with the user before calling. Only payments created manually can be deleted.",
      inputSchema: {
        manualPaymentKey: z
          .string()
          .describe("The Karbon ManualPaymentKey to delete"),
      },
    },
    withErrorHandling(async ({ manualPaymentKey }) => {
      const result = await client.request(
        "DELETE",
        `/ManualPayments/${encodeURIComponent(manualPaymentKey)}`,
      );
      return jsonResult(result ?? { success: true, manualPaymentKey });
    }),
  );

  server.registerTool(
    "reverse_manual_payment",
    {
      title: "Reverse manual payment",
      description:
        "Reverse a manual payment, restoring the amount to the invoice's balance. This creates a reversal record rather than deleting the payment — confirm with the user before calling.",
      inputSchema: {
        PaymentKey: z
          .string()
          .describe("The PaymentKey of the manual payment to reverse"),
        ReversalDate: z
          .string()
          .describe("ISO 8601 date-time to record the reversal, e.g. 2026-07-15T00:00:00Z"),
      },
    },
    withErrorHandling(async (args) =>
      jsonResult(await client.post("/ReverseManualPayment", args)),
    ),
  );
}
