import { Context } from "hono";
import { UpstreamConfig } from "./types";

export const getUpstreamConfig = (c: Context<{
  Bindings: Env;
}>): UpstreamConfig => {
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
  return {
    baseUrl,
    pat,
  };
}