#!/usr/bin/env bash
set -euo pipefail

ENDPOINT="${AIWGET_MCP_URL:-https://aiwget.com/api/mcp}"

echo "1) Initialize handshake"
curl -s "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl-demo","version":"1.0"}}}'
echo ""

echo "2) Audit a remote RFC 9728 OAuth MCP endpoint (BatchData)"
curl -s "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"inspect_mcp_endpoint","arguments":{"url":"https://mcp.batchdata.com/"}}}'
echo ""

echo "3) Calculate Enterprise Translation API TCO (10M chars/mo + ZDR + ICU JSON)"
curl -s "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"calculate_api_tco","arguments":{"vertical":"enterprise_translation","monthlyMillionChars":10,"needsZeroDataRetention":true,"hasIcuJsonPlaceholders":true}}}'
echo ""

echo "4) Check domain authority (Ahrefs DR + Tranco Top-1M)"
curl -s "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"check_domain_rating","arguments":{"domain":"stripe.com"}}}'
echo ""
