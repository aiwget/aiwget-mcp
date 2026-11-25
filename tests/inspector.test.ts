import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateApiTco } from '../src/calculators.ts';
import { inspectMcpEndpoint, parseJsonRpcPayload, validatePublicHttpsUrl } from '../src/inspect.ts';

test('SSRF guard rejects loopback, link-local, raw IP, non-443, and embedded credential URLs', () => {
  assert.equal(validatePublicHttpsUrl('https://mcp.batchdata.com/').hostname, 'mcp.batchdata.com');
  assert.throws(() => validatePublicHttpsUrl('http://mcp.batchdata.com/'), /HTTPS/);
  assert.throws(() => validatePublicHttpsUrl('https://127.0.0.1/mcp'), /blocked/);
  assert.throws(() => validatePublicHttpsUrl('https://169.254.169.254/latest'), /blocked/);
  assert.throws(() => validatePublicHttpsUrl('https://localhost/mcp'), /blocked/);
  assert.throws(() => validatePublicHttpsUrl('https://example.com:8443/mcp'), /443/);
});

test('SSE and JSON-RPC parser extracts valid payload frames', () => {
  const sse = parseJsonRpcPayload('event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-03-26"}}\n\n', 'text/event-stream');
  assert.equal((sse?.result as any)?.protocolVersion, '2025-03-26');
});

test('inspectMcpEndpoint detects RFC 9728 OAuth metadata on HTTP 401', async () => {
  const mockFetch = (async (input: string | URL | Request) => {
    if (String(input).endsWith('/.well-known/oauth-protected-resource')) {
      return new Response(JSON.stringify({ authorization_servers: ['https://auth.example.com'] }), { status: 200 });
    }
    return new Response('Unauthorized', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource"',
      },
    });
  }) as typeof fetch;

  const res = await inspectMcpEndpoint('https://mcp.example.com/', { fetchImpl: mockFetch });
  assert.equal(res.authMode, 'oauth2-rfc9728');
  assert.deepEqual(res.oauthMetadata?.authorizationServers, ['https://auth.example.com']);
});

test('calculateApiTco produces deterministic Nov 2026 cost comparisons', () => {
  const mt = calculateApiTco({ vertical: 'enterprise_translation', monthlyMillionChars: 10, hasIcuJsonPlaceholders: true });
  assert.equal(mt.estimates[0].estimatedMonthlyUsd, 80);
  const re = calculateApiTco({ vertical: 'real_estate_data', monthlyPropertyLookups: 100000, monthlySkipTraceMatches: 10000, needsMcpServer: true });
  assert.equal(re.estimates.find((v) => v.vendor === 'RealEstateAPI')?.estimatedMonthlyUsd, 1700);
});
