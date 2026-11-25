# AIWget Official MCP Server (`v2.0.0`)

Official zero-auth, read-only **Streamable HTTP** [Model Context Protocol](https://modelcontextprotocol.io) server for **[AIWget](https://aiwget.com)** — a curated B2B AI software directory and hands-on API/MCP benchmark hub.

- **Official Website (B2B AI Directory & Benchmarks)**: `https://aiwget.com`
- **Live MCP Endpoint**: `https://aiwget.com/api/mcp`
- **Browser Docs & Live Probe**: `https://aiwget.com/mcp`
- **Protocol Version**: `2025-03-26` (Streamable HTTP)
- **Authentication**: None (public read-only, SSRF-hardened)

## Why We Built This

While hands-on testing commercial real estate MCP servers and enterprise translation APIs for [AIWget](https://aiwget.com), we kept hitting two developer pain points:

1. **Remote MCP endpoints fail silently in weird ways** — some return 404 on `/mcp`, some are legacy SSE-only (405), and commercial servers increasingly gate behind **RFC 9728 OAuth 2.1 Protected Resource metadata** instead of static API keys.
2. **LLMs routinely hallucinate 2023 SaaS/API rate cards** and miss real integration gotchas (like nested ICU `{count, plural, ...}` JSON breaking on certain translation APIs).

Instead of shipping a thin wrapper over a directory list, `aiwget-mcp` exposes the actual live protocol inspector and deterministic Nov 2026 TCO calculators we used.

## Quick Connect (Claude Desktop / Cursor / Windsurf)

```json
{
  "mcpServers": {
    "aiwget": {
      "url": "https://aiwget.com/api/mcp"
    }
  }
}
```

## Verify Live via `curl`

Audit a remote RFC 9728 OAuth MCP endpoint live:

```bash
curl -s https://aiwget.com/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "inspect_mcp_endpoint",
      "arguments": { "url": "https://mcp.batchdata.com/" }
    }
  }'
```

## Tools (`6` Read-Only Typed Tools)

| Tool | What It Actually Does |
| --- | --- |
| `inspect_mcp_endpoint` | Runs a live SSRF-hardened Streamable HTTP `initialize` handshake, checks RFC 9728 `/.well-known/oauth-protected-resource` metadata on 401/403, and lists exposed `tools/list` definitions + latency. |
| `calculate_api_tco` | Deterministic Nov 2026 cost & lab-risk calculator for Enterprise Translation APIs (Azure / AWS / Google / DeepL / MachineTranslation.com) and Real Estate Data APIs & MCPs (BatchData / RentCast / RealEstateAPI / Regrid / ATTOM). |
| `check_domain_rating` | Returns Ahrefs Domain Rating (DR3 & DR4 when configured) + live keyless Tranco Top-1M global web rank + embeddable SVG badge URLs. |
| `search_ai_tools` | Searches curated B2B AI tools & MCP servers indexed on AIWget. |
| `get_ai_tool_details` | Retrieves full profile, summary, official URL, and verified FAQs for a specific listing slug. |
| `list_b2b_comparisons` | Lists published AIWget hands-on B2B comparison guides with lab evidence. |

## Security & Rate Limits

- `inspect_mcp_endpoint` only permits public `https://` targets on port `443`, explicitly rejects `localhost`, `.local`, `.internal`, raw IPv4/IPv6 literals, credentials in URLs, and blind HTTP redirects, enforces 4.5s timeouts + 64KB body caps, and is rate-limited to 15 probes/minute per IP.
- All tools declare `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`.

## License

MIT
