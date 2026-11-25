export type McpSelfProfile = {
  protocolVersion: string;
  serverInfo: { name: string; version: string; title?: string };
  tools: Array<{ name: string; title?: string; readOnlyHint?: boolean }>;
};

export type McpAuthMode =
  | 'public-zero-auth'
  | 'oauth2-rfc9728'
  | 'bearer-or-api-key'
  | 'endpoint-not-found'
  | 'method-not-allowed'
  | 'non-mcp-response'
  | 'network-error';

export type McpInspectionResult = {
  targetUrl: string;
  reachable: boolean;
  httpStatus: number | null;
  contentType: string | null;
  latencyMs: number;
  authMode: McpAuthMode;
  protocolVersion: string | null;
  serverInfo: { name?: string; version?: string; title?: string } | null;
  capabilities: string[];
  toolCount: number | null;
  toolsPreview: Array<{ name: string; title?: string; readOnlyHint?: boolean }>;
  oauthMetadata: {
    resourceMetadataUrl: string | null;
    authorizationServers: string[];
    scopesSupported: string[];
  } | null;
  diagnostics: string[];
  checkedAt: string;
};

const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /\.localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /\.home\.arpa$/i,
  /^metadata\.google\.internal$/i,
  /^169\.254\.169\.254$/,
];

const IPV4_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;
const NUMERIC_HOST_PATTERN = /^(0x[0-9a-f]+|\d+)$/i;

export function validatePublicHttpsUrl(rawInput: string): URL {
  const trimmed = rawInput.trim();
  if (!trimmed || trimmed.length > 300) {
    throw new Error('Provide a valid public HTTPS URL (<=300 chars).');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Invalid URL format. Include https:// (e.g. https://mcp.batchdata.com/).');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('Only public HTTPS endpoints are supported.');
  }

  if (parsed.username || parsed.password) {
    throw new Error('URLs with embedded credentials are not allowed.');
  }

  if (parsed.port && parsed.port !== '443') {
    throw new Error('Only standard HTTPS port 443 is supported.');
  }

  const host = parsed.hostname.toLowerCase();
  if (
    !host ||
    !host.includes('.') ||
    host.includes(':') ||
    host.startsWith('[') ||
    IPV4_PATTERN.test(host) ||
    NUMERIC_HOST_PATTERN.test(host) ||
    BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(host))
  ) {
    throw new Error('Private, loopback, link-local, or raw IP targets are blocked for security.');
  }

  return parsed;
}

async function readBoundedText(response: Response, maxBytes = 65536): Promise<string> {
  if (!response.body) {
    return (await response.text()).slice(0, maxBytes);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let collected = '';
  let bytesRead = 0;

  try {
    while (bytesRead < maxBytes) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        const remaining = maxBytes - bytesRead;
        const slice = value.byteLength > remaining ? value.subarray(0, remaining) : value;
        bytesRead += slice.byteLength;
        collected += decoder.decode(slice, { stream: true });
      }
    }
  } finally {
    reader.cancel().catch(() => undefined);
  }

  return collected + decoder.decode();
}

export function parseJsonRpcPayload(rawText: string, contentType: string | null): Record<string, unknown> | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  if ((contentType || '').toLowerCase().includes('text/event-stream') || trimmed.startsWith('event:') || trimmed.startsWith('data:')) {
    const dataLines = trimmed
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);

    for (const candidate of dataLines) {
      try {
        const parsed = JSON.parse(candidate);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        // continue scanning SSE events
      }
    }
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function extractResourceMetadataUrl(wwwAuthenticate: string | null, targetOrigin: string): string {
  if (wwwAuthenticate) {
    const match = wwwAuthenticate.match(/resource_metadata="([^"]+)"/i);
    if (match?.[1]) {
      return match[1];
    }
  }
  return `${targetOrigin}/.well-known/oauth-protected-resource`;
}

export async function inspectMcpEndpoint(
  rawUrl: string,
  options?: {
    fetchImpl?: typeof fetch;
    selfProfile?: McpSelfProfile;
  },
): Promise<McpInspectionResult> {
  const fetchImpl = options?.fetchImpl || fetch;
  const selfProfile = options?.selfProfile;
  const parsedUrl = validatePublicHttpsUrl(rawUrl);
  const checkedAt = new Date().toISOString();

  // Avoid recursive Cloudflare Worker self-fetch loops when inspecting AIWget itself
  if (
    selfProfile &&
    (parsedUrl.hostname === 'aiwget.com' || parsedUrl.hostname === 'www.aiwget.com') &&
    parsedUrl.pathname.replace(/\/$/, '') === '/api/mcp'
  ) {
    return {
      targetUrl: parsedUrl.toString(),
      reachable: true,
      httpStatus: 200,
      contentType: 'application/json',
      latencyMs: 1,
      authMode: 'public-zero-auth',
      protocolVersion: selfProfile.protocolVersion,
      serverInfo: selfProfile.serverInfo,
      capabilities: ['tools'],
      toolCount: selfProfile.tools.length,
      toolsPreview: selfProfile.tools,
      oauthMetadata: null,
      diagnostics: [
        'Self-inspection succeeded directly against live AIWget MCP runtime.',
        `Streamable HTTP (${selfProfile.protocolVersion}) zero-auth read-only endpoint exposes ${selfProfile.tools.length} typed tools.`,
      ],
      checkedAt,
    };
  }

  const diagnostics: string[] = [];
  const startedAt = Date.now();

  let initRes: Response;
  try {
    initRes = await fetchImpl(parsedUrl.toString(), {
      method: 'POST',
      redirect: 'manual',
      signal: AbortSignal.timeout(4500),
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'User-Agent': 'AIWget-MCP-Inspector/2.0 (+https://aiwget.com/mcp)',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: selfProfile?.protocolVersion || '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'aiwget-mcp-inspector', version: '2.0.0' },
        },
      }),
    });
  } catch (error: unknown) {
    const latencyMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : 'Network request failed';
    return {
      targetUrl: parsedUrl.toString(),
      reachable: false,
      httpStatus: null,
      contentType: null,
      latencyMs,
      authMode: 'network-error',
      protocolVersion: null,
      serverInfo: null,
      capabilities: [],
      toolCount: null,
      toolsPreview: [],
      oauthMetadata: null,
      diagnostics: [`Connection failed or timed out after ${latencyMs}ms: ${message}`],
      checkedAt,
    };
  }

  const latencyMs = Date.now() - startedAt;
  const contentType = initRes.headers.get('content-type');
  const httpStatus = initRes.status;

  if (httpStatus >= 300 && httpStatus < 400) {
    const location = initRes.headers.get('location') || '(missing Location header)';
    return {
      targetUrl: parsedUrl.toString(),
      reachable: true,
      httpStatus,
      contentType,
      latencyMs,
      authMode: 'non-mcp-response',
      protocolVersion: null,
      serverInfo: null,
      capabilities: [],
      toolCount: null,
      toolsPreview: [],
      oauthMetadata: null,
      diagnostics: [
        `Endpoint returned HTTP ${httpStatus} redirect to ${location}. Streamable HTTP MCP clients expect direct JSON-RPC responses at the canonical endpoint URL.`,
      ],
      checkedAt,
    };
  }

  if (httpStatus === 404) {
    return {
      targetUrl: parsedUrl.toString(),
      reachable: true,
      httpStatus,
      contentType,
      latencyMs,
      authMode: 'endpoint-not-found',
      protocolVersion: null,
      serverInfo: null,
      capabilities: [],
      toolCount: null,
      toolsPreview: [],
      oauthMetadata: null,
      diagnostics: ['Endpoint returned HTTP 404 Not Found. Verify the exact Streamable HTTP MCP route path.'],
      checkedAt,
    };
  }

  if (httpStatus === 405) {
    return {
      targetUrl: parsedUrl.toString(),
      reachable: true,
      httpStatus,
      contentType,
      latencyMs,
      authMode: 'method-not-allowed',
      protocolVersion: null,
      serverInfo: null,
      capabilities: [],
      toolCount: null,
      toolsPreview: [],
      oauthMetadata: null,
      diagnostics: [
        'Endpoint returned HTTP 405 Method Not Allowed on POST initialize. It may be a legacy SSE-only endpoint or a non-MCP web route.',
      ],
      checkedAt,
    };
  }

  if (httpStatus === 401 || httpStatus === 403) {
    const wwwAuth = initRes.headers.get('www-authenticate');
    const candidateMetadataUrl = extractResourceMetadataUrl(wwwAuth, parsedUrl.origin);
    let oauthMetadata: McpInspectionResult['oauthMetadata'] = null;
    let authMode: McpAuthMode = 'bearer-or-api-key';

    if (wwwAuth) {
      diagnostics.push(`WWW-Authenticate header present: ${wwwAuth.slice(0, 180)}`);
    } else {
      diagnostics.push(`HTTP ${httpStatus} returned without a WWW-Authenticate header.`);
    }

    try {
      const validatedMetaUrl = validatePublicHttpsUrl(candidateMetadataUrl);
      const metaRes = await fetchImpl(validatedMetaUrl.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(3500),
        headers: {
          Accept: 'application/json',
          'User-Agent': 'AIWget-MCP-Inspector/2.0 (+https://aiwget.com/mcp)',
        },
      });
      if (metaRes.ok) {
        const metaText = await readBoundedText(metaRes, 32768);
        const metaJson = JSON.parse(metaText) as Record<string, unknown>;
        const authorizationServers = Array.isArray(metaJson.authorization_servers)
          ? metaJson.authorization_servers.filter((item): item is string => typeof item === 'string').slice(0, 5)
          : [];
        const scopesSupported = Array.isArray(metaJson.scopes_supported)
          ? metaJson.scopes_supported.filter((item): item is string => typeof item === 'string').slice(0, 10)
          : [];
        oauthMetadata = {
          resourceMetadataUrl: validatedMetaUrl.toString(),
          authorizationServers,
          scopesSupported,
        };
        authMode = 'oauth2-rfc9728';
        diagnostics.push(
          `RFC 9728 OAuth Protected Resource metadata verified at ${validatedMetaUrl.toString()} (${authorizationServers.length} auth server(s)).`,
        );
      } else {
        diagnostics.push(
          `RFC 9728 metadata probe (${validatedMetaUrl.pathname}) returned HTTP ${metaRes.status}; endpoint likely requires a static API key or Bearer token.`,
        );
      }
    } catch {
      diagnostics.push('RFC 9728 metadata discovery was unavailable; endpoint appears to require manual Bearer/API key auth.');
    }

    return {
      targetUrl: parsedUrl.toString(),
      reachable: true,
      httpStatus,
      contentType,
      latencyMs,
      authMode,
      protocolVersion: null,
      serverInfo: null,
      capabilities: [],
      toolCount: null,
      toolsPreview: [],
      oauthMetadata,
      diagnostics,
      checkedAt,
    };
  }

  const rawBody = await readBoundedText(initRes);
  const rpc = parseJsonRpcPayload(rawBody, contentType);
  const resultObj = rpc && typeof rpc.result === 'object' && rpc.result !== null ? (rpc.result as Record<string, unknown>) : null;

  if (!initRes.ok || !resultObj || typeof resultObj.protocolVersion !== 'string') {
    diagnostics.push(
      `HTTP ${httpStatus} (${contentType || 'unknown content-type'}) did not return a valid MCP JSON-RPC initialize result.`,
    );
    return {
      targetUrl: parsedUrl.toString(),
      reachable: true,
      httpStatus,
      contentType,
      latencyMs,
      authMode: 'non-mcp-response',
      protocolVersion: null,
      serverInfo: null,
      capabilities: [],
      toolCount: null,
      toolsPreview: [],
      oauthMetadata: null,
      diagnostics,
      checkedAt,
    };
  }

  const protocolVersion = resultObj.protocolVersion;
  const rawServerInfo =
    resultObj.serverInfo && typeof resultObj.serverInfo === 'object'
      ? (resultObj.serverInfo as Record<string, unknown>)
      : null;
  const serverInfo = rawServerInfo
    ? {
        name: typeof rawServerInfo.name === 'string' ? rawServerInfo.name : undefined,
        version: typeof rawServerInfo.version === 'string' ? rawServerInfo.version : undefined,
        title: typeof rawServerInfo.title === 'string' ? rawServerInfo.title : undefined,
      }
    : null;
  const capabilities =
    resultObj.capabilities && typeof resultObj.capabilities === 'object'
      ? Object.keys(resultObj.capabilities as Record<string, unknown>)
      : [];

  diagnostics.push(`Streamable HTTP initialize succeeded (${protocolVersion}) in ${latencyMs}ms.`);

  // Follow up with tools/list to enumerate real exposed tools
  let toolCount: number | null = null;
  let toolsPreview: McpInspectionResult['toolsPreview'] = [];
  const sessionId = initRes.headers.get('mcp-session-id');

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'User-Agent': 'AIWget-MCP-Inspector/2.0 (+https://aiwget.com/mcp)',
    };
    if (sessionId) {
      headers['Mcp-Session-Id'] = sessionId;
    }

    const listRes = await fetchImpl(parsedUrl.toString(), {
      method: 'POST',
      redirect: 'manual',
      signal: AbortSignal.timeout(4000),
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      }),
    });

    if (listRes.ok) {
      const listRaw = await readBoundedText(listRes);
      const listRpc = parseJsonRpcPayload(listRaw, listRes.headers.get('content-type'));
      const listResult =
        listRpc && typeof listRpc.result === 'object' && listRpc.result !== null
          ? (listRpc.result as Record<string, unknown>)
          : null;
      if (listResult && Array.isArray(listResult.tools)) {
        toolCount = listResult.tools.length;
        toolsPreview = listResult.tools.slice(0, 15).map((item) => {
          const obj = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
          const ann =
            obj.annotations && typeof obj.annotations === 'object'
              ? (obj.annotations as Record<string, unknown>)
              : null;
          return {
            name: typeof obj.name === 'string' ? obj.name : 'unknown',
            title: typeof obj.title === 'string' ? obj.title : undefined,
            readOnlyHint: typeof ann?.readOnlyHint === 'boolean' ? ann.readOnlyHint : undefined,
          };
        });
        diagnostics.push(`Enumerated ${toolCount} tool(s) via tools/list without authentication.`);
      }
    } else {
      diagnostics.push(`tools/list returned HTTP ${listRes.status} (server may require initialized notification or auth for tool listing).`);
    }
  } catch {
    diagnostics.push('tools/list follow-up request timed out or failed.');
  }

  return {
    targetUrl: parsedUrl.toString(),
    reachable: true,
    httpStatus,
    contentType,
    latencyMs,
    authMode: 'public-zero-auth',
    protocolVersion,
    serverInfo,
    capabilities,
    toolCount,
    toolsPreview,
    oauthMetadata: null,
    diagnostics,
    checkedAt,
  };
}
