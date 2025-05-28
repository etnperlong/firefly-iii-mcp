import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequest, CallToolRequestSchema, CallToolResult, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";
import { generatedTools, securitySchemes } from "./definitions/tools";
import { executeApiTool } from "./executor";
import { BlankInput } from "hono/types";
import { Context } from "hono";

export const getServer = (c: Context<{
  Bindings: CloudflareBindings;
}, "/mcp", BlankInput>) => {
  const server = new Server({
    name: 'firefly-iii-mcp',
    version: '6.2.13',
  }, {
    capabilities:{ tools: {} }
  })

  const kv = c.env.OAUTH_TOKEN_CACHE;

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const toolsForClient: Tool[] = generatedTools.map(def => ({
      name: def.name,
      description: def.description,
      inputSchema: def.inputSchema as any,
    }));
    return { tools: toolsForClient };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest): Promise<CallToolResult> => {
    const { name: toolName, arguments: toolArgs } = request.params;
    const toolDefinition = generatedTools.find(tool => tool.name === toolName);
    if (!toolDefinition) {
      console.error(`Error: Unknown tool requested: ${toolName}`);
      return { content: [{ type: "text", text: `Error: Unknown tool requested: ${toolName}` }] };
    }
    return await executeApiTool(toolName, toolDefinition, toolArgs ?? {}, securitySchemes, kv);
  });

  return server;
}