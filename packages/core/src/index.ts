/**
 * Core module for Firefly III MCP
 * Export all key types, functions, and utilities
 */

// Export types
export type { McpServerConfig, McpToolDefinition, SecuritySchemeDefinition, CallToolRequestArguments } from './types.js';

// Export server related functionality
export { getServer, executeApiTool } from './server.js';

// Export generated tools
export { generatedTools, securitySchemes } from './tools.js';

export { Server } from '@modelcontextprotocol/sdk/server/index.js';