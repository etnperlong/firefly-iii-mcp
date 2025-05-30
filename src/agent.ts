import { McpAgent } from 'agents/mcp'
import { UpstreamConfig, CallToolRequestArguments, McpToolDefinition } from './types';
import { Schema, Validator } from '@cfworker/json-schema';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequest, CallToolRequestSchema, CallToolResult, ListToolsRequestSchema, Tool } from '@modelcontextprotocol/sdk/types.js';
import { generatedTools } from './generated/tools';


export class FireflyIIIAgent extends McpAgent<Env, {}, UpstreamConfig> {
  server = new Server({
    name: 'Firefly III MCP Agent',
    version: '1.2.1',
  }, {
    capabilities: { tools: {} }
  })

  // private accessToken: string | null = this.props.auth?.session.user?.access_token || null;

  private executeApiTool = async (
    toolName: string,
    definition: McpToolDefinition,
    toolArgs: CallToolRequestArguments,
  ): Promise<CallToolResult> => {
    let validatedArgs: CallToolRequestArguments;
    try {
      // Validate arguments against the input schema
      const schema = (typeof definition.inputSchema === 'object' && !!definition.inputSchema) ? definition.inputSchema : {};
      const validator = new Validator(schema as Schema, '7')
      const argsToParse = (typeof toolArgs === 'object' && toolArgs !== null) ? toolArgs : {};
      const validatedResult = validator.validate(argsToParse);
      if (validatedResult.valid) {
        validatedArgs = argsToParse;
      } else {
        const errors = validatedResult.errors;
        return {
          content: [{
            type: 'text', text: JSON.stringify({
              message: `Invalid arguments for tool '${toolName}'`,
              errors: errors,
            }, null, 2)
          }]
        };
      }
    } catch (error: unknown) {
      return {
        content: [{
          type: 'text', text: JSON.stringify({
            message: `Error validating arguments for tool '${toolName}'`,
            error: error,
          }, null, 2)
        }]
      }
    }

    // Prepare URL, query parameters, headers, and request body
    let urlPath = definition.pathTemplate;
    const queryParams: Record<string, any> = {};
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    let requestBodyData: any = undefined;

    // Apply parameters to the URL path, query, or headers
    definition.executionParameters.forEach((param) => {
      const value = validatedArgs[param.name];
      if (typeof value !== 'undefined' && value !== null) {
        if (param.in === 'path') {
          urlPath = urlPath.replace(`{${param.name}}`, encodeURIComponent(String(value)));
        }
        else if (param.in === 'query') {
          queryParams[param.name] = value;
        }
        else if (param.in === 'header') {
          headers[param.name.toLowerCase()] = String(value);
        }
      }
    });

    // Ensure all path parameters are resolved
    if (urlPath.includes('{')) {
      throw new Error(`Failed to resolve path parameters: ${urlPath}`);
    }

    // Handle request body if needed
    if (definition.requestBodyContentType && typeof validatedArgs['requestBody'] !== 'undefined') {
      requestBodyData = validatedArgs['requestBody'];
      headers['content-type'] = definition.requestBodyContentType;
    }

    /**
     * Used Preloaded Security Schemes, ignored for now
     */

    headers['Authorization'] = `Bearer ${this.props.pat}`;

    // Construct the full URL
    const requestEndpoint = `${this.props.baseUrl}/api${urlPath}`
    const requestUrl = queryParams ? `${requestEndpoint}?${new URLSearchParams(queryParams).toString()}` : requestEndpoint;
    const requestMethod = definition.method.toUpperCase();

    // Log request info to stderr (doesn't affect MCP output)
    console.debug(`Executing tool "${toolName}": ${requestMethod} ${requestEndpoint}`);

    const response = await fetch(requestUrl, {
      method: definition.method.toUpperCase(),
      headers: headers,
      ...(requestBodyData !== undefined && { body: requestBodyData }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        content: [{
          type: 'text', text: JSON.stringify({
            message: `Error executing tool '${toolName}': ${response.status} ${response.statusText}`,
            error: errorText,
          }, null, 2)
        }]
      }
    }

    const responseType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (responseType?.includes('json')) {
      const responseData = await response.json();
      return {
        content: [{
          type: 'text', text: JSON.stringify(responseData, null, 2)
        }]
      }
    } else if (responseType?.includes('text')) {
      const responseText = await response.text();
      return {
        content: [{
          type: 'text', text: responseText
        }]
      }
    }

    // Default to text response for unsupported types
    return {
      content: [{
          type: 'text', text: JSON.stringify({
          error: `Unsupported response type: ${responseType}`,
          message: `Unsupported response type: ${responseType}`,
        }, null, 2)
      }]
    }
  }

  async init() {
    if (!this.props.pat || !this.props.baseUrl) {
      this.server.setRequestHandler(ListToolsRequestSchema, async () => {
        const unauthorizedTool: Tool = {
          name: 'unauthorized',
          description: 'This tool is not available because the user is not authenticated or the base URL is not configured. Please contact your administrator to configure this MCP server.',
          inputSchema: {
            type: 'object'
          },
        }
        return { tools: [unauthorizedTool] }
      })
      this.server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest): Promise<CallToolResult> => {
        return {
          content: [{
            type: "text", text: JSON.stringify({
              error: 'Unauthorized',
              message: 'Please contact your administrator to get access to this tool',
            }, null, 2)
          }]
        };
      });
    } else {
      this.server.setRequestHandler(ListToolsRequestSchema, async () => {
        const toolsForClient: Tool[] = generatedTools.map(def => ({
          name: def.name,
          description: def.description,
          inputSchema: def.inputSchema as any,
        }));
        return { tools: toolsForClient };
      });
      this.server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest): Promise<CallToolResult> => {
        const { name: toolName, arguments: toolArgs } = request.params;
        const toolDefinition = generatedTools.find(tool => tool.name === toolName);
        if (!toolDefinition) {
          console.error(`Error: Unknown tool requested: ${toolName}`);
          return { content: [{ type: "text", text: `Error: Unknown tool requested: ${toolName}` }] };
        }
        return await this.executeApiTool(toolName, toolDefinition, toolArgs ?? {});
      });
    }
  }
}