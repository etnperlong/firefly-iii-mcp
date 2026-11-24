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

const createErrorResult = (payload: Record<string, unknown>): CallToolResult => ({
  isError: true,
  content: [{
    type: 'text',
    text: JSON.stringify(payload, null, 2),
  }],
});

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
      return createErrorResult({
        message: `Invalid arguments for tool '${toolName}'`,
        errors: errors,
      });
    }
  } catch (error: unknown) {
    return createErrorResult({
      message: `Error validating arguments for tool '${toolName}'`,
      error: error instanceof Error ? error.message : error,
    });
  }

  // Prepare URL, query parameters, headers, and request body
  let urlPath = definition.pathTemplate;
  const searchParams = new URLSearchParams();
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
        if (Array.isArray(value)) {
          // Firefly III expects repeated bracketed query params (e.g. accounts[]=1&accounts[]=2)
          for (const item of value) {
            if (typeof item !== 'undefined' && item !== null) {
              searchParams.append(param.name, String(item));
            }
          }
        } else {
          searchParams.append(param.name, String(value));
        }
      }
      else if (param.in === 'header') {
        headers[param.name.toLowerCase()] = String(value);
      }
    }
  });

  // Ensure all path parameters are resolved
  if (urlPath.includes('{')) {
    return createErrorResult({
      message: `Failed to resolve path parameters: ${urlPath}`,
    });
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
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const requestEndpoint = `${normalizedBaseUrl}/api${urlPath}`;
  const queryString = searchParams.toString();
  const requestUrl = queryString ? `${requestEndpoint}?${queryString}` : requestEndpoint;
  const requestMethod = definition.method.toUpperCase();

  // Log request info to stderr (doesn't affect MCP output)
  console.debug(`Executing tool "${toolName}": ${requestMethod} ${requestEndpoint}`);

  let response: Response;
  try {
    response = await fetch(requestUrl, {
      method: requestMethod,
      headers: headers,
      body: requestBodyData !== undefined ? JSON.stringify(requestBodyData) : undefined,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return createErrorResult({
      message: `Network error executing tool '${toolName}': ${errorMessage}`,
      error: errorMessage,
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    return createErrorResult({
      message: `Error executing tool '${toolName}': ${response.status} ${response.statusText}`,
      status: response.status,
      error: errorText,
    });
  }

  if (response.status === 204 || response.status === 205) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          status: response.status,
          message: `Tool '${toolName}' completed successfully (${response.status} ${response.statusText || 'No Content'}).`,
        }, null, 2),
      }],
    };
  }

  const responseType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  const responseText = await response.text();

  if (!responseText.trim()) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          status: response.status,
          message: `Tool '${toolName}' completed successfully with empty response body.`,
        }, null, 2),
      }],
    };
  }

  if (responseType?.includes('json')) {
    try {
      const responseData = JSON.parse(responseText);
      return {
        content: [{
          type: 'text', text: JSON.stringify(responseData, null, 2)
        }]
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return createErrorResult({
        message: `Invalid JSON response from tool '${toolName}': ${errorMessage}`,
        error: responseText,
      });
    }
  } else if (responseType?.includes('text')) {
    return {
      content: [{
        type: 'text', text: responseText
      }]
    };
  }

  // Default to error response for unsupported types
  return createErrorResult({
    error: `Unsupported response type: ${responseType}`,
    message: `Unsupported response type: ${responseType}`,
  });
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
      const payload = {
        error: 'Unavailable',
        message: 'Please check your configuration and restart the server.',
      };
      return {
        content: [{
          type: "text", text: JSON.stringify(payload, null, 2)
        }],
        structuredContent: payload,
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
      const payload = {
        error: 'Unauthorized',
        message: 'Please check your configuration and restart the server.',
      };
      return {
        content: [{
          type: "text", text: JSON.stringify(payload, null, 2)
        }],
        structuredContent: payload,
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
      return {
        isError: true,
        content: [{ type: "text", text: `Error: Unknown tool requested: ${toolName}` }],
      };
    }
    return await executeApiTool(toolName, toolDefinition, toolArgs ?? {}, serverConfig);
  });
  return server;
}