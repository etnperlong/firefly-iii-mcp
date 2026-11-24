/**
 * Core module for Firefly III MCP
 * Export all key types, functions, and utilities
 */

// Export types
export type { McpServerConfig, McpToolDefinition, CallToolRequestArguments } from './types.js';

// Export server related functionality
export { getServer, executeApiTool } from './server.js';

// Export response compaction helpers
export { compactResponseData, formatJsonResponse, withCompactParameters } from './compact.js';
export type { CompactOptions } from './compact.js';

// Export custom batch transaction update helper
export {
  batchUpdateTransactionsToolDefinition,
  executeBatchUpdateTransactions,
} from './batch-transactions.js';
export type { BatchTransactionPatch, BatchItemResult } from './batch-transactions.js';

// Export generated tools
export { generatedTools } from './tools.js';

// Export presets
export { 
  ALL_TOOL_TAGS,
  DEFAULT_PRESET_TAGS,
  TOOL_PRESETS,
  getPresetTags,
  presetExists,
  getAvailablePresets
} from './presets.js';

export { Server } from '@modelcontextprotocol/sdk/server/index.js';