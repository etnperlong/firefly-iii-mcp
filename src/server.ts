import { Server } from "@modelcontextprotocol/sdk/server/index.js";

export const getServer = () => {
  const server = new Server({
    name: 'firefly-iii-mcp',
    version: '6.2.13',
  }, {
    capabilities:{ tools: {} }
  })

  return server;
}