# Firefly III MCP Server - Core

Firefly III MCP (Model Context Protocol) 服务器的核心模块。这个包提供了通过 Model Context Protocol 与 Firefly III API 交互的核心功能。

*[English](README.md)*

## 安装

```bash
npm install @firefly-iii-mcp/core
```

## 使用方法

这个包主要被 `@firefly-iii-mcp/local` 和 `@firefly-iii-mcp/cloudflare-worker` 包使用，但也可以直接用来创建自定义 MCP 服务器实现。

```typescript
import { getServer, McpServerConfig } from '@firefly-iii-mcp/core';

// 创建配置
const config: McpServerConfig = {
  pat: 'YOUR_PERSONAL_ACCESS_TOKEN',
  baseUrl: 'YOUR_FIREFLY_III_URL'
};

// 获取服务器实例
const server = getServer(config);

// 连接到传输层
// 示例：使用 StdioServerTransport
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
const transport = new StdioServerTransport();
await server.connect(transport);
```

## 功能

- 提供 Firefly III API 的完整交互功能
- 实现 Model Context Protocol 标准
- 支持多种传输方式（stdio, HTTP 等）

## 系统要求

- Node.js >= 20
- ESM 模块支持

## 开发

本包是 monorepo 的一部分，使用 Turborepo 进行管理。请参阅项目根目录的 [CONTRIBUTING.md](../../CONTRIBUTING.md) 了解详细的贡献指南。

## 许可证

本项目根据 [MIT 许可证](../../LICENSE) 授权。 