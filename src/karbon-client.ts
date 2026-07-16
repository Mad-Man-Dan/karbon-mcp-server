/**
 * Minimal HTTP client for the Karbon v3 API.
 * Docs: https://karbonhq.github.io/karbon-api-reference/
 *
 * Every request needs two headers, both issued from
 * Karbon → Settings → Connected Apps → API Applications:
 *   Authorization: Bearer {token}
 *   AccessKey: {jwt}
 */

const DEFAULT_BASE_URL = "https://api.karbonhq.com/v3";
const MAX_RETRIES = 3;

/** Placeholder values written by `karbon-mcp-server setup` and the install badges. */
export const PLACEHOLDER_BEARER = "YOUR_BEARER_TOKEN";
export const PLACEHOLDER_ACCESS_KEY = "YOUR_ACCESS_KEY";

export function credentialsNotConfigured(
  bearerToken: string,
  accessKey: string,
): boolean {
  const isPlaceholder = (value: string) =>
    !value || value.startsWith("YOUR_") || value.startsWith("PASTE_");
  return isPlaceholder(bearerToken) || isPlaceholder(accessKey);
}

const SETUP_HINT =
  "Karbon credentials are not configured yet — the server was started with placeholder " +
  "(or missing) values. To fix this, tell the user to: (1) get their Bearer Token and " +
  "Access Key from Karbon → Settings → Connected Apps → API Applications, (2) open their " +
  "MCP client's config file and replace YOUR_BEARER_TOKEN and YOUR_ACCESS_KEY with the " +
  "real values, and (3) restart the client. No Karbon data can be accessed until then.";

export class KarbonApiError extends Error {
  constructor(
    public status: number,
    public body: string,
    message?: string,
  ) {
    super(message ?? `Karbon API error ${status}: ${body}`);
    this.name = "KarbonApiError";
  }
}

/** OData query options supported by Karbon list endpoints. */
export interface ODataParams {
  filter?: string;
  orderby?: string;
  top?: number;
  skip?: number;
  expand?: string;
  select?: string;
}

export function odataQuery(params: ODataParams): Record<string, string> {
  const query: Record<string, string> = {};
  if (params.filter) query["$filter"] = params.filter;
  if (params.orderby) query["$orderby"] = params.orderby;
  if (params.top !== undefined) query["$top"] = String(params.top);
  if (params.skip !== undefined) query["$skip"] = String(params.skip);
  if (params.expand) query["$expand"] = params.expand;
  if (params.select) query["$select"] = params.select;
  return query;
}

export class KarbonClient {
  private baseUrl: string;

  constructor(
    private bearerToken: string,
    private accessKey: string,
    baseUrl?: string,
  ) {
    this.baseUrl = (baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  }

  async request<T = unknown>(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    path: string,
    options: { query?: Record<string, string>; body?: unknown } = {},
  ): Promise<T> {
    if (credentialsNotConfigured(this.bearerToken, this.accessKey)) {
      throw new Error(SETUP_HINT);
    }
    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      url.searchParams.set(key, value);
    }

    for (let attempt = 0; ; attempt++) {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.bearerToken}`,
          AccessKey: this.accessKey,
          Accept: "application/json",
          ...(options.body !== undefined
            ? { "Content-Type": "application/json" }
            : {}),
        },
        body:
          options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });

      if (response.status === 429 && attempt < MAX_RETRIES) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? "2");
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(retryAfter, 30) * 1000),
        );
        continue;
      }

      const text = await response.text();
      if (!response.ok) {
        throw new KarbonApiError(response.status, text);
      }
      if (!text) return undefined as T;
      return JSON.parse(text) as T;
    }
  }

  /** Upload via multipart/form-data (the Files endpoint is not JSON). */
  async postMultipart<T = unknown>(path: string, form: FormData): Promise<T> {
    if (credentialsNotConfigured(this.bearerToken, this.accessKey)) {
      throw new Error(SETUP_HINT);
    }
    const response = await fetch(this.baseUrl + path, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        AccessKey: this.accessKey,
        Accept: "application/json",
      },
      body: form,
    });
    const text = await response.text();
    if (!response.ok) throw new KarbonApiError(response.status, text);
    return text ? (JSON.parse(text) as T) : (undefined as T);
  }

  /**
   * Download binary content (file downloads return octet-stream, not JSON).
   * Accepts an API path or the absolute DownloadUrl the FileList endpoint returns.
   */
  async getBinary(pathOrUrl: string): Promise<ArrayBuffer> {
    if (credentialsNotConfigured(this.bearerToken, this.accessKey)) {
      throw new Error(SETUP_HINT);
    }
    const url = pathOrUrl.startsWith("http")
      ? pathOrUrl
      : this.baseUrl + pathOrUrl;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        AccessKey: this.accessKey,
      },
    });
    if (!response.ok) {
      throw new KarbonApiError(response.status, await response.text());
    }
    return response.arrayBuffer();
  }

  get<T = unknown>(path: string, query?: Record<string, string>) {
    return this.request<T>("GET", path, { query });
  }

  post<T = unknown>(path: string, body: unknown) {
    return this.request<T>("POST", path, { body });
  }

  put<T = unknown>(path: string, body: unknown) {
    return this.request<T>("PUT", path, { body });
  }

  patch<T = unknown>(path: string, body: unknown) {
    return this.request<T>("PATCH", path, { body });
  }
}
