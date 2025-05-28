import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors';

import { FireflyIIIAgent } from './agent';
import { UserProps } from './types';
import { setupAuth, verifyAuth } from './auth';

const app = new Hono<{ Bindings: Env }>()
// Setup authentication
setupAuth(app);

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

app.use("/mcp", (c) => {
  // const auth = c.get('authUser');
  // Streamable MCP server
  const executionCtx = {
    ...c.executionCtx,
    props: {} satisfies UserProps
  }
  const mcp = FireflyIIIAgent.serve('/mcp').fetch(c.req.raw, c.env, executionCtx);
  return mcp;
});

export default app
export { FireflyIIIAgent } from './agent';
