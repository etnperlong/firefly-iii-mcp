import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors';

import { FireflyIIIAgent } from './agent';
import { AgentProps } from './types';
import { getToken } from './auth';

const app = new Hono<{ Bindings: Env }>()

app.use(logger())
app.use('*', cors());
// Streamable MCP Server
app.use("/mcp", (c) => {
  const token = getToken(c);
  const agentContext = {
    ...c.executionCtx,
    props: { token: token } satisfies AgentProps
  }
  const mcp = FireflyIIIAgent.serve('/mcp').fetch(c.req.raw, c.env, agentContext);
  return mcp;
});

// SSE MCP Server
app.use("/sse*", (c) => {
  const token = getToken(c);
  const agentContext = {
    ...c.executionCtx,
    props: { token: token } satisfies AgentProps
  }
  const mcp = FireflyIIIAgent.serveSSE('/sse').fetch(c.req.raw, c.env, agentContext);
  return mcp;
});

export default app
export { FireflyIIIAgent } from './agent';
