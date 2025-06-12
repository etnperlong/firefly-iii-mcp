import { Context } from "hono";
import { McpServerConfig } from "@firefly-iii-mcp/core";
import { getPresetTags } from "@firefly-iii-mcp/core";

export const getMcpServerConfig = (c: Context<{
  Bindings: Env;
}>): McpServerConfig => {
  /** Token */
  const patInQuery = c.req.query('pat');
  const patInHeader = c.req.header('Authorization')?.split(' ')[1];
  const patInSecret = c.env.FIREFLY_III_PAT;
  const pat = patInQuery || patInHeader || patInSecret;
  /** Base URL */
  const baseUrlInQuery = c.req.query('baseUrl');
  const baseUrlInHeader = c.req.header('X-Firefly-III-Url');
  const baseUrlInSecret = c.env.FIREFLY_III_BASE_URL;
  const baseUrl = baseUrlInQuery || baseUrlInHeader || baseUrlInSecret;
  
  /** Tool Filtering */
  let enableToolTags: string[] | undefined = undefined;
  
  // Check for FIREFLY_III_TOOLS environment variable (higher priority)
  if (c.env.FIREFLY_III_TOOLS) {
    enableToolTags = c.env.FIREFLY_III_TOOLS.split(',').map(tag => tag.trim()).filter(Boolean);
  }
  // If FIREFLY_III_TOOLS is not set, check FIREFLY_III_PRESET
  else if (c.env.FIREFLY_III_PRESET) {
    try {
      enableToolTags = getPresetTags(c.env.FIREFLY_III_PRESET);
    } catch (error) {
      console.warn(`Warning: Error processing preset "${c.env.FIREFLY_III_PRESET}". Using default preset.`);
    }
  }
  
  return {
    baseUrl,
    pat,
    enableToolTags
  };
}