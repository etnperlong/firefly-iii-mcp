import { McpAgent } from 'agents/mcp'
import { getServer, Server, McpServerConfig } from '@firefly-iii-mcp/core';


export class FireflyIIIAgent extends McpAgent<Env, {}, McpServerConfig> {

  server: Server = new Server({
    name: 'Stub MCP Server',
    version: '0.0.1',
  });

  async init() {
    this.server = getServer(this.props);
    return;
  }
}