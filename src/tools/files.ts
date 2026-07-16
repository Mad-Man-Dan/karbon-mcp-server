import fs from "node:fs";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KarbonClient } from "../karbon-client.js";
import { jsonResult, withErrorHandling } from "../tool-helpers.js";

export function registerFileTools(
  server: McpServer,
  client: KarbonClient,
  readOnly: boolean,
) {
  server.registerTool(
    "list_entity_files",
    {
      title: "List files on an entity",
      description:
        "List the files attached to a work item, contact, or organization — name, size, mime type, created date, and a DownloadUrl usable with download_file. Download links expire 15 minutes after this call.",
      inputSchema: {
        entityType: z.enum(["WorkItem", "Contact", "Organization"]),
        entityKey: z.string().describe("The key of the entity to list files for"),
      },
    },
    withErrorHandling(async ({ entityType, entityKey }) =>
      jsonResult(
        await client.get(`/FileList/${entityType}`, { EntityKey: entityKey }),
      ),
    ),
  );

  server.registerTool(
    "download_file",
    {
      title: "Download a file",
      description:
        "Download a Karbon file to a local path on the machine running this MCP server. Get the DownloadUrl from list_entity_files first — download links expire after 15 minutes, so re-list if the download fails with an auth error. Ask the user where to save before writing outside a temp directory.",
      inputSchema: {
        downloadUrl: z
          .string()
          .describe("The DownloadUrl returned by list_entity_files"),
        savePath: z
          .string()
          .describe(
            "Absolute local file path to save to, including the file name",
          ),
      },
    },
    withErrorHandling(async ({ downloadUrl, savePath }) => {
      const data = await client.getBinary(downloadUrl);
      fs.mkdirSync(path.dirname(savePath), { recursive: true });
      fs.writeFileSync(savePath, Buffer.from(data));
      return jsonResult({ success: true, savePath, bytes: data.byteLength });
    }),
  );

  if (readOnly) return;

  server.registerTool(
    "upload_file",
    {
      title: "Upload a file",
      description:
        "Upload a file to Karbon and attach it to a work item, contact, organization, or client group (at least one key is required). " +
        "SIZE LIMITS: keep uploads small — Karbon rejects oversized uploads, and this server reads the whole file into memory. " +
        "Prefer filePath (a path on the machine running this MCP server) whenever possible; only use contentBase64 for small files (roughly under 1 MB), " +
        "because base64 inflates data ~33% and large payloads can exceed the AI client's message limits or be truncated mid-transfer. " +
        "If a file seems large (tens of MB or more), tell the user to upload it through Karbon's own UI instead.",
      inputSchema: {
        filePath: z
          .string()
          .optional()
          .describe(
            "Absolute path of the file on the machine running this MCP server (preferred)",
          ),
        contentBase64: z
          .string()
          .optional()
          .describe(
            "Base64-encoded file content — small files only; requires fileName",
          ),
        fileName: z
          .string()
          .optional()
          .describe(
            "File name including extension. Required with contentBase64; defaults to the filePath basename otherwise.",
          ),
        workItemKey: z.string().optional(),
        contactKey: z.string().optional(),
        organizationKey: z.string().optional(),
        clientGroupKey: z.string().optional(),
      },
    },
    withErrorHandling(
      async ({
        filePath,
        contentBase64,
        fileName,
        workItemKey,
        contactKey,
        organizationKey,
        clientGroupKey,
      }) => {
        if (!workItemKey && !contactKey && !organizationKey && !clientGroupKey) {
          throw new Error(
            "Provide at least one of workItemKey, contactKey, organizationKey, or clientGroupKey to attach the file to.",
          );
        }
        let buffer: Buffer;
        let name: string;
        if (filePath) {
          buffer = fs.readFileSync(filePath);
          name = fileName ?? path.basename(filePath);
        } else if (contentBase64) {
          if (!fileName) {
            throw new Error("fileName is required when using contentBase64.");
          }
          buffer = Buffer.from(contentBase64, "base64");
          name = fileName;
        } else {
          throw new Error("Provide filePath or contentBase64.");
        }

        const form = new FormData();
        form.append("file", new Blob([new Uint8Array(buffer)]), name);
        if (workItemKey) form.append("workitem_keys", workItemKey);
        if (contactKey) form.append("contact_keys", contactKey);
        if (organizationKey) form.append("organization_keys", organizationKey);
        if (clientGroupKey) form.append("client_group_keys", clientGroupKey);

        const result = await client.postMultipart("/Files", form);
        return jsonResult(result ?? { success: true, fileName: name });
      },
    ),
  );
}
