# Firefly III MCP Server - Core

Core modules for Firefly III MCP (Model Context Protocol) server. This package provides the core functionality for interacting with the Firefly III API through the Model Context Protocol.

## Installation

```bash
npm install @firefly-iii-mcp/core
```

## Usage

This package is primarily used by the `@firefly-iii-mcp/local` package, but can also be used directly to create custom MCP server implementations.

```typescript
import { getServer, McpServerConfig } from '@firefly-iii-mcp/core';

const config: McpServerConfig = {
  pat: 'YOUR_PERSONAL_ACCESS_TOKEN',
  baseUrl: 'YOUR_FIREFLY_III_URL'
};

const server = getServer(config);

// Connect to a transport
// Example using StdioServerTransport
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
const transport = new StdioServerTransport();
await server.connect(transport);
```

## Requirements

- Node.js >= 20

## License

This project is licensed under the terms of the [LICENSE](../../LICENSE) file included in the repository. 