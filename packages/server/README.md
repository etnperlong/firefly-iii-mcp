# Firefly III MCP Server - Express

This package provides an Express-based server implementation of the Firefly III MCP (Model Context Protocol) server. It supports Streamable HTTP and Server-Sent Events (SSE), making it ideal for integrating Firefly III with AI tools through a robust web server.

*[查看中文版](README_ZH.md)*

## Installation

```bash
npm install @firefly-iii-mcp/server
```

## Usage

### As a Command-Line Tool

You can run the server directly from the command line:

```bash
npx @firefly-iii-mcp/server --pat YOUR_PAT --baseUrl YOUR_FIREFLY_III_URL
```

#### Command-Line Options

- `-p, --pat <token>` - Firefly III Personal Access Token
- `-b, --baseUrl <url>` - Firefly III Base URL
- `-P, --port <number>` - Port to listen on (default: 3000)
- `-l, --logLevel <level>` - Log level: debug, info, warn, error (default: info)
- `-s, --preset <name>` - Tool preset to use (default, full, basic, budget, reporting, admin, automation)
- `-t, --tools <list>` - Comma-separated list of tool tags to enable
- `-h, --help` - Show help information

#### Environment Variables

You can also configure the server using environment variables:

```
FIREFLY_III_PAT=YOUR_PAT
FIREFLY_III_BASE_URL=YOUR_FIREFLY_III_URL
PORT=3000
LOG_LEVEL=info
FIREFLY_III_PRESET=default
FIREFLY_III_TOOLS=accounts,transactions,categories
```

#### Tool Filtering Options

You can filter which tools are exposed to the MCP client using presets or custom tool tags:

##### Using Presets

```bash
# Command-line argument
firefly-iii-mcp-server --preset PRESET_NAME

# Or environment variable
FIREFLY_III_PRESET=PRESET_NAME
```

Available presets:
- `default`: Basic tools for everyday use (accounts, bills, categories, tags, transactions, search, summary)
- `full`: All available tools
- `basic`: Core financial management tools
- `budget`: Budget-focused tools
- `reporting`: Reporting and analysis tools
- `admin`: Administration tools
- `automation`: Automation-related tools

##### Using Custom Tool Tags

```bash
# Command-line argument
firefly-iii-mcp-server --tools tag1,tag2,tag3

# Or environment variable
FIREFLY_III_TOOLS=tag1,tag2,tag3
```

> **Note**: Command-line arguments take precedence over environment variables. If both `--tools` and `--preset` are provided, `--tools` will be used.

### As a Library

#### Basic Setup

```typescript
import { createServer } from '@firefly-iii-mcp/server';

// Create and start the server with default configuration
const server = createServer({
  port: 3000,
  pat: process.env.FIREFLY_III_PAT,
  baseUrl: process.env.FIREFLY_III_BASE_URL
});

server.start().then(() => {
  console.log('MCP Server is running on http://localhost:3000');
});
```

#### Custom Configuration

```typescript
import { createServer, ServerConfig } from '@firefly-iii-mcp/server';

const config: ServerConfig = {
  port: 8080,
  pat: 'YOUR_FIREFLY_III_PAT',
  baseUrl: 'YOUR_FIREFLY_III_BASE_URL',
  corsOptions: {
    origin: 'https://yourdomain.com',
    credentials: true
  },
  logLevel: 'info',
  enableToolTags: ['accounts', 'transactions', 'categories'] // Filter available tools
};

const server = createServer(config);
server.start();
```

#### Using with HTTPS

```typescript
import { createServer } from '@firefly-iii-mcp/server';
import fs from 'fs';

const server = createServer({
  port: 443,
  pat: process.env.FIREFLY_III_PAT,
  baseUrl: process.env.FIREFLY_III_BASE_URL,
  https: {
    key: fs.readFileSync('path/to/key.pem'),
    cert: fs.readFileSync('path/to/cert.pem')
  }
});

server.start();
```

## Features

- **Express-Based Server**: Robust and production-ready web server
- **Streamable HTTP Support**: Compatible with streaming API interactions
- **Server-Sent Events (SSE)**: Efficient one-way communication channel
- **CORS Support**: Configurable cross-origin resource sharing
- **HTTPS Support**: Secure communication option
- **Customizable Logging**: Flexible logging configuration
- **Command-Line Interface**: Easy deployment without writing code
- **Tool Filtering**: Filter available tools using presets or custom tags

## API Endpoints

- `POST /mcp` - Primary MCP endpoint for Streamable HTTP requests
- `GET /sse` - Server-Sent Events endpoint for streaming responses
- `POST /messages` - Messages endpoint for SSE requests
- `GET /health` - Health check endpoint

## Requirements

- Node.js >= 20
- A Firefly III instance with a valid personal access token

## Development

This package is part of a monorepo managed with Turborepo. Please refer to the [CONTRIBUTING.md](../../CONTRIBUTING.md) file in the project root for detailed contribution guidelines.

## License

This project is licensed under the [MIT License](../../LICENSE). 