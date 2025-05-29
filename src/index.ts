import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors';

import { FireflyIIIAgent } from './agent';
import { AgentProps } from './types';
import { getToken, setupOAuth, verifyAuth } from './auth';

const app = new Hono<{ Bindings: Env }>()
// Setup authentication
setupOAuth(app);

app.use(logger())
app.use('*', cors());

app.get('/api/success', (c) => {
  // Get User Info and save to KV
  const auth = c.get('authUser');
  return c.json(auth.session.user);
})

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.get('/userInfo', verifyAuth(), (c) => {
  const auth = c.get('authUser');
  return c.json(auth.session.user);
})

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
