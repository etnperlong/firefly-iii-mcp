import type { OpenAPIV3 } from 'openapi-types';

/**
 * Options controlling response compaction and field projection.
 */
export interface CompactOptions {
  compact?: boolean;
  fields?: string[];
}

const REDUNDANT_SPLIT_METADATA = new Set([
  'user',
  'created_at',
  'updated_at',
  'import_hash_v2',
  'original_source',
]);

const REDUNDANT_ENVELOPE_METADATA = new Set([
  'user',
  'created_at',
  'updated_at',
]);

const BASE_CURRENCY_META_KEYS = [
  'currency_id',
  'currency_name',
  'currency_symbol',
  'currency_decimal_places',
];

const FOREIGN_CURRENCY_META_KEYS = [
  'foreign_currency_id',
  'foreign_currency_name',
  'foreign_currency_symbol',
  'foreign_currency_decimal_places',
];

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isJsonApiResource = (value: unknown): value is Record<string, unknown> =>
  isPlainObject(value) &&
  typeof value.id === 'string' &&
  typeof value.type === 'string' &&
  isPlainObject(value.attributes);

const isTransactionSplit = (value: unknown): value is Record<string, unknown> =>
  isPlainObject(value) &&
  typeof value.transaction_journal_id === 'string' &&
  'amount' in value;

/**
 * Inject optional `compact` and `fields` parameters onto GET tool input schemas
 * without mutating the underlying generated OpenAPI tool definitions.
 */
export function withCompactParameters(
  schema: OpenAPIV3.SchemaObject,
): OpenAPIV3.SchemaObject {
  const existingProps = schema.properties ?? {};
  const nextProps: { [key: string]: OpenAPIV3.ReferenceObject | OpenAPIV3.SchemaObject } = {
    ...existingProps,
  };

  if (!('compact' in nextProps)) {
    nextProps.compact = {
      type: 'boolean',
      description:
        'When true, strips null/empty fields, JSON:API links, and redundant transaction metadata to reduce token usage.',
    };
  }

  if (!('fields' in nextProps)) {
    nextProps.fields = {
      type: 'array',
      items: { type: 'string' },
      description:
        'Optional list of attribute/split field names to retain in the response (always preserves resource id, transaction_journal_id, and meta).',
    };
  }

  return {
    ...schema,
    type: 'object',
    properties: nextProps,
  };
}

function compactSplit(
  split: Record<string, unknown>,
  isSingleSplit: boolean,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const hasCurrencyCode =
    typeof split.currency_code === 'string' && split.currency_code.length > 0;
  const hasForeignCurrencyCode =
    typeof split.foreign_currency_code === 'string' &&
    split.foreign_currency_code.length > 0;

  for (const [key, val] of Object.entries(split)) {
    if (val === null || val === undefined) continue;
    if (REDUNDANT_SPLIT_METADATA.has(key)) continue;
    if (key === 'has_attachments' && val === false) continue;
    if (key === 'order' && isSingleSplit && val === 0) continue;
    if (key === 'tags' && Array.isArray(val) && val.length === 0) continue;
    if (hasCurrencyCode && BASE_CURRENCY_META_KEYS.includes(key)) continue;
    if (hasForeignCurrencyCode && FOREIGN_CURRENCY_META_KEYS.includes(key)) continue;
    out[key] = compactValue(val);
  }
  return out;
}

function compactValue(value: unknown, isRoot = false): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => compactValue(item, false));
  }
  if (!isPlainObject(value)) {
    return value;
  }

  if (isJsonApiResource(value)) {
    const resourceOut: Record<string, unknown> = {};
    const isTxResource = value.type === 'transactions';

    for (const [key, propVal] of Object.entries(value)) {
      if (propVal === null || propVal === undefined || key === 'links') continue;
      if (key === 'attributes' && isPlainObject(propVal)) {
        const compactedAttrs: Record<string, unknown> = {};
        for (const [attrKey, attrVal] of Object.entries(propVal)) {
          if (attrVal === null || attrVal === undefined) continue;
          if (isTxResource && REDUNDANT_ENVELOPE_METADATA.has(attrKey)) continue;
          if (isTxResource && attrKey === 'transactions' && Array.isArray(attrVal)) {
            const isSingle = attrVal.length === 1;
            compactedAttrs[attrKey] = attrVal.map((split) =>
              isTransactionSplit(split)
                ? compactSplit(split, isSingle)
                : compactValue(split),
            );
          } else {
            compactedAttrs[attrKey] = compactValue(attrVal);
          }
        }
        resourceOut.attributes = compactedAttrs;
      } else {
        resourceOut[key] = compactValue(propVal);
      }
    }

    return resourceOut;
  }

  if (isTransactionSplit(value)) {
    return compactSplit(value, false);
  }

  const out: Record<string, unknown> = {};

  for (const [key, propVal] of Object.entries(value)) {
    if (propVal === null || propVal === undefined || key === 'links') continue;
    out[key] = compactValue(propVal, false);
  }
  return out;
}

function pickKeys(
  obj: Record<string, unknown>,
  fieldSet: Set<string>,
  alwaysKeep: string[] = [],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (alwaysKeep.includes(key) || fieldSet.has(key)) {
      out[key] = val;
    }
  }
  return out;
}

function projectResource(
  resource: Record<string, unknown>,
  fieldSet: Set<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, propVal] of Object.entries(resource)) {
    if (propVal === null || propVal === undefined || key === 'links') continue;
    if (key === 'attributes' && isPlainObject(propVal)) {
      if (resource.type === 'transactions' && Array.isArray(propVal.transactions)) {
        const projectedAttrs = pickKeys(propVal, fieldSet);
        projectedAttrs.transactions = propVal.transactions.map((split) =>
          isPlainObject(split)
            ? pickKeys(split, fieldSet, ['transaction_journal_id'])
            : split,
        );
        out.attributes = projectedAttrs;
      } else {
        out.attributes = pickKeys(propVal, fieldSet);
      }
    } else {
      out[key] = propVal;
    }
  }

  return out;
}

function applyFieldProjection(
  data: unknown,
  fields: string[],
): unknown {
  const fieldSet = new Set(fields);

  if (isPlainObject(data) && 'data' in data) {
    const out: Record<string, unknown> = {};
    const inner = data.data;
    if (Array.isArray(inner)) {
      out.data = inner.map((item) =>
        isJsonApiResource(item)
          ? projectResource(item, fieldSet)
          : isPlainObject(item)
            ? pickKeys(item, fieldSet, ['id'])
            : item,
      );
    } else if (isJsonApiResource(inner)) {
      out.data = projectResource(inner, fieldSet);
    } else if (isPlainObject(inner)) {
      out.data = pickKeys(inner, fieldSet, ['id']);
    } else {
      out.data = inner;
    }
    if ('meta' in data && data.meta !== undefined) {
      out.meta = data.meta;
    }
    return out;
  }

  if (Array.isArray(data)) {
    return data.map((item) =>
      isPlainObject(item) ? pickKeys(item, fieldSet, ['id']) : item,
    );
  }

  if (isPlainObject(data)) {
    return pickKeys(data, fieldSet, ['id']);
  }

  return data;
}

/**
 * Compact and/or project a Firefly III JSON response payload.
 */
export function compactResponseData(
  data: unknown,
  options: CompactOptions = {},
): unknown {
  const hasFields = Array.isArray(options.fields) && options.fields.length > 0;
  if (hasFields) {
    // Treat `fields` as an explicit allowlist: never prune caller-requested
    // keys via heuristic metadata compaction, only omit nullish leaves.
    return stripNullish(applyFieldProjection(data, options.fields!));
  }

  if (options.compact) {
    return compactValue(data, true);
  }

  return data;
}

function stripNullish(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripNullish);
  }
  if (!isPlainObject(value)) {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (v === null || v === undefined) continue;
    out[k] = stripNullish(v);
  }
  return out;
}

/**
 * Serialize JSON tool output using compact formatting when compaction or
 * field projection is enabled, or standard 2-space pretty-printing otherwise.
 */
export function formatJsonResponse(
  data: unknown,
  options: CompactOptions = {},
): string {
  const hasFields = Array.isArray(options.fields) && options.fields.length > 0;
  if (options.compact || hasFields) {
    const compacted = compactResponseData(data, options);
    return JSON.stringify(compacted);
  }
  return JSON.stringify(data, null, 2);
}
