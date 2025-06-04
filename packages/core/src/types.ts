/**
 * Core type definitions for the openapi-to-mcp generator
 */
import type { OpenAPIV3 } from 'openapi-types';

/**
 * Upstream Config
 */
export type McpServerConfig = {
  baseUrl: string;
  pat: string;
}

/** 
 * Execution parameter for a tool
 */
export interface ExecutionParameter {
  name: string;
  in: 'path' | 'query' | 'header';
}

/**
 * MCP Tool Definition describes a tool extracted from an OpenAPI spec
 * for use in Model Context Protocol server
 */
export interface McpToolDefinition {
  /** Name of the tool, must be unique */
  name: string;
  /** Tags of the tool, used to group tools */
  tags: string[];
  /** Human-readable description of the tool */
  description: string;
  /** JSON Schema that defines the input parameters */
  inputSchema: OpenAPIV3.SchemaObject;
  /** HTTP method for the operation (get, post, etc.) */
  method: string;
  /** URL path template with parameter placeholders */
  pathTemplate: string;
  /** OpenAPI parameter objects for this operation */
  // parameters: OpenAPIV3.ParameterObject[];
  /** Parameter names and locations for execution */
  executionParameters: ExecutionParameter[];
  /** Content type for request body, if applicable */
  requestBodyContentType?: string;
  /** Security requirements for this operation */
  // securityRequirements: OpenAPIV3.SecurityRequirementObject[];
  /** Original operation ID from the OpenAPI spec */
  operationId: string;
}

export type CallToolRequestArguments = Record<string, unknown>;