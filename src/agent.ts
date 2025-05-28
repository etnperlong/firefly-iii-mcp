import { McpAgent } from 'agents/mcp'
import { UserProps } from './types';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

type State = {
  token: string
}

export class FireflyIIIAgent extends McpAgent<Env, State, UserProps> {
  server = new McpServer({
    name: 'Firefly III MCP Agent',
    version: '1.0.0',
  })

  async onStart() {
    this.setState({
      token: this.props.token || ''
    })
  }

  // private accessToken: string | null = this.props.auth?.session.user?.access_token || null;

  async init() {
    this.server.tool(
      'debug_access_token',
      'Get the access token for the user',
      {},
      async () => {
        if (this.state.token) {
          return {
            content: [{
              type: 'text',
              text: this.state.token
            }]
          }
        } else {
          return {
            content: [{
              type: 'text',
              text: 'No access token found'
            }]
          }
        }
      }
    )
  }
}