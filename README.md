# Firefly III MCP Server

This is a Model Context Protocol (MCP) server for Firefly III, a free and open-source personal finance manager. Through this MCP server, users can leverage AI tools to manage their Firefly III accounts and transactions, creating AI assistants for personal finance and accounting.

*[查看中文版](README_ZH.md)*

## Project Structure

This project uses a Turborepo-managed monorepo structure, containing the following main packages:

* **@firefly-iii-mcp/core** - Core functionality module providing the foundation for interacting with the Firefly III API
* **@firefly-iii-mcp/local** - Command-line tool for running the MCP server locally
* **@firefly-iii-mcp/cloudflare-worker** - Implementation for deployment to Cloudflare Workers
* **@firefly-iii-mcp/server** - Express-based server implementation with Streamable HTTP and SSE support

## Features

* Interact with Firefly III instances via AI
* Programmatically manage accounts and transactions
* Extensible toolset for various financial operations
* Support for both local and cloud deployment
* Compatible with the Model Context Protocol standard

## Prerequisites

* A running [Firefly III](https://www.firefly-iii.org/) instance
* A Cloudflare account if you plan to deploy using the "Deploy to Cloudflare" button

## Getting Started

### 1. Obtain a Firefly III Personal Access Token (PAT)

To allow the MCP server to interact with your Firefly III instance, you need to generate a Personal Access Token (PAT):

1. Log in to your Firefly III instance
2. Navigate to **Options > Profile > OAuth**
3. Under the "Personal access tokens" section, click on "Create new token"
4. Give your token a descriptive name (e.g., "MCP Server Token")
5. Click "Create"
6. **Important:** Copy the generated token immediately. You will not be able to see it again.

For more details, refer to the official Firefly III documentation on [Personal Access Tokens](https://docs.firefly-iii.org/how-to/firefly-iii/features/api/).

### 2. Configure the MCP Server

You need to provide the Firefly III PAT and your Firefly III instance URL to the MCP server. This can be done in several ways:

#### Request Headers (Recommended)

Provide these values in the headers of each request to the MCP server. This is generally the most secure method:

* `X-Firefly-III-Url`: Your Firefly III instance URL (e.g., `https://firefly.yourdomain.com`)
* `Authorization`: The Personal Access Token, typically prefixed with `Bearer ` (e.g., `Bearer YOUR_FIREFLY_III_PAT`)

Please consult the documentation of the AI tool or client you are using for the exact header names it expects.

#### Query Parameters (Use with caution)

Alternatively, you can provide these values in the query parameters of each request to the MCP server:

* `baseUrl`: Your Firefly III instance URL
* `pat`: Your Firefly III Personal Access Token

Please note that URLs, including query parameters, can be logged in various places, potentially exposing sensitive information.

#### Environment Variables (Primarily for self-hosting/local development)

Set the following environment variables before running the server:

```bash
FIREFLY_III_BASE_URL="YOUR_FIREFLY_III_INSTANCE_URL" # e.g., https://firefly.yourdomain.com
FIREFLY_III_PAT="YOUR_FIREFLY_III_PAT"
```

## Running the MCP Server

### Method 1: Local Mode
This method is suitable for clients that support calling MCP tools via standard input/output (stdio), such as [Claude Desktop](https://claude.ai/download).

Basic run command:

```bash
npx @firefly-iii-mcp/local --pat YOUR_PAT --baseUrl YOUR_FIREFLY_III_URL
```

You can also refer to the [official tutorial](https://modelcontextprotocol.io/quickstart/user) for configuration in JSON format.

```json
{
  "mcpServers": {
    "firefly-iii": {
      "command": "npx",
      "args": [
        "@firefly-iii-mcp/local",
        "--pat",
        "<Your Firefly III Personal Access Token>",
        "--baseUrl",
        "<Your Firefly III Base URL>"
      ]
    }
  }
}
```

### Method 2: Express Server (Recommended for Web Apps)

This method provides an HTTP-based server with Streamable HTTP and SSE support, making it ideal for web applications.

#### As a Command-Line Tool

```bash
npx @firefly-iii-mcp/server --pat YOUR_PAT --baseUrl YOUR_FIREFLY_III_URL
```

Command-line options:
- `-p, --pat <token>` - Firefly III Personal Access Token
- `-b, --baseUrl <url>` - Firefly III Base URL
- `-P, --port <number>` - Port to listen on (default: 3000)
- `-l, --logLevel <level>` - Log level: debug, info, warn, error (default: info)

#### As a Library

```bash
npm install @firefly-iii-mcp/server
```

Basic usage:

```typescript
import { createServer } from '@firefly-iii-mcp/server';

const server = createServer({
  port: 3000,
  pat: process.env.FIREFLY_III_PAT,
  baseUrl: process.env.FIREFLY_III_BASE_URL
});

server.start().then(() => {
  console.log('MCP Server is running on http://localhost:3000');
});
```

For more details, see the [@firefly-iii-mcp/server documentation](packages/server/README.md).

### Method 3: Deploy to Cloudflare Workers (Recommended for Production)

You can easily deploy this MCP server to Cloudflare Workers using the button below:

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/etnperlong/firefly-iii-mcp/tree/main/packages/cloudflare-worker)

**Note:** After deploying, you will need to configure the `FIREFLY_III_BASE_URL` and `FIREFLY_III_PAT` environment variables in your Cloudflare Worker's settings:

1. Go to your Cloudflare dashboard
2. Navigate to Workers & Pages
3. Select your deployed Worker
4. Go to Settings > Variables
5. Add `FIREFLY_III_BASE_URL` and `FIREFLY_III_PAT` as secret variables

### Method 4: Run Locally from Source

> [!NOTE]
> For production use, it is recommended to use the NPM package or deploy to Cloudflare Workers.

1. Clone the repository:
   ```bash
   git clone https://github.com/etnperlong/firefly-iii-mcp.git
   cd firefly-iii-mcp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file:
   ```
   FIREFLY_III_BASE_URL="YOUR_FIREFLY_III_INSTANCE_URL"
   FIREFLY_III_PAT="YOUR_FIREFLY_III_PAT"
   ```

4. Build the project:
   ```bash
   npm run build
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

## Development Guide

This project uses [Turborepo](https://turbo.build/) to manage the monorepo workflow and [Changesets](https://github.com/changesets/changesets) for versioning and publishing.

### Common Commands

- Build all packages: `npm run build`
- Build specific packages: `npm run build:core` or `npm run build:local`
- Clean build artifacts: `npm run clean`
- Development mode: `npm run dev`
- Publish packages: `npm run publish-packages`

For detailed development guidelines, please refer to the [contribution guide](CONTRIBUTING.md).

## Acknowledgements

This project utilizes and modifies generation scripts from [harsha-iiiv/openapi-mcp-generator](https://github.com/harsha-iiiv/openapi-mcp-generator). Many thanks to the original authors for their work.

## Contributing

Contributions are welcome! This project uses Turborepo to manage the monorepo workflow. Please see [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines on how to contribute.

## License

This project is licensed under the [MIT License](LICENSE).
