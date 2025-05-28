import SwaggerParser from '@apidevtools/swagger-parser';
import { McpToolDefinition } from "../../src/types/mcp-tool-definition";
import type { OpenAPIV3 } from 'openapi-types';
import { extractToolsFromApi } from './utils/extract-tools';

/**
 * Get a list of tools from an OpenAPI specification
 * 
 * @param specPathOrUrl Path or URL to the OpenAPI specification
 * @param options Options for generating the tools
 * @returns Promise that resolves to an array of tool definitions
 */
export async function getToolsFromOpenApi(
  specPathOrUrl: string,
): Promise<McpToolDefinition[]> {
  try {
    // Parse the OpenAPI spec
    const api = (await SwaggerParser.dereference(specPathOrUrl)) as OpenAPIV3.Document

    // Extract tools from the API
    const allTools = extractToolsFromApi(api);
    
    // Apply filters to exclude specified operationIds and custom filter function
    // let filteredTools = allTools;
    
    // Filter by excluded operation IDs if provided
    /*
    if (options.excludeOperationIds && options.excludeOperationIds.length > 0) {
      const excludeSet = new Set(options.excludeOperationIds);
      filteredTools = filteredTools.filter(tool => !excludeSet.has(tool.operationId));
    }
    
    // Apply custom filter function if provided
    if (options.filterFn) {
      filteredTools = filteredTools.filter(options.filterFn);
    }
    */
    
    // Return the filtered tools with base URL added
    return allTools;
  } catch (error) {
    // Provide more context for the error
    if (error instanceof Error) {
      throw new Error(`Failed to extract tools from OpenAPI: ${error.message}`);
    }
    throw error;
  }
}

// Export types for convenience
export { McpToolDefinition };