import { Context } from "hono";

export const getToken = (c: Context<{
  Bindings: Env;
}, "/userInfo", {}>) => {
  const tokenInQuery = c.req.query('pat');
  const tokenInHeader = c.req.header('Authorization')?.split(' ')[1];
  const tokenInSecret = c.env.FIREFLY_III_PAT;
  const token = tokenInQuery || tokenInHeader || tokenInSecret;
  return token;
}