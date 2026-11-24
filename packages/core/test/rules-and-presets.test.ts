import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  ALL_TOOL_TAGS,
  DEFAULT_PRESET_TAGS,
  TOOL_PRESETS,
  executeApiTool,
  generatedTools,
  getAvailablePresets,
  getPresetTags,
  getServer,
  presetExists,
  type McpServerConfig,
} from '../src/index.js';

interface RecordedRequest {
  method: string;
  url: string;
  pathname: string;
  search: string;
  searchParams: URLSearchParams;
  headers: http.IncomingHttpHeaders;
  body: string;
}

type MockResponder = (
  req: RecordedRequest,
  res: http.ServerResponse,
) => void | Promise<void>;

async function startMockFireflyServer(responder: MockResponder): Promise<{
  baseUrl: string;
  requests: RecordedRequest[];
  close: () => Promise<void>;
}> {
  const requests: RecordedRequest[] = [];
  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const rawUrl = req.url ?? '/';
    const parsed = new URL(rawUrl, 'http://127.0.0.1');
    const recorded: RecordedRequest = {
      method: req.method ?? 'GET',
      url: rawUrl,
      pathname: parsed.pathname,
      search: parsed.search,
      searchParams: parsed.searchParams,
      headers: req.headers,
      body: Buffer.concat(chunks).toString('utf8'),
    };
    requests.push(recorded);
    await responder(recorded, res);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}

async function createConnectedClient(config: McpServerConfig): Promise<{
  client: Client;
  close: () => Promise<void>;
}> {
  const server = getServer(config);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

function getToolDefinition(name: string) {
  const tool = generatedTools.find((t) => t.name === name);
  assert.ok(tool, `Expected tool '${name}' to exist in generatedTools`);
  return tool;
}

describe('Rules & Rule Groups tool definitions and presets', () => {
  it('includes all rules and rule_groups tools with valid metadata', () => {
    const expectedRuleTools = [
      'list_rule',
      'get_rule',
      'store_rule',
      'update_rule',
      'delete_rule',
      'test_rule',
      'fire_rule',
    ];
    const expectedRuleGroupTools = [
      'list_rule_group',
      'get_rule_group',
      'store_rule_group',
      'update_rule_group',
      'delete_rule_group',
      'list_rule_by_group',
      'test_rule_group',
      'fire_rule_group',
    ];

    for (const name of expectedRuleTools) {
      const def = getToolDefinition(name);
      assert.ok(def.tags.includes('rules'), `${name} should have tag 'rules'`);
    }
    for (const name of expectedRuleGroupTools) {
      const def = getToolDefinition(name);
      assert.ok(def.tags.includes('rule_groups'), `${name} should have tag 'rule_groups'`);
    }
  });

  it('allows store_rule with either rule_group_id or rule_group_title', () => {
    const storeRule = getToolDefinition('store_rule');
    const bodySchema = storeRule.inputSchema.properties?.requestBody as Record<string, unknown>;
    assert.ok(bodySchema);
    const required = bodySchema.required as string[];
    assert.ok(!required.includes('rule_group_id'), 'rule_group_id must not be unconditionally required');
    assert.deepEqual(bodySchema.anyOf, [
      { required: ['rule_group_id'] },
      { required: ['rule_group_title'] },
    ]);
  });

  it('provides household preset with rules, rule_groups, budgets, and core tools without destructive data/admin tags', () => {
    assert.ok(presetExists('household'));
    assert.ok(presetExists('Household'));
    assert.ok(getAvailablePresets().includes('household'));

    const householdTags = getPresetTags('household');
    for (const requiredTag of [
      'accounts',
      'bills',
      'budgets',
      'categories',
      'piggy_banks',
      'recurrences',
      'rule_groups',
      'rules',
      'search',
      'summary',
      'tags',
      'transactions',
    ]) {
      assert.ok(householdTags.includes(requiredTag), `household preset missing '${requiredTag}'`);
    }
    assert.ok(!householdTags.includes('data'), 'household preset must not expose purge_data/destroy_data');
    assert.ok(!householdTags.includes('users'), 'household preset must not expose admin user management');

    assert.equal(presetExists('does-not-exist'), false);
    assert.deepEqual(getPresetTags('does-not-exist'), DEFAULT_PRESET_TAGS);
    assert.deepEqual(TOOL_PRESETS.full, ALL_TOOL_TAGS);
  });

  it('filters tools via MCP tools/list for household and automation presets', async () => {
    const { client: householdClient, close: closeHousehold } = await createConnectedClient({
      baseUrl: 'http://127.0.0.1:9999',
      pat: 'test-pat',
      enableToolTags: getPresetTags('household'),
    });
    try {
      const { tools } = await householdClient.listTools();
      const names = new Set(tools.map((t) => t.name));
      assert.ok(names.has('list_rule'));
      assert.ok(names.has('store_rule'));
      assert.ok(names.has('fire_rule'));
      assert.ok(names.has('list_rule_group'));
      assert.ok(names.has('store_rule_group'));
      assert.ok(names.has('fire_rule_group'));
      assert.ok(names.has('list_budget'));
      assert.ok(names.has('list_transaction'));
      assert.ok(!names.has('purge_data'));
      assert.ok(!names.has('destroy_data'));
    } finally {
      await closeHousehold();
    }

    const { client: autoClient, close: closeAuto } = await createConnectedClient({
      baseUrl: 'http://127.0.0.1:9999',
      pat: 'test-pat',
      enableToolTags: getPresetTags('automation'),
    });
    try {
      const { tools } = await autoClient.listTools();
      const names = new Set(tools.map((t) => t.name));
      assert.ok(names.has('list_rule'));
      assert.ok(names.has('list_rule_group'));
      assert.ok(names.has('list_recurrence'));
      assert.ok(!names.has('list_budget'));
    } finally {
      await closeAuto();
    }
  });
});

describe('MCP execution for Rules & Rule Groups and HTTP edge cases', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      const fn = cleanups.pop();
      if (fn) await fn();
    }
  });

  it('executes full Rules & Rule Groups lifecycle against mock Firefly III API', async () => {
    const mock = await startMockFireflyServer((req, res) => {
      if (req.pathname === '/api/v1/rule-groups' && req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'application/vnd.api+json' });
        res.end(JSON.stringify({ data: [{ id: '1', type: 'rule_groups', attributes: { title: 'Groceries' } }] }));
        return;
      }
      if (req.pathname === '/api/v1/rule-groups' && req.method === 'POST') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ data: { id: '2', type: 'rule_groups', attributes: JSON.parse(req.body) } }));
        return;
      }
      if (req.pathname === '/api/v1/rule-groups/2' && req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ data: { id: '2', type: 'rule_groups', attributes: { title: 'Bills' } } }));
        return;
      }
      if (req.pathname === '/api/v1/rule-groups/2' && req.method === 'PUT') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ data: { id: '2', type: 'rule_groups', attributes: JSON.parse(req.body) } }));
        return;
      }
      if (req.pathname === '/api/v1/rule-groups/2/rules' && req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ data: [{ id: '10', type: 'rules' }] }));
        return;
      }
      if (req.pathname === '/api/v1/rule-groups/2/test' && req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ data: [{ id: '99', type: 'transactions' }] }));
        return;
      }
      if (req.pathname === '/api/v1/rule-groups/2/trigger' && req.method === 'POST') {
        res.writeHead(204);
        res.end();
        return;
      }
      if (req.pathname === '/api/v1/rule-groups/2' && req.method === 'DELETE') {
        res.writeHead(204);
        res.end();
        return;
      }
      if (req.pathname === '/api/v1/rules' && req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ data: [{ id: '10', type: 'rules', attributes: { title: 'Market rule' } }] }));
        return;
      }
      if (req.pathname === '/api/v1/rules' && req.method === 'POST') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ data: { id: '11', type: 'rules', attributes: JSON.parse(req.body) } }));
        return;
      }
      if (req.pathname === '/api/v1/rules/11' && req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ data: { id: '11', type: 'rules', attributes: { title: 'Market rule' } } }));
        return;
      }
      if (req.pathname === '/api/v1/rules/11' && req.method === 'PUT') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ data: { id: '11', type: 'rules', attributes: JSON.parse(req.body) } }));
        return;
      }
      if (req.pathname === '/api/v1/rules/11/test' && req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ data: [{ id: '501', type: 'transactions' }] }));
        return;
      }
      if (req.pathname === '/api/v1/rules/11/trigger' && req.method === 'POST') {
        res.writeHead(204);
        res.end();
        return;
      }
      if (req.pathname === '/api/v1/rules/11' && req.method === 'DELETE') {
        res.writeHead(204);
        res.end();
        return;
      }
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ message: 'Not found' }));
    });
    cleanups.push(mock.close);

    // Trailing slash in baseUrl should be normalized cleanly.
    const { client, close } = await createConnectedClient({
      baseUrl: `${mock.baseUrl}/`,
      pat: 'secret-token',
      enableToolTags: getPresetTags('household'),
    });
    cleanups.push(close);

    // 1. List rule groups (no query params -> no trailing '?')
    const listGroupsRes = await client.callTool({ name: 'list_rule_group', arguments: {} });
    assert.ok(!listGroupsRes.isError);
    assert.equal(mock.requests[0].url, '/api/v1/rule-groups');
    assert.equal(mock.requests[0].headers.authorization, 'Bearer secret-token');

    // 2. Store, get, update, list_rule_by_group, test_rule_group, fire_rule_group, delete_rule_group
    const storeGroupRes = await client.callTool({
      name: 'store_rule_group',
      arguments: { requestBody: { title: 'Bills', active: true } },
    });
    assert.ok(!storeGroupRes.isError);

    const getGroupRes = await client.callTool({ name: 'get_rule_group', arguments: { id: '2' } });
    assert.ok(!getGroupRes.isError);

    const updateGroupRes = await client.callTool({
      name: 'update_rule_group',
      arguments: { id: '2', requestBody: { title: 'Bills Updated' } },
    });
    assert.ok(!updateGroupRes.isError);

    const byGroupRes = await client.callTool({
      name: 'list_rule_by_group',
      arguments: { id: '2', limit: 25, page: 1 },
    });
    assert.ok(!byGroupRes.isError);

    const testGroupRes = await client.callTool({
      name: 'test_rule_group',
      arguments: { id: '2', start: '2026-01-01', end: '2026-01-31', 'accounts[]': [1, 2] },
    });
    assert.ok(!testGroupRes.isError);
    const testGroupReq = mock.requests[mock.requests.length - 1];
    assert.deepEqual(testGroupReq.searchParams.getAll('accounts[]'), ['1', '2']);

    const fireGroupRes = await client.callTool({
      name: 'fire_rule_group',
      arguments: { id: '2', start: '2026-01-01', end: '2026-01-31', 'accounts[]': [3, 4] },
    });
    assert.ok(!fireGroupRes.isError);
    const fireGroupBody = JSON.parse((fireGroupRes.content[0] as { text: string }).text);
    assert.equal(fireGroupBody.success, true);
    assert.equal(fireGroupBody.status, 204);
    assert.deepEqual(mock.requests[mock.requests.length - 1].searchParams.getAll('accounts[]'), ['3', '4']);

    // 3. List rules
    const listRulesRes = await client.callTool({ name: 'list_rule', arguments: { limit: 10, page: 2 } });
    assert.ok(!listRulesRes.isError);
    assert.equal(mock.requests[mock.requests.length - 1].url, '/api/v1/rules?limit=10&page=2');

    // 4. Store rule using rule_group_title (without rule_group_id)
    const storeByTitleRes = await client.callTool({
      name: 'store_rule',
      arguments: {
        requestBody: {
          title: 'Auto-categorize groceries',
          rule_group_title: 'Bills',
          trigger: 'store-journal',
          triggers: [{ type: 'description_contains', value: 'INTERMARCHE' }],
          actions: [{ type: 'set_category', value: 'Groceries' }],
        },
      },
    });
    assert.ok(!storeByTitleRes.isError, `Expected store_rule by title to succeed: ${JSON.stringify(storeByTitleRes)}`);

    // 5. Store rule using rule_group_id (without rule_group_title)
    const storeByIdRes = await client.callTool({
      name: 'store_rule',
      arguments: {
        requestBody: {
          title: 'Auto-categorize groceries 2',
          rule_group_id: '2',
          trigger: 'store-journal',
          triggers: [{ type: 'description_contains', value: 'CARREFOUR' }],
          actions: [{ type: 'set_category', value: 'Groceries' }],
        },
      },
    });
    assert.ok(!storeByIdRes.isError);

    // 6. Get, update, test, fire (204), delete (204) rule
    const getRuleRes = await client.callTool({ name: 'get_rule', arguments: { id: '11' } });
    assert.ok(!getRuleRes.isError);

    const updateRuleRes = await client.callTool({
      name: 'update_rule',
      arguments: { id: '11', requestBody: { active: false } },
    });
    assert.ok(!updateRuleRes.isError);

    const testRuleRes = await client.callTool({
      name: 'test_rule',
      arguments: { id: '11', 'accounts[]': [7, 8, 9] },
    });
    assert.ok(!testRuleRes.isError);
    assert.deepEqual(mock.requests[mock.requests.length - 1].searchParams.getAll('accounts[]'), ['7', '8', '9']);

    const fireRuleRes = await client.callTool({
      name: 'fire_rule',
      arguments: { id: '11', start: '2026-01-01', end: '2026-02-01', 'accounts[]': [10, 20] },
    });
    assert.ok(!fireRuleRes.isError);
    const fireRulePayload = JSON.parse((fireRuleRes.content[0] as { text: string }).text);
    assert.equal(fireRulePayload.success, true);
    assert.equal(fireRulePayload.status, 204);
    assert.deepEqual(mock.requests[mock.requests.length - 1].searchParams.getAll('accounts[]'), ['10', '20']);

    const deleteRuleRes = await client.callTool({ name: 'delete_rule', arguments: { id: '11' } });
    assert.ok(!deleteRuleRes.isError);
    assert.equal(JSON.parse((deleteRuleRes.content[0] as { text: string }).text).status, 204);

    const deleteGroupRes = await client.callTool({ name: 'delete_rule_group', arguments: { id: '2' } });
    assert.ok(!deleteGroupRes.isError);
    assert.equal(JSON.parse((deleteGroupRes.content[0] as { text: string }).text).status, 204);
  });

  it('returns structured isError responses for validation failures, HTTP errors, bad bodies, and network errors', async () => {
    const mock = await startMockFireflyServer((req, res) => {
      if (req.pathname === '/api/v1/rules/404') {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ message: 'Resource not found' }));
        return;
      }
      if (req.pathname === '/api/v1/rules/422') {
        res.writeHead(422, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ message: 'The given data was invalid.' }));
        return;
      }
      if (req.pathname === '/api/v1/rules/empty-json') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('');
        return;
      }
      if (req.pathname === '/api/v1/rules/bad-json') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{broken');
        return;
      }
      if (req.pathname === '/api/v1/rules/text-ok') {
        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('plain text ok');
        return;
      }
      if (req.pathname === '/api/v1/rules/binary') {
        res.writeHead(200, { 'content-type': 'application/octet-stream' });
        res.end('raw-bytes');
        return;
      }
      if (req.pathname === '/api/v1/rules/a%2Fb') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ encoded: true }));
        return;
      }
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end('Internal error');
    });
    cleanups.push(mock.close);

    const { client, close } = await createConnectedClient({
      baseUrl: mock.baseUrl,
      pat: 'secret-token',
      enableToolTags: getPresetTags('household'),
    });
    cleanups.push(close);

    // Missing both rule_group_id and rule_group_title -> validation failure, zero HTTP calls
    const beforeCount = mock.requests.length;
    const missingGroupRes = await client.callTool({
      name: 'store_rule',
      arguments: {
        requestBody: {
          title: 'Invalid rule',
          trigger: 'store-journal',
          triggers: [{ type: 'description_contains', value: 'foo' }],
          actions: [{ type: 'set_category', value: 'bar' }],
        },
      },
    });
    assert.equal(missingGroupRes.isError, true);
    assert.equal(mock.requests.length, beforeCount);

    // Missing required path param -> validation failure
    const missingIdRes = await client.callTool({ name: 'fire_rule', arguments: {} });
    assert.equal(missingIdRes.isError, true);
    assert.equal(mock.requests.length, beforeCount);

    // Unknown tool
    const unknownRes = await client.callTool({ name: 'nonexistent_tool', arguments: {} });
    assert.equal(unknownRes.isError, true);

    // HTTP 404
    const notFoundRes = await client.callTool({ name: 'get_rule', arguments: { id: '404' } });
    assert.equal(notFoundRes.isError, true);
    assert.equal(JSON.parse((notFoundRes.content[0] as { text: string }).text).status, 404);

    // HTTP 422
    const unprocRes = await client.callTool({
      name: 'update_rule',
      arguments: { id: '422', requestBody: { title: '' } },
    });
    assert.equal(unprocRes.isError, true);
    assert.equal(JSON.parse((unprocRes.content[0] as { text: string }).text).status, 422);

    // Path encoding
    const encodedRes = await client.callTool({ name: 'get_rule', arguments: { id: 'a/b' } });
    assert.ok(!encodedRes.isError);
    assert.equal(JSON.parse((encodedRes.content[0] as { text: string }).text).encoded, true);

    // 200 empty body with json content-type
    const emptyJsonRes = await client.callTool({ name: 'get_rule', arguments: { id: 'empty-json' } });
    assert.ok(!emptyJsonRes.isError);
    assert.equal(JSON.parse((emptyJsonRes.content[0] as { text: string }).text).success, true);

    // 200 invalid JSON body
    const badJsonRes = await client.callTool({ name: 'get_rule', arguments: { id: 'bad-json' } });
    assert.equal(badJsonRes.isError, true);

    // 200 text/plain
    const textRes = await client.callTool({ name: 'get_rule', arguments: { id: 'text-ok' } });
    assert.ok(!textRes.isError);
    assert.equal((textRes.content[0] as { text: string }).text, 'plain text ok');

    // Unsupported binary content-type
    const binRes = await client.callTool({ name: 'get_rule', arguments: { id: 'binary' } });
    assert.equal(binRes.isError, true);

    // Network error via executeApiTool against dead port
    const getRuleDef = getToolDefinition('get_rule');
    const netErrRes = await executeApiTool(
      'get_rule',
      getRuleDef,
      { id: '1' },
      { baseUrl: 'http://127.0.0.1:1', pat: 'tok' },
    );
    assert.equal(netErrRes.isError, true);
    assert.match((netErrRes.content[0] as { text: string }).text, /Network error/);
  });

  it('exposes unavailable/unauthorized stub tools when baseUrl or pat is missing', async () => {
    const noUrl = await createConnectedClient({ baseUrl: '', pat: 'tok' });
    cleanups.push(noUrl.close);
    const { tools: noUrlTools } = await noUrl.client.listTools();
    assert.deepEqual(noUrlTools.map((t) => t.name), ['unavailable']);
    const noUrlCall = await noUrl.client.callTool({ name: 'unavailable', arguments: {} });
    assert.match((noUrlCall.content[0] as { text: string }).text, /Unavailable/);

    const noPat = await createConnectedClient({ baseUrl: 'http://127.0.0.1:9999', pat: '' });
    cleanups.push(noPat.close);
    const { tools: noPatTools } = await noPat.client.listTools();
    assert.deepEqual(noPatTools.map((t) => t.name), ['unauthorized']);
    const noPatCall = await noPat.client.callTool({ name: 'unauthorized', arguments: {} });
    assert.match((noPatCall.content[0] as { text: string }).text, /Unauthorized/);
  });
});
