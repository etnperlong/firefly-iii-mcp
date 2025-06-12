# Firefly III MCP Server - Cloudflare Worker

This package provides an implementation of the Firefly III MCP (Model Context Protocol) server on Cloudflare Workers. With Cloudflare Workers, you can easily deploy the MCP server to the cloud and benefit from the performance advantages of a global edge network.

*[查看中文版](README_ZH.md)*

## Features

- Global edge deployment based on Cloudflare Workers
- Low latency and high availability service
- No server maintenance required
- Seamless integration with Firefly III API
- Tool filtering support via presets or custom tags

## Deployment Methods

### One-Click Deployment

The simplest method is to use the "Deploy to Cloudflare Workers" button for one-click deployment:

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/etnperlong/firefly-iii-mcp/tree/main/packages/cloudflare-worker)

### Manual Deployment

1. Clone this repository:
   ```bash
   git clone https://github.com/etnperlong/firefly-iii-mcp.git
   cd firefly-iii-mcp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. Deploy to Cloudflare Workers:
   ```bash
   cd packages/cloudflare-worker
   npm run deploy
   ```

## Configuration

After deployment, you need to configure the following environment variables in your Cloudflare Workers settings:

### Required Variables

- `FIREFLY_III_BASE_URL`: Your Firefly III instance URL (e.g., `https://firefly.yourdomain.com`)
- `FIREFLY_III_PAT`: Your Firefly III Personal Access Token

### Optional Variables

- `FIREFLY_III_PRESET`: Tool preset to use (default, full, basic, budget, reporting, admin, automation)
- `FIREFLY_III_TOOLS`: Comma-separated list of tool tags to enable (overrides FIREFLY_III_PRESET if both are set)

#### Available Presets

- `default`: Basic tools for everyday use (accounts, bills, categories, tags, transactions, search, summary)
- `full`: All available tools
- `basic`: Core financial management tools
- `budget`: Budget-focused tools
- `reporting`: Reporting and analysis tools
- `admin`: Administration tools
- `automation`: Automation-related tools

### Configuration Steps

1. Go to your Cloudflare dashboard
2. Navigate to Workers & Pages
3. Select your deployed Worker
4. Go to Settings > Variables
5. Add the required and optional variables as secret variables

## Usage

Once deployed and configured, you can access the MCP server at the following URL:

```
https://your-worker-name.your-account.workers.dev/mcp
```

You can provide this URL to MCP-compatible AI tools to enable them to interact with your Firefly III instance.

## Custom Domain

If you want to use your own domain, you can configure a custom domain in the Cloudflare Workers settings. For specific steps, please refer to the [Cloudflare documentation](https://developers.cloudflare.com/workers/platform/routing/custom-domains/).

## Technical Details

This package is built using the [Hono](https://hono.dev/) framework and leverages the edge computing capabilities of Cloudflare Workers.

## License

This project is licensed under the [MIT License](../../LICENSE). 