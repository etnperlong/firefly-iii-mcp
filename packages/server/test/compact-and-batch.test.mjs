import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer } from '../dist/server.js';

describe('@firefly-iii-mcp/server compactResponses and batch_update_transactions', () => {
  const cleanups = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      const fn = cleanups.pop();
      if (fn) await fn();
    }
  });

  it('forwards compactResponses on Streamable HTTP /mcp for list_transaction and batch_update_transactions', async () => {
    const mockFirefly = http.createServer(async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);

      if (req.url?.startsWith('/api/v1/transactions/10') && req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            data: {
              id: '10',
              type: 'transactions',
              attributes: {
                transactions: [{ transaction_journal_id: '101', tags: ['raw'] }],
              },
            },
          }),
        );
        return;
      }

      if (req.url?.startsWith('/api/v1/transactions/10') && req.method === 'PUT') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ data: { id: '10', type: 'transactions' } }));
        return;
      }

      res.writeHead(200, { 'content-type': 'application/vnd.api+json' });
      res.end(
        JSON.stringify({
          data: [
            {
              id: '10',
              type: 'transactions',
              attributes: {
                created_at: '2026-01-01T00:00:00Z',
                transactions: [
                  {
                    transaction_journal_id: '101',
                    amount: '25.00',
                    currency_code: 'EUR',
                    currency_name: 'Euro',
                    description: 'Bakery',
                    sepa_cc: null,
                    tags: [],
                  },
                ],
              },
              links: { self: 'https://firefly.example.com/api/v1/transactions/10' },
            },
          ],
          links: { self: 'https://firefly.example.com/api/v1/transactions' },
        }),
      );
    });
    await new Promise((resolve) => mockFirefly.listen(0, '127.0.0.1', resolve));
    cleanups.push(
      () => new Promise((resolve, reject) => mockFirefly.close((err) => (err ? reject(err) : resolve()))),
    );
    const ffAddr = mockFirefly.address();
    const ffUrl = `http://127.0.0.1:${ffAddr.port}`;

    const mcpServer = createServer({
      port: 0,
      pat: 'test-pat',
      baseUrl: ffUrl,
      logLevel: 'error',
      compactResponses: true,
    });
    await mcpServer.start();
    cleanups.push(() => mcpServer.stop());
    const srvAddr = mcpServer.server.address();
    const serverUrl = `http://127.0.0.1:${srvAddr.port}`;

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
    const sessionId = initRes.headers.get('mcp-session-id');
    assert.ok(sessionId);

    await fetch(`${serverUrl}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-session-id': sessionId,
      },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    });

    const callRpc = async (id, method, params) => {
      const r = await fetch(`${serverUrl}/mcp`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'mcp-session-id': sessionId,
        },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
      });
      const txt = await r.text();
      const dataLine = txt.split('\n').find((line) => line.startsWith('data: '));
      return JSON.parse(dataLine ? dataLine.slice(6) : txt);
    };

    const listTxRes = await callRpc(2, 'tools/call', {
      name: 'list_transaction',
      arguments: { limit: 5 },
    });
    const txText = listTxRes.result.content[0].text;
    assert.ok(!txText.includes('\n  '));
    const txParsed = JSON.parse(txText);
    assert.equal(txParsed.links, undefined);
    assert.equal(txParsed.data[0].attributes.transactions[0].sepa_cc, undefined);

    const batchRes = await callRpc(3, 'tools/call', {
      name: 'batch_update_transactions',
      arguments: {
        updates: [{ id: '10', category_name: 'Food', add_tags: ['verified'] }],
      },
    });
    const batchText = batchRes.result.content[0].text;
    assert.ok(!batchText.includes('\n  '));
    const batchParsed = JSON.parse(batchText);
    assert.equal(batchParsed.succeeded, 1);
  });
});
