/**
 * Functions for extracting tools from an OpenAPI specification
 */
import { OpenAPIV3 } from 'openapi-types';
import * as changeCase from 'change-case';
import { McpToolDefinition } from '../../src/types';

/**
 * Extracts tool definitions from an OpenAPI document
 *
 * @param api OpenAPI document
 * @returns Array of MCP tool definitions
 */
export function extractToolsFromApi(api: OpenAPIV3.Document): McpToolDefinition[] {
  const tools: McpToolDefinition[] = [];
  const usedNames = new Set<string>();

  if (!api.paths) return tools;

  for (const [path, pathItem] of Object.entries(api.paths)) {
    if (!pathItem) continue;

    for (const method of Object.values(OpenAPIV3.HttpMethods)) {
      const operation = pathItem[method];
      if (!operation) continue;

      const tags = operation.tags || [];

      // Generate a unique name for the tool
      let baseName = operation.operationId ? changeCase.snakeCase(operation.operationId) : generateOperationId(method, path);
      if (!baseName) continue;

      // Sanitize the name to be MCP-compatible (only a-z, 0-9, _, -)
      baseName = baseName
        .replace(/\./g, '_')
        .replace(/[^a-z0-9_-]/gi, '_')
        .toLowerCase();

      let finalToolName = baseName;
      let counter = 1;
      while (usedNames.has(finalToolName)) {
        finalToolName = `${baseName}_${counter++}`;
      }
      usedNames.add(finalToolName);

      // Get or create a description
      const description =
        operation.description || operation.summary || `Executes ${method.toUpperCase()} ${path}`;

      // Generate input schema and extract parameters
      const { inputSchema, parameters, requestBodyContentType } =
        generateInputSchemaAndDetails(operation);

      // Filter Input Schema
      if (typeof inputSchema === 'object' && inputSchema.properties) {
        delete inputSchema.properties['X-Trace-Id'];
      }

      // Extract parameter details for execution
      const executionParameters = parameters.filter((p) => p.name !== 'X-Trace-Id')
        .map((p) => ({ name: p.name, in: p.in as 'path' | 'query' | 'header' }));

      // Create the tool definition
      tools.push({
        name: finalToolName,
        tags,
        description,
        inputSchema,
        method,
        pathTemplate: path,
        // parameters: filteredParameters,
        executionParameters,
        requestBodyContentType,
        // securityRequirements,
        operationId: baseName,
      });
    }
  }

  return tools;
}

/**
 * Generates input schema and extracts parameter details from an operation
 *
 * @param operation OpenAPI operation object
 * @returns Input schema, parameters, and request body content type
 */
export function generateInputSchemaAndDetails(operation: OpenAPIV3.OperationObject): {
  inputSchema: OpenAPIV3.SchemaObject;
  parameters: OpenAPIV3.ParameterObject[];
  requestBodyContentType?: string;
} {
  const properties: { [key: string]: OpenAPIV3.SchemaObject } = {};
  const required: string[] = [];

  // Process parameters
  const allParameters: OpenAPIV3.ParameterObject[] = Array.isArray(operation.parameters)
    ? operation.parameters.map((p) => p as OpenAPIV3.ParameterObject)
    : [];

  allParameters.forEach((param) => {
    if (!param.name || !param.schema) return;

    const paramSchema = mapOpenApiSchemaToJsonSchema(param.schema as OpenAPIV3.SchemaObject);
    if (typeof paramSchema === 'object') {
      paramSchema.description = param.description || paramSchema.description;
    }

    properties[param.name] = paramSchema;
    if (param.required) required.push(param.name);
  });

  // Process request body (if present)
  let requestBodyContentType: string | undefined = undefined;

  if (operation.requestBody) {
    const opRequestBody = operation.requestBody as OpenAPIV3.RequestBodyObject;
    const jsonContent = opRequestBody.content?.['application/json'];
    const firstContent = opRequestBody.content
      ? Object.entries(opRequestBody.content)[0]
      : undefined;

    if (jsonContent?.schema) {
      requestBodyContentType = 'application/json';
      const bodySchema = mapOpenApiSchemaToJsonSchema(jsonContent.schema as OpenAPIV3.SchemaObject);

      if (typeof bodySchema === 'object') {
        bodySchema.description =
          opRequestBody.description || bodySchema.description || 'The JSON request body.';
      }

      properties['requestBody'] = bodySchema;
      if (opRequestBody.required) required.push('requestBody');
    } else if (firstContent) {
      const [contentType] = firstContent;
      requestBodyContentType = contentType;

      properties['requestBody'] = {
        type: 'string',
        description: opRequestBody.description || `Request body (content type: ${contentType})`,
      };

      if (opRequestBody.required) required.push('requestBody');
    }
  }

  // Combine everything into a JSON Schema
  const inputSchema: OpenAPIV3.SchemaObject = {
    type: 'object',
    properties,
    ...(required.length > 0 && { required }),
  };

  return { inputSchema, parameters: allParameters, requestBodyContentType };
}

/**
 * Maps an OpenAPI schema to a JSON Schema
 *
 * @param schema OpenAPI schema object or reference
 * @returns JSON Schema representation
 */
export function mapOpenApiSchemaToJsonSchema(
  schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject
): OpenAPIV3.SchemaObject {
  // Handle reference objects
  if ('$ref' in schema) {
    // It's generally better to resolve references, but for now,
    // we'll return a generic object schema and log a warning.
    // Depending on the use case, throwing an error or having a more
    // sophisticated resolution mechanism might be necessary.
    console.warn(`Encountered an unresolved schema reference: '${schema.$ref}'. Returning a generic object schema.`);
    return { type: 'object', description: `Reference to ${schema.$ref}` };
  }

  // Handle boolean schemas (OpenAPI allows schema to be true/false)
  if (typeof schema === 'boolean') {
    return schema;
  }

  // Create a shallow copy to avoid modifying the original schema object
  const jsonSchema = schema;

  // Handle format for string types - only keep 'enum' and 'date-time' formats
  if (jsonSchema.type && jsonSchema.format) {
    switch (jsonSchema.type) {
      case 'string':
        if (jsonSchema.format !== 'date-time' && jsonSchema.format !== 'enum') {
          delete jsonSchema.format;
        }
        break;
      case 'number':
        if (jsonSchema.format !== 'float' && jsonSchema.format !== 'double') {
          delete jsonSchema.format;
        }
        break;
      case 'integer':
        if (jsonSchema.format !== 'int32' && jsonSchema.format !== 'int64') {
          delete jsonSchema.format;
        }
        break;
      case 'boolean':
        delete jsonSchema.format;
        break;
      default:
        break;
    }
  }

  // Validate required fields against properties
  if (jsonSchema.required && Array.isArray(jsonSchema.required) && jsonSchema.properties) {
    const invalidRequiredFields = jsonSchema.required.filter(
      (field: string) => !jsonSchema.properties?.[field]
    );

    if (invalidRequiredFields.length > 0) {
      console.warn(
        `Schema has required fields that don't exist in properties: ${invalidRequiredFields.join(', ')}`
      );

      // Filter out invalid required fields
      jsonSchema.required = jsonSchema.required.filter(
        (field: string) => jsonSchema.properties?.[field]
      );

      // If no required fields left, remove the required property
      if (jsonSchema.required.length === 0) {
        delete jsonSchema.required;
      }
    }
  }

  // Recursively process nested schemas
  if (jsonSchema.properties) {
    const mappedProps: { [key: string]: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject } = {};
    for (const [key, propSchema] of Object.entries(jsonSchema.properties)) {
      mappedProps[key] = mapOpenApiSchemaToJsonSchema(propSchema);
    }
    jsonSchema.properties = mappedProps;
  }

  if (jsonSchema.type === 'array' && jsonSchema.items) {
    jsonSchema.items = mapOpenApiSchemaToJsonSchema(jsonSchema.items);
  }

  const arrayKeywords = ['allOf', 'anyOf', 'oneOf'];
  for (const keyword of arrayKeywords) {
    if (Array.isArray(jsonSchema[keyword])) {
      jsonSchema[keyword] = jsonSchema[keyword].map((subSchema: OpenAPIV3.SchemaObject) =>
        mapOpenApiSchemaToJsonSchema(subSchema)
      );
    }
  }

  return jsonSchema;
}


/**
 * Convert a string to title case
 *
 * @param str String to convert
 * @returns Title case string
 */
export function titleCase(str: string): string {
  // Converts snake_case, kebab-case, or path/parts to TitleCase
  return str
    .toLowerCase()
    .replace(/[-_/](.)/g, (_, char) => char.toUpperCase()) // Handle separators
    .replace(/^{/, '') // Remove leading { from path params
    .replace(/}$/, '') // Remove trailing } from path params
    .replace(/^./, (char) => char.toUpperCase()); // Capitalize first letter
}

/**
 * Generates an operation ID from method and path
 *
 * @param method HTTP method
 * @param path API path
 * @returns Generated operation ID
 */
export function generateOperationId(method: string, path: string): string {
  // Generator: get /users/{userId}/posts -> GetUsersPostsByUserId
  const parts = path.split('/').filter((p) => p); // Split and remove empty parts

  let name = method.toLowerCase(); // Start with method name

  parts.forEach((part, index) => {
    if (part.startsWith('{') && part.endsWith('}')) {
      // Append 'By' + ParamName only for the *last* path parameter segment
      if (index === parts.length - 1) {
        name += 'By' + titleCase(part);
      }
      // Potentially include non-terminal params differently if needed, e.g.:
      // else { name += 'With' + titleCase(part); }
    } else {
      // Append the static path part in TitleCase
      name += titleCase(part);
    }
  });

  // Simple fallback if name is just the method (e.g., GET /)
  if (name === method.toLowerCase()) {
    name += 'Root';
  }

  // Ensure first letter is uppercase after potential lowercase method start
  name = name.charAt(0).toUpperCase() + name.slice(1);

  name = changeCase.snakeCase(name);

  return name;
}