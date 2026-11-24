import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  executeBatchUpdateTransactions,
  getServer,
  type McpServerConfig,
} from '../src/index.js';

interface SplitFixture {
  transaction_journal_id?: string | null;
  tags?: string[];
}

interface MockTxStore {
  [txId: string]: {
    splits: SplitFixture[];
    getRawBody?: string;
    putStatus?: number;
    putError?: string;
    delayMs?: number;
  };
}

describe('batch_update_transactions helper', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      const fn = cleanups.pop();
      if (fn) await fn();
    }
  });

  async function setupMockServer(
    store: MockTxStore,
    configOverrides: Partial<McpServerConfig> = {},
  ) {
    const requests: Array<{ method: string; url: string; body?: Record<string, unknown> }> = [];
    let inFlight = 0;
    let maxInFlight = 0;

    const httpServer = http.createServer(async (req, res) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const rawBody = Buffer.concat(chunks).toString('utf8');
        const parsedBody = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : undefined;
        requests.push({ method: req.method ?? 'GET', url: req.url ?? '/', body: parsedBody });

        const match = (req.url ?? '').match(/^\/api\/v1\/transactions\/([^/]+)$/);
        if (!match) {
          res.writeHead(404, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ message: 'Route not found' }));
          return;
        }
        const txId = decodeURIComponent(match[1]);
        const entry = store[txId];
        if (!entry) {
          res.writeHead(404, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ message: `Transaction ${txId} not found` }));
          return;
        }

        if (entry.delayMs) {
          await new Promise((r) => setTimeout(r, entry.delayMs));
        }

        if (req.method === 'GET') {
          res.writeHead(200, { 'content-type': 'application/json' });
          if (entry.getRawBody !== undefined) {
            res.end(entry.getRawBody);
            return;
          }
          res.end(
            JSON.stringify({
              data: {
                id: txId,
                type: 'transactions',
                attributes: { transactions: entry.splits },
              },
            }),
          );
          return;
        }

        if (req.method === 'PUT') {
          if (entry.putStatus && entry.putStatus >= 400) {
            res.writeHead(entry.putStatus, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ message: entry.putError ?? 'Update failed' }));
            return;
          }
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ data: { id: txId, type: 'transactions' } }));
          return;
        }
      } finally {
        inFlight--;
      }
    });

    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    const addr = httpServer.address();
    assert.ok(addr && typeof addr === 'object');
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    const mcpServer = getServer({
      baseUrl,
      pat: 'test-pat',
      ...configOverrides,
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'batch-test-client', version: '1.0.0' });
    await Promise.all([mcpServer.connect(serverTransport), client.connect(clientTransport)]);

    cleanups.push(async () => {
      await client.close();
      await mcpServer.close();
      await new Promise<void>((resolve, reject) =>
        httpServer.close((err) => (err ? reject(err) : resolve())),
      );
    });

    return {
      client,
      requests,
      baseUrl,
      getMaxInFlight: () => maxInFlight,
    };
  }

  it('is exposed under transactions tag and excluded when transactions tag is omitted', async () => {
    const defaultRun = await setupMockServer({});
    const { tools } = await defaultRun.client.listTools();
    assert.ok(tools.some((t) => t.name === 'batch_update_transactions'));

    const filteredRun = await setupMockServer({}, { enableToolTags: ['accounts'] });
    const { tools: filteredTools } = await filteredRun.client.listTools();
    assert.ok(!filteredTools.some((t) => t.name === 'batch_update_transactions'));
  });

  it('updates single-split transactions, merges add_tags/remove_tags, clears nullable fields, and preserves sibling splits on multi-split transactions', async () => {
    const store: MockTxStore = {
      '10': { splits: [{ transaction_journal_id: '101', tags: ['imported', 'old-tag'] }] },
      '20': {
        splits: [
          { transaction_journal_id: '201', tags: ['split-a'] },
          { transaction_journal_id: '202', tags: ['split-b'] },
        ],
      },
    };
    const { client, requests } = await setupMockServer(store);

    const res = await client.callTool({
      name: 'batch_update_transactions',
      arguments: {
        apply_rules: false,
        fire_webhooks: false,
        updates: [
          {
            id: '10',
            category_name: 'Groceries',
            budget_id: null,
            notes: null,
            add_tags: ['reviewed', 'imported'],
            remove_tags: ['old-tag'],
          },
          {
            id: '20',
            transaction_journal_id: '201',
            category_name: 'Utilities',
          },
          {
            id: '20',
            transaction_journal_id: '202',
            add_tags: ['reimbursable'],
          },
        ],
      },
    });

    assert.ok(!res.isError);
    const summary = JSON.parse((res.content[0] as { text: string }).text);
    assert.equal(summary.total, 3);
    assert.equal(summary.succeeded, 3);
    assert.equal(summary.failed, 0);
    assert.equal(summary.skipped, 0);
    assert.equal(summary.results[0].transaction_journal_id, '101');
    assert.equal(summary.results[1].transaction_journal_id, '201');
    assert.equal(summary.results[2].transaction_journal_id, '202');

    // Transaction 20 had 2 patches in one batch -> merged into a single GET + PUT!
    const put10 = requests.find((r) => r.method === 'PUT' && r.url === '/api/v1/transactions/10');
    assert.ok(put10?.body);
    assert.equal(put10.body.apply_rules, false);
    assert.equal(put10.body.fire_webhooks, false);
    assert.deepEqual(put10.body.transactions, [
      {
        transaction_journal_id: '101',
        category_name: 'Groceries',
        budget_id: null,
        notes: null,
        tags: ['imported', 'reviewed'],
      },
    ]);

    const tx20Gets = requests.filter((r) => r.method === 'GET' && r.url === '/api/v1/transactions/20');
    const tx20Puts = requests.filter((r) => r.method === 'PUT' && r.url === '/api/v1/transactions/20');
    assert.equal(tx20Gets.length, 1);
    assert.equal(tx20Puts.length, 1);
    assert.deepEqual(tx20Puts[0].body?.transactions, [
      { transaction_journal_id: '201', category_name: 'Utilities' },
      { transaction_journal_id: '202', tags: ['split-b', 'reimbursable'] },
    ]);
  });

  it('handles ambiguous multi-split, unknown split ID, HTTP errors, partial failures, and continue_on_error: false', async () => {
    const store: MockTxStore = {
      '1': { splits: [{ transaction_journal_id: '101' }] },
      '2': {
        splits: [
          { transaction_journal_id: '201' },
          { transaction_journal_id: '202' },
        ],
      },
      '3': { splits: [{ transaction_journal_id: '301' }], putStatus: 422, putError: 'Invalid category' },
      '4': { splits: [{ transaction_journal_id: '401' }] },
      '5': { splits: [], getRawBody: 'not-valid-json' },
      '6': { splits: [{ transaction_journal_id: null }] },
    };
    const { client, requests } = await setupMockServer(store);

    // Partial failure with continue_on_error: true (default)
    const partialRes = await client.callTool({
      name: 'batch_update_transactions',
      arguments: {
        updates: [
          { id: '1', category_name: 'Food' },
          { id: '2', category_name: 'Ambiguous' }, // multi-split without transaction_journal_id
          { id: '2', transaction_journal_id: '999', category_name: 'MissingSplit' },
          { id: '3', category_name: 'Bad' }, // PUT 422
          { id: '404', category_name: 'MissingTx' }, // GET 404
          { id: '4', tags: ['a'], add_tags: ['b'] }, // mutually exclusive
          { id: '4' }, // no patch fields
          { id: '4', add_tags: [], remove_tags: [] }, // empty tag arrays only -> no-op
          { id: '5', category_name: 'BadJsonGet' }, // non-JSON 200 GET body
          { id: '6', category_name: 'MissingJournalId' }, // missing transaction_journal_id on split
        ],
      },
    });

    assert.ok(!partialRes.isError); // 1 item succeeded
    const partial = JSON.parse((partialRes.content[0] as { text: string }).text);
    assert.equal(partial.succeeded, 1);
    assert.equal(partial.failed, 9);
    assert.equal(partial.skipped, 0);
    assert.match(partial.results[1].error, /has 2 splits/);
    assert.match(partial.results[2].error, /does not contain split '999'/);
    assert.match(partial.results[3].error, /422/);
    assert.match(partial.results[4].error, /404/);
    assert.match(partial.results[5].error, /Cannot combine/);
    assert.match(partial.results[6].error, /at least one field/);
    assert.match(partial.results[7].error, /at least one field/);
    assert.match(partial.results[8].error, /Invalid JSON response fetching transaction '5'/);
    assert.match(partial.results[9].error, /without a transaction_journal_id/);

    // Early stop with continue_on_error: false using DEFAULT concurrency (omitted):
    // must execute sequentially and NOT touch transaction '1' after '404' fails.
    const reqCountBeforeAbort = requests.length;
    const abortRes = await client.callTool({
      name: 'batch_update_transactions',
      arguments: {
        continue_on_error: false,
        compact: true,
        updates: [
          { id: '404', category_name: 'FailFirst' },
          { id: '1', category_name: 'ShouldSkip' },
        ],
      },
    });
    assert.equal(abortRes.isError, true);
    const abortText = (abortRes.content[0] as { text: string }).text;
    assert.ok(!abortText.includes('\n  '));
    const aborted = JSON.parse(abortText);
    assert.equal(aborted.succeeded, 0);
    assert.equal(aborted.failed, 1);
    assert.equal(aborted.skipped, 1);
    assert.equal(aborted.results[1].status, 'skipped');
    const abortRequests = requests.slice(reqCountBeforeAbort);
    assert.equal(abortRequests.some((r) => r.url === '/api/v1/transactions/1'), false);
  });

  it('respects bounded concurrency, rejects invalid arguments, and handles network failures', async () => {
    const store: MockTxStore = Object.fromEntries(
      Array.from({ length: 6 }, (_, i) => [
        String(i + 1),
        { splits: [{ transaction_journal_id: String((i + 1) * 10) }], delayMs: 25 },
      ]),
    );
    const { client, getMaxInFlight } = await setupMockServer(store);

    const res = await client.callTool({
      name: 'batch_update_transactions',
      arguments: {
        concurrency: 2,
        updates: Array.from({ length: 6 }, (_, i) => ({
          id: String(i + 1),
          category_name: 'Groceries',
        })),
      },
    });
    assert.ok(!res.isError);
    assert.ok(getMaxInFlight() <= 2, `Expected max concurrency <= 2, got ${getMaxInFlight()}`);

    // Invalid schema arguments (empty updates, invalid concurrency)
    const emptyUpdates = await client.callTool({
      name: 'batch_update_transactions',
      arguments: { updates: [] },
    });
    assert.equal(emptyUpdates.isError, true);

    const badConcurrency = await client.callTool({
      name: 'batch_update_transactions',
      arguments: { concurrency: 99, updates: [{ id: '1', category_name: 'Food' }] },
    });
    assert.equal(badConcurrency.isError, true);

    const typoField = await client.callTool({
      name: 'batch_update_transactions',
      arguments: { updates: [{ id: '1', catgory_name: 'Food' }] },
    });
    assert.equal(typoField.isError, true);

    const overMaxBatch = await client.callTool({
      name: 'batch_update_transactions',
      arguments: {
        updates: Array.from({ length: 101 }, (_, i) => ({
          id: String(i + 1),
          category_name: 'Food',
        })),
      },
    });
    assert.equal(overMaxBatch.isError, true);

    // Network error against unreachable port
    const netErr = await executeBatchUpdateTransactions(
      { updates: [{ id: '1', category_name: 'Food' }] },
      { baseUrl: 'http://127.0.0.1:1', pat: 'tok' },
    );
    assert.equal(netErr.isError, true);
    const netSummary = JSON.parse((netErr.content[0] as { text: string }).text);
    assert.match(netSummary.results[0].error, /Network error/);
  });
});
