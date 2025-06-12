/**
 * Core module for Firefly III MCP
 * Export all key types, functions, and utilities
 */

// Export types
export type { McpServerConfig, McpToolDefinition, CallToolRequestArguments } from './types.js';

// Export server related functionality
export { getServer, executeApiTool } from './server.js';

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