import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { KarbonClient } from "./karbon-client.js";
import { registerContactTools } from "./tools/contacts.js";
import { registerOrganizationTools } from "./tools/organizations.js";
import { registerWorkItemTools } from "./tools/work-items.js";
import { registerNoteTools } from "./tools/notes.js";
import { registerTimesheetTools } from "./tools/timesheets.js";
import { registerUserTools } from "./tools/users.js";
import { registerTenantSettingsTools } from "./tools/tenant-settings.js";
import { registerClientGroupTools } from "./tools/client-groups.js";
import { registerInvoiceTools } from "./tools/invoices.js";
import { registerBusinessCardTools } from "./tools/business-cards.js";
import { registerCustomFieldTools } from "./tools/custom-fields.js";
import { registerPaymentTools } from "./tools/payments.js";
import { registerTeamTools } from "./tools/teams.js";
import { registerFileTools } from "./tools/files.js";
import { registerWorkScheduleTools } from "./tools/work-schedules.js";

export interface ServerConfig {
  bearerToken: string;
  accessKey: string;
  readOnly: boolean;
  /** Payment writes are financial records, so they need their own opt-in. */
  allowPaymentWrites?: boolean;
  baseUrl?: string;
}

export function createServer(config: ServerConfig): McpServer {
  const server = new McpServer({
    name: "karbon-mcp-server",
    version: "0.2.4",
  });

  const client = new KarbonClient(
    config.bearerToken,
    config.accessKey,
    config.baseUrl,
  );

  registerContactTools(server, client, config.readOnly);
  registerOrganizationTools(server, client, config.readOnly);
  registerClientGroupTools(server, client, config.readOnly);
  registerWorkItemTools(server, client, config.readOnly);
  registerNoteTools(server, client, config.readOnly);
  registerTimesheetTools(server, client);
  registerInvoiceTools(server, client);
  registerPaymentTools(
    server,
    client,
    config.readOnly,
    config.allowPaymentWrites ?? false,
  );
  registerTeamTools(server, client, config.readOnly);
  registerFileTools(server, client, config.readOnly);
  registerWorkScheduleTools(server, client, config.readOnly);
  registerBusinessCardTools(server, client, config.readOnly);
  registerCustomFieldTools(server, client, config.readOnly);
  registerUserTools(server, client);
  registerTenantSettingsTools(server, client);

  return server;
}
