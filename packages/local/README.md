# Firefly III MCP Server - Local

This package provides a command-line tool for running the Firefly III MCP (Model Context Protocol) server locally. The MCP server integrates with Firefly III, a free and open-source personal finance manager.

*[查看中文版](README_ZH.md)*

## Installation

```bash
# Install globally
npm install -g @firefly-iii-mcp/local

# Or use directly with npx
npx @firefly-iii-mcp/local --pat YOUR_PAT --baseUrl YOUR_FIREFLY_III_URL
```

## Usage

To run the MCP server, you need to provide two required parameters:

- `FIREFLY_III_PAT`: Personal Access Token for your Firefly III instance
- `FIREFLY_III_BASE_URL`: URL of your Firefly III instance

You can provide these parameters in two ways:

### 1. Command-line arguments

```bash
firefly-iii-mcp --pat YOUR_PAT --baseUrl YOUR_FIREFLY_III_URL
```

### 2. Environment variables

Create a `.env` file with the following content:

```
FIREFLY_III_PAT=YOUR_PAT
FIREFLY_III_BASE_URL=YOUR_FIREFLY_III_URL
```

Then run:

```bash
firefly-iii-mcp
```

## Integration with AI Tools

Once the MCP server is running, you can connect to it using MCP-compatible AI tools. For example, using [supergateway](https://github.com/supergateway/supergateway):

```bash
npx -y supergateway --streamableHttp "stdio://"
```

This creates a gateway through which AI models can interact with your Firefly III instance.

## Requirements

- Node.js >= 20
- A Firefly III instance with a valid personal access token

## Development

This package is part of a monorepo managed with Turborepo. Please refer to the [CONTRIBUTING.md](../../CONTRIBUTING.md) file in the project root for detailed contribution guidelines.

## License

This project is licensed under the [MIT License](../../LICENSE). 