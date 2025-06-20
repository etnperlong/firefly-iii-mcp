#!/usr/bin/env node

import { resolve } from 'path';
import { existsSync } from 'fs';
import { config } from 'dotenv';
import { createServer } from './server.js';
import { parseArgs } from 'node:util';
import { getPresetTags, presetExists, getAvailablePresets } from '@firefly-iii-mcp/core';

/**
 * Parse command line arguments
 */
function parseCommandLineArgs() {
  const options = {
    pat: {
      type: 'string',
      short: 'p',
      default: process.env.FIREFLY_III_PAT
    },
    baseUrl: {
      type: 'string',
      short: 'b',
      default: process.env.FIREFLY_III_BASE_URL
    },
    port: {
      type: 'string',
      short: 'P',
      default: process.env.PORT || '3000'
    },
    logLevel: {
      type: 'string',
      short: 'l',
      default: process.env.LOG_LEVEL || 'info'
    },
    preset: {
      type: 'string',
      short: 's',
      default: process.env.FIREFLY_III_PRESET
    },
    tools: {
      type: 'string',
      short: 't',
      default: process.env.FIREFLY_III_TOOLS
    },
    help: {
      type: 'boolean',
      short: 'h'
    }
  } as const;

  try {
    const { values } = parseArgs({ options, allowPositionals: false });
    return values;
  } catch (error) {
    console.error('Error parsing command line arguments:', error);
    process.exit(1);
  }
}

/**
 * Print help information
 */
function printHelp() {
  console.log(`
Firefly III MCP Server - Express

Usage: firefly-iii-mcp-server [options]

Options:
  -p, --pat <token>       Firefly III Personal Access Token
  -b, --baseUrl <url>     Firefly III Base URL
  -P, --port <number>     Port to listen on (default: 3000)
  -l, --logLevel <level>  Log level: debug, info, warn, error (default: info)
  -s, --preset <name>     Tool preset to use (default, full, basic, budget, reporting, admin, automation)
  -t, --tools <list>      Comma-separated list of tool tags to enable
  -h, --help              Show this help information

Environment variables:
  FIREFLY_III_PAT         Firefly III Personal Access Token
  FIREFLY_III_BASE_URL    Firefly III Base URL
  PORT                    Port to listen on
  LOG_LEVEL               Log level
  FIREFLY_III_PRESET      Tool preset to use
  FIREFLY_III_TOOLS       Comma-separated list of tool tags to enable

Examples:
  firefly-iii-mcp-server --pat YOUR_PAT --baseUrl https://firefly.example.com
  firefly-iii-mcp-server --port 8080 --logLevel debug
  firefly-iii-mcp-server --preset budget
  firefly-iii-mcp-server --tools accounts,transactions,categories
  `);
  process.exit(0);
}

/**
 * Main function
 */
async function main() {
  // Load environment variables from .env file
  const localEnvPath = resolve(process.cwd(), '.env');
  if (existsSync(localEnvPath)) {
    config({ path: localEnvPath });
  } else {
    // Fallback to default dotenv behavior
    config();
  }

  // Parse command line arguments
  const args = parseCommandLineArgs();

  // Show help if requested
  if (args.help) {
    printHelp();
  }

  // Check required parameters
  const pat = args.pat;
  const baseUrl = args.baseUrl;

  if (!pat || !baseUrl) {
    console.error('Error: Firefly III Personal Access Token (--pat) and Base URL (--baseUrl) are required');
    console.error('Set these values via command line arguments or environment variables (FIREFLY_III_PAT, FIREFLY_III_BASE_URL)');
    process.exit(1);
  }

  // Parse port
  const port = parseInt(args.port, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    console.error('Error: Port must be a valid number between 1 and 65535');
    process.exit(1);
  }

  // Validate log level
  const logLevel = args.logLevel;
  if (!['debug', 'info', 'warn', 'error'].includes(logLevel)) {
    console.error('Error: Log level must be one of: debug, info, warn, error');
    process.exit(1);
  }

  // Process enableToolTags
  let enableToolTags: string[] | undefined = undefined;

  // Check if --tools is provided (highest priority)
  if (args.tools) {
    enableToolTags = args.tools.split(',').map(tag => tag.trim()).filter(Boolean);
  }
  // If --tools is not provided, check if --preset is provided (second priority)
  else if (args.preset) {
    const presetArg = args.preset.toLowerCase();
    if (presetExists(presetArg)) {
      enableToolTags = getPresetTags(presetArg);
    } else {
      console.warn(`Warning: Unknown preset "${presetArg}". Using default preset.`);
      console.warn(`Available presets: ${getAvailablePresets().join(', ')}`);
    }
  }

  // Create and start server
  const server = createServer({
    port,
    pat,
    baseUrl,
    logLevel: logLevel as 'debug' | 'info' | 'warn' | 'error',
    enableToolTags
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    try {
      await server.stop();
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  });

  process.on('SIGTERM', async () => {
    try {
      await server.stop();
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  });

  // Start the server
  try {
    await server.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});