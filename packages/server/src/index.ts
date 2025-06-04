/**
 * Firefly III MCP Server - Express
 * 
 * This module provides an Express-based implementation of the Firefly III MCP server.
 */

export {
  createServer,
  ServerConfig,
  McpServer,
  HttpsOptions,
  CorsOptions
} from './server.js';

// Re-export the event store for advanced use cases
export { InMemoryEventStore } from './event-store.js'; 