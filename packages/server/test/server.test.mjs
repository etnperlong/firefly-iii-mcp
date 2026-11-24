import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer } from '../dist/server.js';
import { getPresetTags } from '@firefly-iii-mcp/core';

describe('@firefly-iii-mcp/server transports and tag forwarding', () => {
  const cleanups = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      const fn = cleanups.pop();
      if (fn) await fn();
    }
  });

  it('serves /health, forwards enableToolTags on Streamable HTTP /mcp, and forwards enableToolTags on SSE /sse', async () => {
    const mcpServer = createServer({
      port: 0,
      pat: 'test-pat',
      baseUrl: 'http://127.0.0.1:9999',
      logLevel: 'error',
      enableToolTags: getPresetTags('household'),
    });
    await mcpServer.start();
    cleanups.push(() => mcpServer.stop());

    const address = mcpServer.server.address();
    assert.ok(address && typeof address === 'object');
    const serverUrl = `http://127.0.0.1:${address.port}`;

    // 1. Health endpoint
    const healthRes = await fetch(`${serverUrl}/health`);
    assert.equal(healthRes.status, 200);
    assert.deepEqual(await healthRes.json(), { status: 'ok' });

    // 2. Streamable HTTP /mcp initialize + tools/list
    const initRes = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'http-test', version: '1.0.0' },
        },
      }),
    });
    assert.equal(initRes.status, 200);
    const mcpSessionId = initRes.headers.get('mcp-session-id');
    assert.ok(mcpSessionId);

    await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-session-id': mcpSessionId,
      },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    });

    const listRes = await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-session-id': mcpSessionId,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    });
    assert.equal(listRes.status, 200);
    const listText = await listRes.text();
    const mcpDataLine = listText.split('\n').find((line) => line.startsWith('data: '));
    const listJson = JSON.parse(mcpDataLine ? mcpDataLine.slice(6) : listText);
    const mcpToolNames = new Set(listJson.result.tools.map((t) => t.name));
    assert.ok(mcpToolNames.has('list_rule'));
    assert.ok(mcpToolNames.has('fire_rule'));
    assert.ok(mcpToolNames.has('list_rule_group'));
    assert.ok(!mcpToolNames.has('purge_data'));

    // 3. SSE /sse + /messages must also forward enableToolTags
    const sseMessages = [];
    let sseEndpoint = '';
    const sseReq = await new Promise((resolve, reject) => {
      const req = http.get(`${serverUrl}/sse`, (res) => {
        res.setEncoding('utf8');
        let buffer = '';
        res.on('data', (chunk) => {
          buffer += chunk;
          const frames = buffer.split('\n\n');
          buffer = frames.pop() ?? '';
          for (const frame of frames) {
            const eventLine = frame.split('\n').find((l) => l.startsWith('event: '));
            const dataLine = frame.split('\n').find((l) => l.startsWith('data: '));
            if (eventLine === 'event: endpoint' && dataLine) {
              sseEndpoint = dataLine.slice(6).trim();
              resolve({ res, req });
            } else if (eventLine === 'event: message' && dataLine) {
              sseMessages.push(JSON.parse(dataLine.slice(6)));
            }
          }
        });
      });
      req.on('error', reject);
    });
    cleanups.push(async () => {
      sseReq.req.destroy();
    });

    assert.ok(sseEndpoint.startsWith('/messages?sessionId='));

    const postInit = await fetch(`${serverUrl}${sseEndpoint}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'sse-test', version: '1.0.0' },
        },
      }),
    });
    assert.equal(postInit.status, 202);

    await fetch(`${serverUrl}${sseEndpoint}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    });

    await fetch(`${serverUrl}${sseEndpoint}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    });

    // Wait briefly for SSE tools/list response message id === 2
    const deadline = Date.now() + 3000;
    while (!sseMessages.some((m) => m.id === 2) && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 20));
    }
    const sseListMsg = sseMessages.find((m) => m.id === 2);
    assert.ok(sseListMsg, 'Expected SSE tools/list response');
    const sseToolNames = new Set(sseListMsg.result.tools.map((t) => t.name));
    assert.ok(sseToolNames.has('list_rule'), 'SSE endpoint should forward enableToolTags and include list_rule');
    assert.ok(sseToolNames.has('fire_rule'), 'SSE endpoint should forward enableToolTags and include fire_rule');
    assert.ok(sseToolNames.has('list_rule_group'), 'SSE endpoint should include list_rule_group');
    assert.ok(!sseToolNames.has('purge_data'), 'SSE endpoint should filter out non-household tools');
  });
});
