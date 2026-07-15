import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { KarbonClient } from "./karbon-client.js";
import { registerContactTools } from "./tools/contacts.js";
import { registerOrganizationTools } from "./tools/organizations.js";
import { registerWorkItemTools } from "./tools/work-items.js";
import { registerNoteTools } from "./tools/notes.js";
import { registerTimesheetTools } from "./tools/timesheets.js";
import { registerUserTools } from "./tools/users.js";
import { registerTenantSettingsTools } from "./tools/tenant-settings.js";

export interface ServerConfig {
  bearerToken: string;
  accessKey: string;
  readOnly: boolean;
  baseUrl?: string;
}

export function createServer(config: ServerConfig): McpServer {
  const server = new McpServer({
    name: "karbon-mcp-server",
    version: "0.1.0",
  });

  const client = new KarbonClient(
    config.bearerToken,
    config.accessKey,
    config.baseUrl,
  );

  registerContactTools(server, client, config.readOnly);
  registerOrganizationTools(server, client, config.readOnly);
  registerWorkItemTools(server, client, config.readOnly);
  registerNoteTools(server, client, config.readOnly);
  registerTimesheetTools(server, client);
  registerUserTools(server, client);
  registerTenantSettingsTools(server, client);

  return server;
}
