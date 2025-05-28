import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { InitializeRequestSchema, JSONRPCError, Request } from "@modelcontextprotocol/sdk/types.js";
import { v4 as uuid } from 'uuid';
import { Context } from "hono";
import { BlankEnv, BlankInput } from "hono/types";
import { toFetchResponse, toReqRes } from "fetch-to-node";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

export class MCPStreamableHttpServer {
  private server: Server;

  constructor(server: Server) {
    this.server = server;
  }

  async handleMcpRequest(c: Context<{
    Bindings: CloudflareBindings;
}, "/mcp", BlankInput>) {
    const sessionId = c.req.header("mcp-session-id");
    console.debug(`Received MCP request ${sessionId ? 'with session ID: ' + sessionId : 'without session ID'}`);

    try {
      const body = await c.req.json();
      const { req, res } = toReqRes(c.req.raw);


      // Create new transport for initialize requests

      console.debug("Creating new StreamableHTTP transport for MCP request");

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      })

      // Connect the transport to the MCP server
      await this.server.connect(transport);

      // Handle the request with the transport
      await transport.handleRequest(req, res, body);

      // Cleanup when the response ends
      res.on('close', () => {
        console.error(`Request closed for new session`);
      });

      // Convert Node.js response back to Fetch Response
      return toFetchResponse(res);

    } catch (error) {
      console.error('Error handling MCP request:', error);
      return c.json(
        this.createErrorResponse("Internal server error."),
        500
      );
    }
  }

  /**
   * Create a JSON-RPC error response
   */
  private createErrorResponse(message: string): JSONRPCError {
    return {
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: message,
      },
      id: uuid(),
    };
  }
}