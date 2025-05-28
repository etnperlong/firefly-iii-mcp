import { McpAgent } from 'agents/mcp'
import { UserProps } from './types';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export class FireflyIIIAgent extends McpAgent<Env, {}, UserProps> {
  server = new McpServer({
    name: 'Firefly III MCP Agent',
    version: '1.0.0',
  })

  // private accessToken: string | null = this.props.auth?.session.user?.access_token || null;

  async init() {
    this.server.tool(
      'debug_access_token',
      'Get the access token for the user',
      {},
      async () => {
        return {
          content: [{
            type: 'text',
            text: 'No access token found'
          }]
        }
      }
    )
  }
}