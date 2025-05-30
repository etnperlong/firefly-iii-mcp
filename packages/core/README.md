# Firefly III MCP Server - Core

Core module for the Firefly III MCP (Model Context Protocol) server. This package provides the foundation for interacting with the Firefly III API through the Model Context Protocol.

*[查看中文版](README_ZH.md)*

## Installation

```bash
npm install @firefly-iii-mcp/core
```

## Usage

This package is primarily used by the `@firefly-iii-mcp/local` and `@firefly-iii-mcp/cloudflare-worker` packages, but can also be used directly to create custom MCP server implementations.

```typescript
import { getServer, McpServerConfig } from '@firefly-iii-mcp/core';

// Create configuration
const config: McpServerConfig = {
  pat: 'YOUR_PERSONAL_ACCESS_TOKEN',
  baseUrl: 'YOUR_FIREFLY_III_URL'
};

// Get server instance
const server = getServer(config);

// Connect to a transport
// Example using StdioServerTransport
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
const transport = new StdioServerTransport();
await server.connect(transport);
```

## Features

- Provides complete interaction with the Firefly III API
- Implements the Model Context Protocol standard
- Supports multiple transport methods (stdio, HTTP, etc.)

## Requirements

- Node.js >= 20
- ESM module support

## Development

This package is part of a monorepo managed with Turborepo. Please refer to the [CONTRIBUTING.md](../../CONTRIBUTING.md) file in the project root for detailed contribution guidelines.

## License

This project is licensed under the [MIT License](../../LICENSE). 