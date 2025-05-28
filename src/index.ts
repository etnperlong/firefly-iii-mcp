import { Hono } from 'hono'
import { cors } from 'hono/cors';
import { MCPStreamableHttpServer } from './handler';
import { getServer } from './server';

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.use('*', cors());

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.post("/mcp", (c) => {
  const mcpServer = getServer(c);
  const mcpHandler = new MCPStreamableHttpServer(mcpServer)

  return mcpHandler.handleMcpRequest(c)
});

export default app
