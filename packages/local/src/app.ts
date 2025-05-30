#!/usr/bin/env node

import { getServer, McpServerConfig, Server } from '@firefly-iii-mcp/core';
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
    
    if (!pat || !baseUrl) {
      console.error('Error: FIREFLY_III_PAT and FIREFLY_III_BASE_URL are required for running MCP server locally');
      console.error('Usage: firefly-iii-mcp --pat FIREFLY_III_PAT --baseUrl FIREFLY_III_BASE_URL');
      console.error('Or set FIREFLY_III_PAT and FIREFLY_III_BASE_URL environment variables in a .env file');
      process.exit(1);
    }
    
    // Get server configuration
    this.serverConfig = {
      pat,
      baseUrl,
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

    // Log server info
    console.log(`[Firefly III MCP Server] Server running locally on stdio`);
    console.log(`[Firefly III MCP Server] Connected to Firefly III at: ${this.serverConfig.baseUrl}`);
  }
}

const server = new FireflyIIIMcpServer();
server.start().catch((error) => {
  console.error('[Firefly III MCP Server] Error:', error);
  process.exit(1);
});