import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  Tool,
  CallToolRequestSchema,
  CallToolRequest,
  CallToolResult
} from "@modelcontextprotocol/sdk/types.js";
import { CallToolRequestArguments, McpServerConfig, McpToolDefinition } from "./types.js";
import { generatedTools } from "./tools.js";
import { Schema, Validator } from "@cfworker/json-schema";
import { openapiSchemaToJsonSchema } from "@openapi-contrib/openapi-schema-to-json-schema";
import { DEFAULT_PRESET_TAGS } from "./presets.js";

export const executeApiTool = async (
  toolName: string,
  definition: McpToolDefinition,
  toolArgs: CallToolRequestArguments,
  serverConfig: McpServerConfig,
): Promise<CallToolResult> => {
  let validatedArgs: CallToolRequestArguments;
  try {
    // Validate arguments against the input schema
    const schema = openapiSchemaToJsonSchema(definition.inputSchema);
    const validator = new Validator(schema as Schema, '4')
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
  let requestBodyData: unknown = undefined;

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
  const { pat, baseUrl } = serverConfig;
  headers['Authorization'] = `Bearer ${pat}`;

  // Construct the full URL
  const requestEndpoint = `${baseUrl}/api${urlPath}`
  const requestUrl = queryParams ? `${requestEndpoint}?${new URLSearchParams(queryParams).toString()}` : requestEndpoint;
  const requestMethod = definition.method.toUpperCase();

  // Log request info to stderr (doesn't affect MCP output)
  console.debug(`Executing tool "${toolName}": ${requestMethod} ${requestEndpoint}`);

  const response = await fetch(requestUrl, {
    method: definition.method.toUpperCase(),
    headers: headers,
    body: requestBodyData ? JSON.stringify(requestBodyData) : undefined,
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

/**
 * Get the MCP server instance
 * @param serverConfig - The server configuration
 * @returns The MCP server instance
 */
export const getServer = (serverConfig: McpServerConfig): Server => {
  const server = new Server(
    {
      name: 'Firefly III MCP Agent',
      version: '1.3.0',
    }, {
    capabilities: { tools: {} }
  })

  if (!serverConfig.baseUrl) {
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const unavailableTool: Tool = {
        name: 'unavailable',
        description: 'This tool is not available because the base URL is not configured. Please check your configuration and restart the server.',
        inputSchema: {
          type: 'object'
        },
        outputSchema: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'The error message'
            },
            message: {
              type: 'string',
              description: 'The error message'
            }
          }
        }
      }
      return { tools: [unavailableTool] }
    })
    server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest): Promise<CallToolResult> => {
      return {
        content: [{
          type: "text", text: JSON.stringify({
            error: 'Unavailable',
            message: 'Please check your configuration and restart the server.',
          }, null, 2)
        }]
      };
    });
    return server;
  }

  if (!serverConfig.pat) {
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const unauthorizedTool: Tool = {
        name: 'unauthorized',
        description: 'This tool is not available because the user is not authenticated. Please check your configuration and restart the server.',
        inputSchema: {
          type: 'object'
        },
        outputSchema: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'The error message'
            },
            message: {
              type: 'string',
              description: 'The error message'
            }
          }
        }
      }
      return { tools: [unauthorizedTool] }
    })
    server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest): Promise<CallToolResult> => {
      return {
        content: [{
          type: "text", text: JSON.stringify({
            error: 'Unauthorized',
            message: 'Please check your configuration and restart the server.',
          }, null, 2)
        }]
      };
    });
    return server;
  }

  const enableToolTags = serverConfig.enableToolTags ?? DEFAULT_PRESET_TAGS;

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const toolsForClient: Tool[] = generatedTools.filter(def => enableToolTags.length === 0 || enableToolTags.some(tag => def.tags.includes(tag))).map(def => ({
      name: def.name,
      description: def.description,
      inputSchema: {
        ...def.inputSchema,
        type: 'object',
      },
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
    return await executeApiTool(toolName, toolDefinition, toolArgs ?? {}, serverConfig);
  });
  return server;
}