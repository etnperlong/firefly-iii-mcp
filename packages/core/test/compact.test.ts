import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  compactResponseData,
  executeApiTool,
  formatJsonResponse,
  generatedTools,
  getServer,
  withCompactParameters,
  type McpServerConfig,
} from '../src/index.js';

function makeRealisticTransaction(id: number, overrides: Record<string, unknown> = {}) {
  return {
    type: 'transactions',
    id: String(id),
    attributes: {
      created_at: '2026-01-15T10:00:00+00:00',
      updated_at: '2026-01-15T10:00:00+00:00',
      user: '1',
      group_title: null,
      transactions: [
        {
          user: '1',
          transaction_journal_id: String(id * 10),
          type: 'withdrawal',
          date: '2026-01-15T00:00:00+00:00',
          order: 0,
          currency_id: '1',
          currency_code: 'EUR',
          currency_symbol: '€',
          currency_name: 'Euro',
          currency_decimal_places: 2,
          foreign_currency_id: null,
          foreign_currency_code: null,
          foreign_currency_symbol: null,
          foreign_currency_decimal_places: null,
          amount: '42.50',
          foreign_amount: null,
          description: `Supermarket #${id}`,
          source_id: '1',
          source_name: 'Checking account',
          source_iban: 'NL02ABNA0123456789',
          source_type: 'Asset account',
          destination_id: '50',
          destination_name: 'Carrefour',
          destination_iban: null,
          destination_type: 'Expense account',
          budget_id: '2',
          budget_name: 'Food',
          category_id: '3',
          category_name: 'Groceries',
          bill_id: null,
          bill_name: null,
          reconciled: false,
          notes: null,
          tags: [],
          internal_reference: null,
          external_id: null,
          external_url: null,
          original_source: 'ff3-v6.2.13',
          recurrence_id: null,
          recurrence_total: null,
          recurrence_count: null,
          bunq_payment_id: null,
          import_hash_v2: 'abc123hash',
          sepa_cc: null,
          sepa_ct_op: null,
          sepa_ct_id: null,
          sepa_db: null,
          sepa_country: null,
          sepa_ep: null,
          sepa_ci: null,
          sepa_batch_id: null,
          interest_date: null,
          book_date: null,
          process_date: null,
          due_date: null,
          payment_date: null,
          invoice_date: null,
          latitude: null,
          longitude: null,
          zoom_level: null,
          has_attachments: false,
          ...overrides,
        },
      ],
    },
    links: {
      self: `https://firefly.example.com/api/v1/transactions/${id}`,
      '0': { rel: 'self', uri: `/transactions/${id}` },
    },
  };
}

describe('compactResponseData and formatJsonResponse', () => {
  it('reduces realistic Firefly III transaction payloads by >70% while keeping meaningful financial fields', () => {
    const payload = {
      data: Array.from({ length: 20 }, (_, i) => makeRealisticTransaction(i + 1)),
      meta: {
        pagination: { total: 100, count: 20, per_page: 20, current_page: 1, total_pages: 5 },
      },
      links: {
        self: 'https://firefly.example.com/api/v1/transactions?page=1',
        first: 'https://firefly.example.com/api/v1/transactions?page=1',
        next: 'https://firefly.example.com/api/v1/transactions?page=2',
        last: 'https://firefly.example.com/api/v1/transactions?page=5',
      },
    };

    const fullText = formatJsonResponse(payload, { compact: false });
    const compactText = formatJsonResponse(payload, { compact: true });

    const reduction = 1 - compactText.length / fullText.length;
    assert.ok(reduction >= 0.7, `Expected >=70% reduction, got ${(reduction * 100).toFixed(1)}%`);

    const parsed = JSON.parse(compactText);
    assert.equal(parsed.links, undefined);
    assert.deepEqual(parsed.meta.pagination, payload.meta.pagination);
    assert.equal(parsed.data.length, 20);
    assert.equal(parsed.data[0].links, undefined);
    assert.equal(parsed.data[0].attributes.created_at, undefined);
    assert.equal(parsed.data[0].attributes.group_title, undefined);

    const split = parsed.data[0].attributes.transactions[0];
    assert.equal(split.transaction_journal_id, '10');
    assert.equal(split.amount, '42.50');
    assert.equal(split.currency_code, 'EUR');
    assert.equal(split.description, 'Supermarket #1');
    assert.equal(split.category_name, 'Groceries');
    assert.equal(split.budget_name, 'Food');
    assert.equal(split.source_name, 'Checking account');
    assert.equal(split.destination_name, 'Carrefour');
    assert.equal(split.currency_id, undefined);
    assert.equal(split.currency_symbol, undefined);
    assert.equal(split.sepa_cc, undefined);
    assert.equal(split.tags, undefined);
    assert.equal(split.has_attachments, undefined);
    assert.equal(split.order, undefined);
  });

  it('preserves foreign currency values, non-empty tags, notes, attachments flag, multi-split order, and empty data arrays', () => {
    const multiSplit = {
      data: [
        {
          type: 'transactions',
          id: '7',
          attributes: {
            group_title: 'Groceries + Household',
            transactions: [
              {
                transaction_journal_id: '701',
                type: 'withdrawal',
                amount: '15.00',
                currency_code: 'EUR',
                foreign_amount: '16.50',
                foreign_currency_code: 'USD',
                foreign_currency_id: '2',
                foreign_currency_symbol: '$',
                foreign_currency_name: 'US Dollar',
                foreign_currency_decimal_places: 2,
                order: 0,
                tags: ['weekly'],
                notes: 'Receipt kept',
                has_attachments: true,
              },
              {
                transaction_journal_id: '702',
                type: 'withdrawal',
                amount: '10.00',
                currency_code: 'EUR',
                order: 1,
                tags: [],
                notes: null,
                has_attachments: false,
              },
            ],
          },
        },
      ],
    };

    const compacted = compactResponseData(multiSplit, { compact: true }) as {
      data: Array<{ attributes: { group_title: string; transactions: Array<Record<string, unknown>> } }>;
    };
    const [s1, s2] = compacted.data[0].attributes.transactions;
    assert.equal(compacted.data[0].attributes.group_title, 'Groceries + Household');
    assert.equal(s1.foreign_amount, '16.50');
    assert.equal(s1.foreign_currency_code, 'USD');
    assert.equal(s1.foreign_currency_symbol, undefined);
    assert.deepEqual(s1.tags, ['weekly']);
    assert.equal(s1.notes, 'Receipt kept');
    assert.equal(s1.has_attachments, true);
    assert.equal(s1.order, 0);
    assert.equal(s2.order, 1);

    const emptyCollection = compactResponseData(
      { data: [], meta: { pagination: { total: 0 } }, links: { self: '...' } },
      { compact: true },
    ) as { data: unknown[]; links?: unknown };
    assert.deepEqual(emptyCollection.data, []);
    assert.equal(emptyCollection.links, undefined);
  });

  it('supports fields projection across list envelopes, single resources, and plain objects/arrays', () => {
    const listEnvelope = {
      data: [makeRealisticTransaction(1, { tags: ['groceries'] })],
      meta: { pagination: { total: 1 } },
      links: { self: 'x' },
    };

    const projectedList = compactResponseData(listEnvelope, {
      fields: ['amount', 'description', 'category_name'],
    }) as {
      data: Array<{ id: string; attributes: { transactions: Array<Record<string, unknown>> } }>;
      meta: unknown;
      links?: unknown;
    };
    assert.equal(projectedList.links, undefined);
    assert.deepEqual(projectedList.meta, { pagination: { total: 1 } });
    assert.equal(projectedList.data[0].id, '1');
    assert.deepEqual(projectedList.data[0].attributes.transactions[0], {
      transaction_journal_id: '10',
      amount: '42.50',
      description: 'Supermarket #1',
      category_name: 'Groceries',
    });

    const singleEnvelope = { data: makeRealisticTransaction(9) };
    const projectedSingle = compactResponseData(singleEnvelope, {
      fields: ['description', 'amount'],
    }) as { data: { id: string; attributes: { transactions: Array<Record<string, unknown>> } } };
    assert.deepEqual(projectedSingle.data.attributes.transactions[0], {
      transaction_journal_id: '90',
      amount: '42.50',
      description: 'Supermarket #9',
    });

    const autocomplete = [
      { id: '1', name: 'Checking', currency_code: 'EUR', extra: 'ignore' },
    ];
    assert.deepEqual(compactResponseData(autocomplete, { fields: ['name'] }), [
      { id: '1', name: 'Checking' },
    ]);

    const summary = {
      'net-worth-in-EUR': { key: 'net-worth-in-EUR', monetary_value: '1000.00' },
      'spent-in-EUR': { key: 'spent-in-EUR', monetary_value: '-200.00' },
    };
    assert.deepEqual(compactResponseData(summary, { fields: ['spent-in-EUR'] }), {
      'spent-in-EUR': { key: 'spent-in-EUR', monetary_value: '-200.00' },
    });
  });

  it('injects compact and fields on schemas without mutating original definitions', () => {
    const listTx = generatedTools.find((t) => t.name === 'list_transaction')!;
    const augmented = withCompactParameters(listTx.inputSchema);
    assert.ok(augmented.properties?.compact);
    assert.ok(augmented.properties?.fields);
    assert.equal(listTx.inputSchema.properties?.compact, undefined);
    assert.equal(listTx.inputSchema.properties?.fields, undefined);
  });

  it('treats fields as an explicit allowlist even when compact: true, preserving requested metadata keys', () => {
    const listEnvelope = {
      data: [makeRealisticTransaction(1)],
      meta: { pagination: { total: 1 } },
      links: { self: 'x' },
    };

    const projected = compactResponseData(listEnvelope, {
      compact: true,
      fields: ['currency_id', 'currency_code', 'amount', 'tags', 'order', 'has_attachments', 'created_at'],
    }) as {
      data: Array<{
        attributes: {
          created_at?: string;
          transactions: Array<Record<string, unknown>>;
        };
      }>;
    };

    assert.equal(projected.data[0].attributes.created_at, '2026-01-15T10:00:00+00:00');
    assert.deepEqual(projected.data[0].attributes.transactions[0], {
      transaction_journal_id: '10',
      order: 0,
      currency_id: '1',
      currency_code: 'EUR',
      amount: '42.50',
      tags: [],
      has_attachments: false,
    });
  });

  it('preserves non-transaction recurrences structure, resource relationships/meta, and compacts accounts/rules', () => {
    const recurrencePayload = {
      data: [
        {
          id: '5',
          type: 'recurrences',
          attributes: {
            title: 'Monthly Rent',
            active: true,
            notes: null,
            transactions: [
              { id: '50', description: 'Rent', amount: '1200.00', currency_code: 'EUR' },
            ],
          },
          relationships: {
            piggy_bank: { data: { id: '3', type: 'piggy_banks' } },
          },
          meta: { custom: 'keep-me' },
          links: { self: 'https://firefly.example.com/api/v1/recurrences/5' },
        },
      ],
    };

    // Only title requested -> must NOT attach transactions array when type !== 'transactions'
    const projectedRecurrence = compactResponseData(recurrencePayload, {
      fields: ['title'],
    }) as {
      data: Array<{
        attributes: Record<string, unknown>;
        relationships?: unknown;
        meta?: unknown;
        links?: unknown;
      }>;
    };
    assert.deepEqual(projectedRecurrence.data[0].attributes, { title: 'Monthly Rent' });
    assert.deepEqual(projectedRecurrence.data[0].relationships, {
      piggy_bank: { data: { id: '3', type: 'piggy_banks' } },
    });
    assert.deepEqual(projectedRecurrence.data[0].meta, { custom: 'keep-me' });
    assert.equal(projectedRecurrence.data[0].links, undefined);

    // Explicitly requesting transactions on recurrence preserves recurrence transaction objects untouched
    const withRecurrenceTx = compactResponseData(recurrencePayload, {
      fields: ['title', 'transactions'],
    }) as { data: Array<{ attributes: { transactions: Array<Record<string, unknown>> } }> };
    assert.deepEqual(withRecurrenceTx.data[0].attributes.transactions, [
      { id: '50', description: 'Rent', amount: '1200.00', currency_code: 'EUR' },
    ]);

    // Compact mode on accounts & rules preserves relationships/meta and strips nulls/links
    const accountsAndRules = {
      data: [
        {
          id: '1',
          type: 'accounts',
          attributes: { name: 'Checking', type: 'asset', iban: null, current_balance: '500.00' },
          relationships: { currency: { data: { id: '1', type: 'currencies' } } },
          meta: { source: 'bank' },
          links: { self: 'x' },
        },
        {
          id: '9',
          type: 'rules',
          attributes: { title: 'Groceries', description: null, active: true },
          links: { self: 'y' },
        },
      ],
      links: { self: 'root' },
    };
    const compactedResources = compactResponseData(accountsAndRules, { compact: true }) as {
      data: Array<Record<string, unknown>>;
      links?: unknown;
    };
    assert.equal(compactedResources.links, undefined);
    assert.deepEqual(compactedResources.data[0], {
      id: '1',
      type: 'accounts',
      attributes: { name: 'Checking', type: 'asset', current_balance: '500.00' },
      relationships: { currency: { data: { id: '1', type: 'currencies' } } },
      meta: { source: 'bank' },
    });
    assert.deepEqual(compactedResources.data[1], {
      id: '9',
      type: 'rules',
      attributes: { title: 'Groceries', active: true },
    });
  });
});

describe('MCP integration for compact response mode and field pruning', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      const fn = cleanups.pop();
      if (fn) await fn();
    }
  });

  async function startMockAndClient(configOverrides: Partial<McpServerConfig> = {}) {
    const recordedUrls: string[] = [];
    const httpServer = http.createServer((req, res) => {
      recordedUrls.push(req.url ?? '/');
      res.writeHead(200, { 'content-type': 'application/vnd.api+json' });
      res.end(
        JSON.stringify({
          data: [makeRealisticTransaction(1), makeRealisticTransaction(2)],
          meta: { pagination: { total: 2, count: 2, per_page: 50, current_page: 1, total_pages: 1 } },
          links: { self: 'https://firefly.example.com/api/v1/transactions' },
        }),
      );
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
    const client = new Client({ name: 'compact-test-client', version: '1.0.0' });
    await Promise.all([mcpServer.connect(serverTransport), client.connect(clientTransport)]);

    cleanups.push(async () => {
      await client.close();
      await mcpServer.close();
      await new Promise<void>((resolve, reject) =>
        httpServer.close((err) => (err ? reject(err) : resolve())),
      );
    });

    return { client, recordedUrls, baseUrl };
  }

  it('exposes compact and fields only on JSON GET tools (excluding download/export/write tools) and omits them from upstream query params', async () => {
    const { client, recordedUrls } = await startMockAndClient({ enableToolTags: [] });
    const { tools } = await client.listTools();

    const listTx = tools.find((t) => t.name === 'list_transaction');
    const storeTx = tools.find((t) => t.name === 'store_transaction');
    const downloadAttachment = tools.find((t) => t.name === 'download_attachment');
    const exportTransactions = tools.find((t) => t.name === 'export_transactions');
    assert.ok(listTx?.inputSchema.properties?.compact);
    assert.ok(listTx?.inputSchema.properties?.fields);
    assert.equal(storeTx?.inputSchema.properties?.compact, undefined);
    assert.equal(storeTx?.inputSchema.properties?.fields, undefined);
    assert.equal(downloadAttachment?.inputSchema.properties?.compact, undefined);
    assert.equal(downloadAttachment?.inputSchema.properties?.fields, undefined);
    assert.equal(exportTransactions?.inputSchema.properties?.compact, undefined);
    assert.equal(exportTransactions?.inputSchema.properties?.fields, undefined);

    const res = await client.callTool({
      name: 'list_transaction',
      arguments: {
        limit: 10,
        compact: true,
        fields: ['date', 'amount', 'description'],
      },
    });
    assert.ok(!res.isError);
    assert.equal(recordedUrls[0], '/api/v1/transactions?limit=10');

    const text = (res.content[0] as { text: string }).text;
    assert.ok(!text.includes('\n  '), 'compact mode should emit single-line JSON');
    const parsed = JSON.parse(text);
    assert.equal(parsed.links, undefined);
    assert.deepEqual(parsed.data[0].attributes.transactions[0], {
      transaction_journal_id: '10',
      date: '2026-01-15T00:00:00+00:00',
      amount: '42.50',
      description: 'Supermarket #1',
    });
  });

  it('supports server-wide compactResponses with per-call compact: false override and validates compact/fields types', async () => {
    const { client, recordedUrls } = await startMockAndClient({ compactResponses: true });

    // Server-wide compact mode active by default
    const compactByDefault = await client.callTool({
      name: 'list_transaction',
      arguments: { limit: 5 },
    });
    const compactText = (compactByDefault.content[0] as { text: string }).text;
    assert.ok(!compactText.includes('\n  '));
    assert.equal(JSON.parse(compactText).links, undefined);

    // Per-call opt-out restores full pretty response
    const fullOverride = await client.callTool({
      name: 'list_transaction',
      arguments: { limit: 5, compact: false },
    });
    const fullText = (fullOverride.content[0] as { text: string }).text;
    assert.ok(fullText.includes('\n  '));
    assert.ok(JSON.parse(fullText).links);

    // Invalid types rejected before hitting Firefly III
    const beforeCount = recordedUrls.length;
    const listTxDef = generatedTools.find((t) => t.name === 'list_transaction')!;
    const invalidCompact = await executeApiTool(
      'list_transaction',
      listTxDef,
      { compact: 'yes' },
      { baseUrl: 'http://127.0.0.1:1', pat: 'tok' },
    );
    assert.equal(invalidCompact.isError, true);
    assert.equal(recordedUrls.length, beforeCount);

    const invalidFields = await executeApiTool(
      'list_transaction',
      listTxDef,
      { fields: [123] },
      { baseUrl: 'http://127.0.0.1:1', pat: 'tok' },
    );
    assert.equal(invalidFields.isError, true);
  });
});
