import { Hono } from 'hono'
import { toFetchResponse, toReqRes } from 'fetch-to-node';
import { cors } from 'hono/cors';
import { MCPStreamableHttpServer } from './handler';
import { getServer } from './server';

const app = new Hono()

app.use('*', cors());

const mcpServer = getServer();
const mcpHandler = new MCPStreamableHttpServer(mcpServer)

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.post("/mcp", (c) => mcpHandler.handleMcpRequest(c));

export default app
