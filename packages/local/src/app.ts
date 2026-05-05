#!/usr/bin/env node

import { 
  getServer, 
  McpServerConfig, 
  Server, 
  getPresetTags, 
  getAvailablePresets, 
  presetExists, 
  ALL_TOOL_TAGS 
} from '@firefly-iii-mcp/core';
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

// Try to load environment variables from the current directory
const localEnvPath = resolve(process.cwd(), '.env');
if (existsSync(localEnvPath)) {
  config({ path: localEnvPath });
} else {
  // Fallback to default dotenv behavior
  config();
}

export class FireflyIIIMcpServer {
  private server: Server;
  private serverConfig: McpServerConfig;

  constructor() {
    // Get pat from command line args
    const patArgIndex = process.argv.indexOf('--pat');
    const pat = patArgIndex !== -1 ? process.argv[patArgIndex + 1] : process.env.FIREFLY_III_PAT;
    const baseUrlArgIndex = process.argv.indexOf('--baseUrl');
    const baseUrl = baseUrlArgIndex !== -1 ? process.argv[baseUrlArgIndex + 1] : process.env.FIREFLY_III_BASE_URL;

    // Optional extra headers to forward on every request (e.g. when Firefly III sits behind
    // an authentication proxy such as Cloudflare Access, AWS API Gateway, Authelia, etc.).
    // Env var takes precedence over the CLI arg. Expected format: a JSON object of strings.
    const extraHeadersArgIndex = process.argv.indexOf('--extraHeaders');
    const extraHeadersRaw = process.env.FIREFLY_III_EXTRA_HEADERS
      ?? (extraHeadersArgIndex !== -1 ? process.argv[extraHeadersArgIndex + 1] : undefined);
    let extraHeaders: Record<string, string> | undefined;
    if (extraHeadersRaw) {
      try {
        const parsed = JSON.parse(extraHeadersRaw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          extraHeaders = Object.fromEntries(
            Object.entries(parsed)
              .filter(([, v]) => typeof v === 'string')
              .map(([k, v]) => [k, v as string])
          );
        } else {
          console.warn('Warning: FIREFLY_III_EXTRA_HEADERS must be a JSON object of string values. Ignoring.');
        }
      } catch (e) {
        console.warn(`Warning: Could not parse FIREFLY_III_EXTRA_HEADERS as JSON. Ignoring. (${(e as Error).message})`);
      }
    }

    // Get preset and tools arguments
    const presetArgIndex = process.argv.indexOf('--preset');
    const toolsArgIndex = process.argv.indexOf('--tools');
    
    // Process enableToolTags
    let enableToolTags: string[] | undefined = undefined;
    
    // Check if --tools is provided (highest priority)
    if (toolsArgIndex !== -1 && process.argv[toolsArgIndex + 1]) {
      const toolsArg = process.argv[toolsArgIndex + 1];
      enableToolTags = toolsArg.split(',').map(tag => tag.trim()).filter(Boolean);
    } 
    // If --tools is not provided, check if --preset is provided (second priority)
    else if (presetArgIndex !== -1 && process.argv[presetArgIndex + 1]) {
      const presetArg = process.argv[presetArgIndex + 1].toLowerCase();
      if (presetExists(presetArg)) {
        enableToolTags = getPresetTags(presetArg);
      } else {
        console.warn(`Warning: Unknown preset "${presetArg}". Using default preset.`);
        console.warn(`Available presets: ${getAvailablePresets().join(', ')}`);
      }
    }
    // If no command line args, check environment variables (third priority)
    else {
      // Check FIREFLY_III_TOOLS environment variable
      if (process.env.FIREFLY_III_TOOLS) {
        enableToolTags = process.env.FIREFLY_III_TOOLS.split(',').map(tag => tag.trim()).filter(Boolean);
      }
      // If FIREFLY_III_TOOLS is not set, check FIREFLY_III_PRESET
      else if (process.env.FIREFLY_III_PRESET) {
        const presetArg = process.env.FIREFLY_III_PRESET.toLowerCase();
        if (presetExists(presetArg)) {
          enableToolTags = getPresetTags(presetArg);
        } else {
          console.warn(`Warning: Unknown preset "${presetArg}" in FIREFLY_III_PRESET. Using default preset.`);
          console.warn(`Available presets: ${getAvailablePresets().join(', ')}`);
        }
      }
    }
    
    if (!pat || !baseUrl) {
      console.error('Error: FIREFLY_III_PAT and FIREFLY_III_BASE_URL are required for running MCP server locally');
      console.error('Usage: firefly-iii-mcp --pat FIREFLY_III_PAT --baseUrl FIREFLY_III_BASE_URL [--preset PRESET_NAME] [--tools TAG1,TAG2,...]');
      console.error('Or set environment variables:');
      console.error('  FIREFLY_III_PAT: Personal Access Token');
      console.error('  FIREFLY_III_BASE_URL: Firefly III instance URL');
      console.error('  FIREFLY_III_PRESET: Optional preset name');
      console.error('  FIREFLY_III_TOOLS: Optional comma-separated list of tool tags');
      console.error('  FIREFLY_III_EXTRA_HEADERS: Optional JSON object with extra headers to forward on every request');
      console.error(`\nAvailable presets: ${getAvailablePresets().join(', ')}`);
      console.error(`Available tool tags: ${ALL_TOOL_TAGS.join(', ')}`);
      process.exit(1);
    }
    
    // Get server configuration
    this.serverConfig = {
      pat,
      baseUrl,
      enableToolTags,
      extraHeaders,
    };

    // Get server
    this.server = getServer(this.serverConfig);

    // Setup Error Logger
    this.server.onerror = (error) => {
      console.error('[Firefly III MCP Server] Error:', error);
    };

    process.on('SIGINT', () => {
      this.server.close();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      this.server.close();
      process.exit(0);
    });
  }

  async start(): Promise<void> {
    // Start server
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    // Log server info to stderr — stdout is reserved for MCP JSON-RPC framing.
    console.error(`[Firefly III MCP Server] Server running locally on stdio`);
    console.error(`[Firefly III MCP Server] Connected to Firefly III at: ${this.serverConfig.baseUrl}`);

    // Log extra header names (values are never logged)
    if (this.serverConfig.extraHeaders && Object.keys(this.serverConfig.extraHeaders).length > 0) {
      console.error(`[Firefly III MCP Server] Extra headers configured: ${Object.keys(this.serverConfig.extraHeaders).join(', ')} (values not logged)`);
    }

    // Log enabled tool tags if specified
    if (this.serverConfig.enableToolTags) {
      console.error(`[Firefly III MCP Server] Enabled tool tags: ${this.serverConfig.enableToolTags.join(', ')}`);
    } else {
      console.error(`[Firefly III MCP Server] Using default tool tags`);
    }
  }
}

const server = new FireflyIIIMcpServer();
server.start().catch((error) => {
  console.error('[Firefly III MCP Server] Error:', error);
  process.exit(1);
});