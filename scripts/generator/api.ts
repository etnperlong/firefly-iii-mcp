import { McpToolDefinition } from "../../src/types/mcp-tool-definition";
import type { OpenAPIV3 } from 'openapi-types';
import { extractToolsFromApi } from './utils/extract-tools';

/**
 * Options for generating the MCP tools
 */
export interface GetToolsOptions {
  /** Array of operation IDs to exclude from the tools list */
  excludeOperationIds?: string[];
  
  /** Optional filter function to exclude tools based on custom criteria */
  filterFn?: (tool: McpToolDefinition) => boolean;

  /** Optional function to rename the tool */
  renameFn?: (tool: McpToolDefinition) => McpToolDefinition;
}

/**
 * Get a list of tools from an OpenAPI specification
 * 
 * @param document OpenAPI document
 * @param options Options for generating the tools
 * @returns Promise that resolves to an array of tool definitions
 */
export async function getToolsFromOpenApiDocument(
  document: OpenAPIV3.Document,
  options: GetToolsOptions = {}
): Promise<McpToolDefinition[]> {
  try {
    
    // Extract tools from the Document
    const allTools = extractToolsFromApi(document);
    
    // Apply filters to exclude specified operationIds and custom filter function
    let filteredTools = allTools;
    
    // Filter by excluded operation IDs if provided
    
    if (options.excludeOperationIds && options.excludeOperationIds.length > 0) {
      const excludeSet = new Set(options.excludeOperationIds);
      filteredTools = filteredTools.filter(tool => !excludeSet.has(tool.operationId));
    }
    
    // Apply custom filter function if provided
    if (options.filterFn) {
      filteredTools = filteredTools.filter(options.filterFn);
    }

    // Apply custom rename function if provided
    if (options.renameFn) {
      filteredTools = filteredTools.map(options.renameFn);
    }

    // Return the filtered tools
    return filteredTools;
  } catch (error) {
    // Provide more context for the error
    if (error instanceof Error) {
      throw new Error(`Failed to extract tools from OpenAPI: ${error.message}`);
    }
    throw error;
  }
}