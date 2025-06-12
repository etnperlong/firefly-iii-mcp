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
# Optional: Use a preset for tool filtering
FIREFLY_III_PRESET=default
# Optional: Specify custom tool tags (overrides FIREFLY_III_PRESET if both are set)
FIREFLY_III_TOOLS=accounts,transactions,categories
```

Then run:

```bash
firefly-iii-mcp
```

### Tool Filtering Options

You can filter which tools are exposed to the MCP client using the following options:

#### Using Presets

```bash
# Command-line argument
firefly-iii-mcp --pat YOUR_PAT --baseUrl YOUR_FIREFLY_III_URL --preset PRESET_NAME

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

#### Using Custom Tool Tags

```bash
# Command-line argument
firefly-iii-mcp --pat YOUR_PAT --baseUrl YOUR_FIREFLY_III_URL --tools tag1,tag2,tag3

# Or environment variable
FIREFLY_III_TOOLS=tag1,tag2,tag3
```

Available tool tags: about, accounts, attachments, autocomplete, available_budgets, bills, budgets, categories, charts, configuration, currencies, currency_exchange_rates, data, insight, links, object_groups, piggy_banks, preferences, recurrences, rule_groups, rules, search, summary, tags, transactions, user_groups, users, webhooks

Tool tags are defined in [core/src/presets.ts](../../packages/core/src/presets.ts) file. You can also refer to Firefly III [API Docs](https://api-docs.firefly-iii.org/?urls.primaryName=6.2.13+%28v1%29) for more details.

> **Note**: Command-line arguments take precedence over environment variables. If both `--tools` and `--preset` are provided, `--tools` will be used.

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