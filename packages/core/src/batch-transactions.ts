import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Schema, Validator } from '@cfworker/json-schema';
import { openapiSchemaToJsonSchema } from '@openapi-contrib/openapi-schema-to-json-schema';
import type { CallToolRequestArguments, McpServerConfig, McpToolDefinition } from './types.js';
import { formatJsonResponse } from './compact.js';

const MAX_BATCH_SIZE = 100;
const DEFAULT_CONCURRENCY = 5;
const MAX_CONCURRENCY = 10;

const PATCHABLE_SPLIT_FIELDS = [
  'category_id',
  'category_name',
  'budget_id',
  'budget_name',
  'bill_id',
  'bill_name',
  'tags',
  'description',
  'notes',
  'source_id',
  'source_name',
  'destination_id',
  'destination_name',
  'date',
  'amount',
  'type',
  'reconciled',
] as const;

export interface BatchTransactionPatch {
  id: string;
  transaction_journal_id?: string;
  category_id?: string | null;
  category_name?: string | null;
  budget_id?: string | null;
  budget_name?: string | null;
  bill_id?: string | null;
  bill_name?: string | null;
  tags?: string[] | null;
  add_tags?: string[];
  remove_tags?: string[];
  description?: string;
  notes?: string | null;
  source_id?: string | null;
  source_name?: string | null;
  destination_id?: string | null;
  destination_name?: string | null;
  date?: string;
  amount?: string;
  type?: 'withdrawal' | 'deposit' | 'transfer' | 'reconciliation' | 'opening balance';
  reconciled?: boolean;
}

export interface BatchItemResult {
  index: number;
  id: string;
  transaction_journal_id?: string;
  status: 'updated' | 'error' | 'skipped';
  error?: string;
}

/**
 * Tool definition for safe, concurrent multi-transaction updates.
 */
export const batchUpdateTransactionsToolDefinition: McpToolDefinition = {
  name: 'batch_update_transactions',
  tags: ['transactions'],
  description:
    'Safely update multiple transactions (categories, budgets, bills, tags, descriptions, notes, accounts, amounts) in one call. Automatically fetches each transaction to resolve transaction_journal_id, preserves sibling splits on split transactions, and supports additive/subtractive tag updates (add_tags / remove_tags).',
  inputSchema: {
    type: 'object',
    required: ['updates'],
    properties: {
      updates: {
        type: 'array',
        minItems: 1,
        maxItems: MAX_BATCH_SIZE,
        description: `List of transaction updates to apply (1 to ${MAX_BATCH_SIZE} items).`,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'Transaction ID to update.',
            },
            transaction_journal_id: {
              type: 'string',
              description:
                'Specific split journal ID. Optional for single-split transactions; required when the transaction has multiple splits.',
            },
            category_id: {
              type: 'string',
              nullable: true,
              description: 'Category ID to assign, or null to clear.',
            },
            category_name: {
              type: 'string',
              nullable: true,
              description: 'Category name to assign (created by Firefly III if unknown), or null to clear.',
            },
            budget_id: {
              type: 'string',
              nullable: true,
              description: 'Budget ID to assign, or null to clear.',
            },
            budget_name: {
              type: 'string',
              nullable: true,
              description: 'Budget name to assign, or null to clear.',
            },
            bill_id: {
              type: 'string',
              nullable: true,
              description: 'Bill ID to link, or null to clear.',
            },
            bill_name: {
              type: 'string',
              nullable: true,
              description: 'Bill name to link, or null to clear.',
            },
            tags: {
              type: 'array',
              nullable: true,
              items: { type: 'string' },
              description: 'Replace all tags on the split. Cannot be combined with add_tags or remove_tags.',
            },
            add_tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags to append while preserving existing tags.',
            },
            remove_tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags to remove while preserving remaining existing tags.',
            },
            description: {
              type: 'string',
              description: 'Updated transaction description.',
            },
            notes: {
              type: 'string',
              nullable: true,
              description: 'Updated transaction notes, or null to clear.',
            },
            source_id: {
              type: 'string',
              nullable: true,
              description: 'Updated source account ID.',
            },
            source_name: {
              type: 'string',
              nullable: true,
              description: 'Updated source account name.',
            },
            destination_id: {
              type: 'string',
              nullable: true,
              description: 'Updated destination account ID.',
            },
            destination_name: {
              type: 'string',
              nullable: true,
              description: 'Updated destination account name.',
            },
            date: {
              type: 'string',
              description: 'Updated transaction date (ISO-8601).',
            },
            amount: {
              type: 'string',
              description: 'Updated transaction amount string.',
            },
            type: {
              type: 'string',
              enum: ['withdrawal', 'deposit', 'transfer', 'reconciliation', 'opening balance'],
              description: 'Updated transaction type.',
            },
            reconciled: {
              type: 'boolean',
              description: 'Updated reconciled status.',
            },
          },
        },
      },
      apply_rules: {
        type: 'boolean',
        description: 'Whether Firefly III should apply rules after updating each transaction.',
      },
      fire_webhooks: {
        type: 'boolean',
        description: 'Whether Firefly III should fire webhooks for each updated transaction.',
      },
      concurrency: {
        type: 'integer',
        minimum: 1,
        maximum: MAX_CONCURRENCY,
        description: `Maximum concurrent transaction updates (1-${MAX_CONCURRENCY}, default ${DEFAULT_CONCURRENCY}).`,
      },
      continue_on_error: {
        type: 'boolean',
        description: 'When true (default), continues updating remaining items after an item fails.',
      },
      compact: {
        type: 'boolean',
        description: 'Format the batch summary as compact JSON without indentation.',
      },
    },
  },
  method: 'put',
  pathTemplate: '/v1/transactions/{id}',
  executionParameters: [],
  requestBodyContentType: 'application/json',
  operationId: 'batch_update_transactions',
};

const batchValidator = new Validator(
  openapiSchemaToJsonSchema(batchUpdateTransactionsToolDefinition.inputSchema) as Schema,
  '4',
);

function hasAnyPatchField(item: BatchTransactionPatch): boolean {
  if (
    (Array.isArray(item.add_tags) && item.add_tags.length > 0) ||
    (Array.isArray(item.remove_tags) && item.remove_tags.length > 0)
  ) {
    return true;
  }
  return PATCHABLE_SPLIT_FIELDS.some((key) => item[key] !== undefined);
}

function validatePatchItem(item: BatchTransactionPatch): string | null {
  if (
    item.tags !== undefined &&
    (item.add_tags !== undefined || item.remove_tags !== undefined)
  ) {
    return 'Cannot combine "tags" with "add_tags" or "remove_tags" on the same update item.';
  }
  if (!hasAnyPatchField(item)) {
    return 'Update item must include at least one field to modify.';
  }
  return null;
}

interface IndexedUpdate {
  index: number;
  patch: BatchTransactionPatch;
}

interface ExistingSplit {
  transaction_journal_id?: string | number;
  tags?: unknown;
}

async function applyUpdatesForTransactionId(
  txId: string,
  indexedUpdates: IndexedUpdate[],
  options: {
    baseUrl: string;
    pat: string;
    applyRules?: boolean;
    fireWebhooks?: boolean;
  },
): Promise<BatchItemResult[]> {
  const results = new Map<number, BatchItemResult>();
  const validItems: IndexedUpdate[] = [];

  for (const entry of indexedUpdates) {
    const validationErr = validatePatchItem(entry.patch);
    if (validationErr) {
      results.set(entry.index, {
        index: entry.index,
        id: txId,
        transaction_journal_id: entry.patch.transaction_journal_id,
        status: 'error',
        error: validationErr,
      });
    } else {
      validItems.push(entry);
    }
  }

  if (validItems.length === 0) {
    return indexedUpdates.map((e) => results.get(e.index)!);
  }

  const normalizedBaseUrl = options.baseUrl.replace(/\/+$/, '');
  const txEndpoint = `${normalizedBaseUrl}/api/v1/transactions/${encodeURIComponent(txId)}`;
  const commonHeaders = {
    Accept: 'application/json',
    Authorization: `Bearer ${options.pat}`,
  };

  let getResponse: Response;
  try {
    getResponse = await fetch(txEndpoint, {
      method: 'GET',
      headers: commonHeaders,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    for (const entry of validItems) {
      results.set(entry.index, {
        index: entry.index,
        id: txId,
        transaction_journal_id: entry.patch.transaction_journal_id,
        status: 'error',
        error: `Network error fetching transaction '${txId}': ${message}`,
      });
    }
    return indexedUpdates.map((e) => results.get(e.index)!);
  }

  if (!getResponse.ok) {
    const errorText = await getResponse.text();
    for (const entry of validItems) {
      results.set(entry.index, {
        index: entry.index,
        id: txId,
        transaction_journal_id: entry.patch.transaction_journal_id,
        status: 'error',
        error: `Failed to fetch transaction '${txId}': ${getResponse.status} ${getResponse.statusText}${errorText ? ` - ${errorText}` : ''}`,
      });
    }
    return indexedUpdates.map((e) => results.get(e.index)!);
  }

  let existingPayload: { data?: { attributes?: { transactions?: ExistingSplit[] } } };
  try {
    existingPayload = (await getResponse.json()) as {
      data?: { attributes?: { transactions?: ExistingSplit[] } };
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    for (const entry of validItems) {
      results.set(entry.index, {
        index: entry.index,
        id: txId,
        transaction_journal_id: entry.patch.transaction_journal_id,
        status: 'error',
        error: `Invalid JSON response fetching transaction '${txId}': ${message}`,
      });
    }
    return indexedUpdates.map((e) => results.get(e.index)!);
  }

  const existingSplits = existingPayload?.data?.attributes?.transactions;
  if (!Array.isArray(existingSplits) || existingSplits.length === 0) {
    for (const entry of validItems) {
      results.set(entry.index, {
        index: entry.index,
        id: txId,
        transaction_journal_id: entry.patch.transaction_journal_id,
        status: 'error',
        error: `Transaction '${txId}' response does not contain any transaction splits.`,
      });
    }
    return indexedUpdates.map((e) => results.get(e.index)!);
  }

  if (
    existingSplits.some(
      (split) =>
        split.transaction_journal_id === undefined ||
        split.transaction_journal_id === null ||
        String(split.transaction_journal_id).length === 0,
    )
  ) {
    for (const entry of validItems) {
      results.set(entry.index, {
        index: entry.index,
        id: txId,
        transaction_journal_id: entry.patch.transaction_journal_id,
        status: 'error',
        error: `Transaction '${txId}' contains a split without a transaction_journal_id.`,
      });
    }
    return indexedUpdates.map((e) => results.get(e.index)!);
  }

  // Preserve every existing split by transaction_journal_id so Firefly III
  // never deletes sibling splits on PUT /v1/transactions/{id}.
  const splitPayloads: Record<string, unknown>[] = existingSplits.map((split) => ({
    transaction_journal_id: String(split.transaction_journal_id),
  }));
  const currentSplitTags: string[][] = existingSplits.map((split) =>
    Array.isArray(split.tags)
      ? split.tags.filter((t): t is string => typeof t === 'string')
      : [],
  );

  const appliedEntries: Array<{ entry: IndexedUpdate; journalId: string }> = [];

  for (const entry of validItems) {
    const requestedJournalId = entry.patch.transaction_journal_id;
    let targetSplitIndex = -1;

    if (requestedJournalId !== undefined) {
      targetSplitIndex = existingSplits.findIndex(
        (split) => String(split.transaction_journal_id) === String(requestedJournalId),
      );
      if (targetSplitIndex === -1) {
        results.set(entry.index, {
          index: entry.index,
          id: txId,
          transaction_journal_id: requestedJournalId,
          status: 'error',
          error: `Transaction '${txId}' does not contain split '${requestedJournalId}'.`,
        });
        continue;
      }
    } else if (existingSplits.length === 1) {
      targetSplitIndex = 0;
    } else {
      results.set(entry.index, {
        index: entry.index,
        id: txId,
        status: 'error',
        error: `Transaction '${txId}' has ${existingSplits.length} splits; specify transaction_journal_id to avoid modifying the wrong split.`,
      });
      continue;
    }

    const targetPayload = splitPayloads[targetSplitIndex];
    for (const key of PATCHABLE_SPLIT_FIELDS) {
      if (entry.patch[key] !== undefined) {
        targetPayload[key] = entry.patch[key];
        if (key === 'tags') {
          currentSplitTags[targetSplitIndex] = Array.isArray(entry.patch.tags)
            ? [...entry.patch.tags]
            : [];
        }
      }
    }

    if (entry.patch.add_tags !== undefined || entry.patch.remove_tags !== undefined) {
      const removeSet = new Set(entry.patch.remove_tags ?? []);
      const merged = currentSplitTags[targetSplitIndex].filter(
        (tag) => !removeSet.has(tag),
      );
      for (const tag of entry.patch.add_tags ?? []) {
        if (!merged.includes(tag)) {
          merged.push(tag);
        }
      }
      currentSplitTags[targetSplitIndex] = merged;
      targetPayload.tags = merged;
    }

    appliedEntries.push({
      entry,
      journalId: String(existingSplits[targetSplitIndex].transaction_journal_id),
    });
  }

  if (appliedEntries.length === 0) {
    return indexedUpdates.map((e) => results.get(e.index)!);
  }

  const putBody: Record<string, unknown> = {
    transactions: splitPayloads,
  };
  if (options.applyRules !== undefined) {
    putBody.apply_rules = options.applyRules;
  }
  if (options.fireWebhooks !== undefined) {
    putBody.fire_webhooks = options.fireWebhooks;
  }

  try {
    const putResponse = await fetch(txEndpoint, {
      method: 'PUT',
      headers: {
        ...commonHeaders,
        'content-type': 'application/json',
      },
      body: JSON.stringify(putBody),
    });

    if (!putResponse.ok) {
      const errorText = await putResponse.text();
      for (const { entry, journalId } of appliedEntries) {
        results.set(entry.index, {
          index: entry.index,
          id: txId,
          transaction_journal_id: journalId,
          status: 'error',
          error: `Failed to update transaction '${txId}': ${putResponse.status} ${putResponse.statusText}${errorText ? ` - ${errorText}` : ''}`,
        });
      }
      return indexedUpdates.map((e) => results.get(e.index)!);
    }

    await putResponse.body?.cancel();

    for (const { entry, journalId } of appliedEntries) {
      results.set(entry.index, {
        index: entry.index,
        id: txId,
        transaction_journal_id: journalId,
        status: 'updated',
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    for (const { entry, journalId } of appliedEntries) {
      results.set(entry.index, {
        index: entry.index,
        id: txId,
        transaction_journal_id: journalId,
        status: 'error',
        error: `Network error updating transaction '${txId}': ${message}`,
      });
    }
  }

  return indexedUpdates.map((e) => results.get(e.index)!);
}

/**
 * Execute `batch_update_transactions` safely across one or more Firefly III transactions.
 */
export async function executeBatchUpdateTransactions(
  toolArgs: CallToolRequestArguments,
  serverConfig: McpServerConfig,
): Promise<CallToolResult> {
  const argsToParse =
    typeof toolArgs === 'object' && toolArgs !== null ? toolArgs : {};

  const validated = batchValidator.validate(argsToParse);

  if (!validated.valid) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              message: "Invalid arguments for tool 'batch_update_transactions'",
              errors: validated.errors,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  const updates = argsToParse.updates as BatchTransactionPatch[];
  const applyRules =
    typeof argsToParse.apply_rules === 'boolean' ? argsToParse.apply_rules : undefined;
  const fireWebhooks =
    typeof argsToParse.fire_webhooks === 'boolean'
      ? argsToParse.fire_webhooks
      : undefined;
  const continueOnError =
    typeof argsToParse.continue_on_error === 'boolean'
      ? argsToParse.continue_on_error
      : true;
  const requestedConcurrency =
    typeof argsToParse.concurrency === 'number'
      ? argsToParse.concurrency
      : DEFAULT_CONCURRENCY;
  const concurrency = Math.max(
    1,
    Math.min(MAX_CONCURRENCY, Math.floor(requestedConcurrency)),
  );
  const useCompact =
    argsToParse.compact === true ||
    (argsToParse.compact !== false && Boolean(serverConfig.compactResponses));

  // Group items by transaction ID so multiple split patches for the same
  // transaction are merged into one atomic GET + PUT round-trip.
  const groups = new Map<string, IndexedUpdate[]>();
  updates.forEach((patch, index) => {
    const txId = String(patch.id);
    const list = groups.get(txId);
    if (list) {
      list.push({ index, patch });
    } else {
      groups.set(txId, [{ index, patch }]);
    }
  });

  const groupEntries = Array.from(groups.entries());
  const allResults: BatchItemResult[] = new Array(updates.length);
  let nextGroupIndex = 0;
  let aborted = false;

  const worker = async () => {
    while (true) {
      if (aborted) return;
      const current = nextGroupIndex++;
      if (current >= groupEntries.length) return;

      const [txId, indexedUpdates] = groupEntries[current];
      const groupResults = await applyUpdatesForTransactionId(txId, indexedUpdates, {
        baseUrl: serverConfig.baseUrl,
        pat: serverConfig.pat,
        applyRules,
        fireWebhooks,
      });

      for (const res of groupResults) {
        allResults[res.index] = res;
        if (!continueOnError && res.status === 'error') {
          aborted = true;
        }
      }
    }
  };

  // Run sequentially when continue_on_error is false so no extra in-flight mutations execute after an error.
  const effectiveConcurrency = continueOnError ? concurrency : 1;
  const workerCount = Math.min(effectiveConcurrency, groupEntries.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  for (let i = 0; i < updates.length; i++) {
    if (!allResults[i]) {
      allResults[i] = {
        index: i,
        id: String(updates[i].id),
        transaction_journal_id: updates[i].transaction_journal_id,
        status: 'skipped',
      };
    }
  }

  const succeeded = allResults.filter((r) => r.status === 'updated').length;
  const failed = allResults.filter((r) => r.status === 'error').length;
  const skipped = allResults.filter((r) => r.status === 'skipped').length;

  const summary = {
    total: updates.length,
    succeeded,
    failed,
    skipped,
    results: allResults,
  };

  return {
    isError: succeeded === 0 && failed > 0,
    content: [
      {
        type: 'text',
        text: formatJsonResponse(summary, { compact: useCompact }),
      },
    ],
  };
}
