# Firefly III MCP Server - Local

This package provides a command-line tool to run Firefly III MCP (Model Context Protocol) server locally. The MCP server integrates with Firefly III, a free and open-source personal finance manager.

## Installation

```bash
# Install globally
npm install -g @firefly-iii-mcp/local

# Or use it directly with npx
npx @firefly-iii-mcp/local --pat YOUR_PAT --baseUrl YOUR_FIREFLY_III_URL
```

## Usage

To run the MCP server, you need to provide two required parameters:

- `PAT`: Personal Access Token for your Firefly III instance
- `BASE_URL`: URL of your Firefly III instance

You can provide these parameters in two ways:

### 1. Command-line arguments

```bash
firefly-iii-mcp --pat YOUR_PAT --baseUrl YOUR_FIREFLY_III_URL
```

### 2. Environment variables

Create a `.env` file with the following content:

```
PAT=YOUR_PAT
BASE_URL=YOUR_FIREFLY_III_URL
```

Then run:

```bash
firefly-iii-mcp
```

## Requirements

- Node.js >= 20

## License

This project is licensed under the terms of the [LICENSE](../../LICENSE) file included in the repository. 