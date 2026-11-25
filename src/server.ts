export const MCP_PROTOCOL_VERSION = '2025-03-26';

export const MCP_SERVER_INFO = {
  name: 'aiwget-mcp',
  version: '2.0.0',
  title: 'AIWget MCP Protocol Inspector, API TCO & Authority Server',
};

export type McpToolSummary = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
  };
};

export const MCP_TOOLS: McpToolSummary[] = [
  {
    name: 'inspect_mcp_endpoint',
    title: 'Inspect Remote MCP Endpoint (Streamable HTTP & RFC 9728)',
    description:
      'Run a live, SSRF-hardened Streamable HTTP JSON-RPC initialize handshake, RFC 9728 OAuth 2.1 metadata discovery probe, and zero-auth tools/list audit against any public HTTPS MCP endpoint.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'Public HTTPS MCP endpoint URL (e.g. "https://mcp.batchdata.com/" or "https://aiwget.com/api/mcp").',
        },
      },
      required: ['url'],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: 'calculate_api_tco',
    title: 'Calculate Verified B2B API TCO & Lab Risks',
    description:
      'Compute deterministic monthly cost comparisons and hands-on lab caveats (dated Nov 2026) for Enterprise Translation APIs (Azure, AWS, Google, DeepL, MachineTranslation.com) or Real Estate Data APIs & MCPs (BatchData, RentCast, RealEstateAPI, Regrid, ATTOM).',
    inputSchema: {
      type: 'object',
      properties: {
        vertical: {
          type: 'string',
          enum: ['enterprise_translation', 'real_estate_data'],
          description: 'Benchmark vertical to evaluate.',
        },
        monthlyMillionChars: {
          type: 'number',
          minimum: 0,
          maximum: 10000,
          description: 'For enterprise_translation: monthly volume in millions of characters (e.g. 10).',
        },
        needsZeroDataRetention: {
          type: 'boolean',
          description: 'For enterprise_translation: require contractual Zero Data Retention (ZDR).',
        },
        hasIcuJsonPlaceholders: {
          type: 'boolean',
          description: 'For enterprise_translation: input includes nested ICU plural/select JSON placeholders.',
        },
        monthlyPropertyLookups: {
          type: 'integer',
          minimum: 0,
          maximum: 10000000,
          description: 'For real_estate_data: monthly property lookup / enrichment calls.',
        },
        monthlySkipTraceMatches: {
          type: 'integer',
          minimum: 0,
          maximum: 10000000,
          description: 'For real_estate_data: monthly matched owner skip-trace records.',
        },
        needsParcelPolygons: {
          type: 'boolean',
          description: 'For real_estate_data: require GIS parcel boundary polygons.',
        },
        needsMcpServer: {
          type: 'boolean',
          description: 'For real_estate_data: require a live hosted remote MCP server.',
        },
      },
      required: ['vertical'],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'check_domain_rating',
    title: 'Check Domain Authority (Ahrefs DR3/DR4 + Tranco Top 1M)',
    description:
      'Look up cached Ahrefs Domain Rating (DR3 & DR4 when configured), live keyless Tranco Top-1M global rank, and embeddable SVG badge URLs for any domain.',
    inputSchema: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'Root domain or URL (e.g. "stripe.com" or "https://aiwget.com").',
        },
      },
      required: ['domain'],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: 'search_ai_tools',
    title: 'Search AIWget Curated AI Tools',
    description:
      'Search curated B2B AI tools, MCP servers, APIs, and SaaS workflows listed on AIWget by keyword and optional category.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search keyword (e.g. "real estate", "translation", "rfp", "mcp").',
        },
        category: {
          type: 'string',
          description: 'Optional category slug (e.g. "business", "code", "writing", "design").',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 20,
          default: 8,
          description: 'Maximum results to return (1-20).',
        },
      },
      required: ['query'],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'get_ai_tool_details',
    title: 'Get AI Tool Profile & Verified Facts',
    description:
      'Retrieve full structured details, verified summary, official website, and FAQ for a specific AI tool listed on AIWget.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: {
          type: 'string',
          description: 'AIWget listing slug (e.g. "batchdata", "machinetranslation", "settle").',
        },
      },
      required: ['slug'],
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'list_b2b_comparisons',
    title: 'List Hands-On B2B AI Comparison Guides',
    description:
      'List published AIWget hands-on B2B comparison guides covering enterprise translation, real estate data APIs/MCP servers, and AI RFP workflows.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Optional filter keyword (e.g. "deepl", "attom", "mcp", "loopio").',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          default: 6,
          description: 'Maximum guides to return (1-10).',
        },
      },
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
];

export type McpProviders = {
  inspectMcpEndpoint: (url: string) => Promise<unknown>;
  calculateApiTco: (args: Record<string, unknown>) => unknown;
  searchAiTools: (args: { query: string; category?: string; limit: number }) => Promise<unknown[]>;
  getAiToolDetails: (slug: string) => Promise<unknown | null>;
  listB2bComparisons: (args: { topic?: string; limit: number }) => Promise<unknown[]>;
  checkDomainRating: (domain: string) => Promise<{
    domain: string;
    rating: number | null;
    dr4Rating?: number | null;
    dr4Delta?: number | null;
    trancoRank?: number | null;
    trancoDate?: string | null;
    source?: string;
    attribution: string;
    checkedAt: string;
  }>;
};

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

export type McpHttpResult = {
  status: number;
  body: Record<string, unknown> | null;
};

function rpcError(id: string | number | null | undefined, code: number, message: string): McpHttpResult {
  return {
    status: 200,
    body: {
      jsonrpc: '2.0',
      id: id ?? null,
      error: { code, message },
    },
  };
}

function rpcResult(id: string | number | null | undefined, result: Record<string, unknown>): McpHttpResult {
  return {
    status: 200,
    body: {
      jsonrpc: '2.0',
      id: id ?? null,
      result,
    },
  };
}

export async function handleMcpRequest(payload: unknown, providers: McpProviders): Promise<McpHttpResult> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return rpcError(null, -32600, 'Invalid Request: expected a JSON-RPC 2.0 object');
  }

  const req = payload as JsonRpcRequest;
  if (req.jsonrpc !== '2.0' || typeof req.method !== 'string') {
    return rpcError(req.id, -32600, 'Invalid Request: jsonrpc "2.0" and string method are required');
  }

  if (req.method === 'notifications/initialized' || req.method.startsWith('notifications/')) {
    return { status: 202, body: null };
  }

  if (req.method === 'initialize') {
    return rpcResult(req.id, {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {
        tools: { listChanged: false },
      },
      serverInfo: MCP_SERVER_INFO,
      instructions:
        'Use AIWget MCP tools to audit remote MCP endpoints (Streamable HTTP + RFC 9728 OAuth), calculate verified Nov 2026 B2B API TCOs, check domain authority (Ahrefs DR + Tranco Top 1M), or query curated B2B benchmarks.',
    });
  }

  if (req.method === 'ping') {
    return rpcResult(req.id, {});
  }

  if (req.method === 'tools/list') {
    return rpcResult(req.id, { tools: MCP_TOOLS });
  }

  if (req.method === 'tools/call') {
    const params = req.params || {};
    const toolName = typeof params.name === 'string' ? params.name : '';
    const args = (params.arguments && typeof params.arguments === 'object' ? params.arguments : {}) as Record<
      string,
      unknown
    >;

    try {
      if (toolName === 'inspect_mcp_endpoint') {
        const url = typeof args.url === 'string' ? args.url.trim() : '';
        if (!url || url.length > 300) {
          return rpcError(req.id, -32602, 'Invalid params: "url" must be a public HTTPS URL string (<=300 chars)');
        }
        const report = await providers.inspectMcpEndpoint(url);
        return rpcResult(req.id, {
          content: [{ type: 'text', text: JSON.stringify(report, null, 2) }],
          isError: false,
        });
      }

      if (toolName === 'calculate_api_tco') {
        const vertical = typeof args.vertical === 'string' ? args.vertical.trim() : '';
        if (vertical !== 'enterprise_translation' && vertical !== 'real_estate_data') {
          return rpcError(
            req.id,
            -32602,
            'Invalid params: "vertical" must be "enterprise_translation" or "real_estate_data"',
          );
        }
        const report = providers.calculateApiTco(args);
        return rpcResult(req.id, {
          content: [{ type: 'text', text: JSON.stringify(report, null, 2) }],
          isError: false,
        });
      }

      if (toolName === 'search_ai_tools') {
        const query = typeof args.query === 'string' ? args.query.trim() : '';
        if (!query || query.length > 120) {
          return rpcError(req.id, -32602, 'Invalid params: "query" must be a non-empty string (<=120 chars)');
        }
        const category = typeof args.category === 'string' ? args.category.trim().toLowerCase() : undefined;
        const rawLimit = Number(args.limit ?? 8);
        const limit = Number.isFinite(rawLimit) ? Math.min(20, Math.max(1, Math.trunc(rawLimit))) : 8;
        const results = await providers.searchAiTools({ query, category, limit });
        return rpcResult(req.id, {
          content: [{ type: 'text', text: JSON.stringify({ query, count: results.length, tools: results }, null, 2) }],
          isError: false,
        });
      }

      if (toolName === 'get_ai_tool_details') {
        const slug = typeof args.slug === 'string' ? args.slug.trim().toLowerCase() : '';
        if (!slug || !/^[a-z0-9][a-z0-9_-]{0,120}$/.test(slug)) {
          return rpcError(req.id, -32602, 'Invalid params: "slug" must be a valid listing slug');
        }
        const tool = await providers.getAiToolDetails(slug);
        if (!tool) {
          return rpcResult(req.id, {
            content: [{ type: 'text', text: JSON.stringify({ error: `Tool "${slug}" not found on AIWget` }) }],
            isError: true,
          });
        }
        return rpcResult(req.id, {
          content: [{ type: 'text', text: JSON.stringify(tool, null, 2) }],
          isError: false,
        });
      }

      if (toolName === 'list_b2b_comparisons') {
        const topic = typeof args.topic === 'string' ? args.topic.trim() : undefined;
        const rawLimit = Number(args.limit ?? 6);
        const limit = Number.isFinite(rawLimit) ? Math.min(10, Math.max(1, Math.trunc(rawLimit))) : 6;
        const guides = await providers.listB2bComparisons({ topic, limit });
        return rpcResult(req.id, {
          content: [{ type: 'text', text: JSON.stringify({ count: guides.length, guides }, null, 2) }],
          isError: false,
        });
      }

      if (toolName === 'check_domain_rating') {
        const domain = typeof args.domain === 'string' ? args.domain.trim() : '';
        if (!domain || domain.length > 160) {
          return rpcError(req.id, -32602, 'Invalid params: "domain" must be a valid domain string');
        }
        const rating = await providers.checkDomainRating(domain);
        const encoded = encodeURIComponent(rating.domain);
        return rpcResult(req.id, {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ...rating,
                  checkerUrl: `https://aiwget.com/tools/domain-rating-checker?domain=${encoded}`,
                  badgeSvgUrl: `https://aiwget.com/api/domain-rating/badge?domain=${encoded}&style=flat&theme=dark`,
                },
                null,
                2,
              ),
            },
          ],
          isError: false,
        });
      }

      return rpcError(req.id, -32602, `Unknown tool: ${toolName}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Tool execution failed';
      return rpcResult(req.id, {
        content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
        isError: true,
      });
    }
  }

  return rpcError(req.id, -32601, `Method not found: ${req.method}`);
}
