# Firefly III MCP Server - Express

这个包提供了 Firefly III MCP (Model Context Protocol) 服务器的基于 Express 的实现。它支持 Streamable HTTP 和服务器发送事件 (SSE)，使其成为通过强大的 Web 服务器将 Firefly III 与 AI 工具集成的理想选择。

*[English](README.md)*

## 安装

```bash
npm install @firefly-iii-mcp/server
```

## 使用方法

### 作为命令行工具

您可以直接从命令行运行服务器：

```bash
npx @firefly-iii-mcp/server --pat YOUR_PAT --baseUrl YOUR_FIREFLY_III_URL
```

#### 命令行选项

- `-p, --pat <token>` - Firefly III 个人访问令牌
- `-b, --baseUrl <url>` - Firefly III 基础 URL
- `-P, --port <number>` - 监听端口（默认：3000）
- `-l, --logLevel <level>` - 日志级别：debug, info, warn, error（默认：info）
- `-h, --help` - 显示帮助信息

### 作为库使用

#### 基本设置

```typescript
import { createServer } from '@firefly-iii-mcp/server';

// 创建并启动具有默认配置的服务器
const server = createServer({
  port: 3000,
  pat: process.env.FIREFLY_III_PAT,
  baseUrl: process.env.FIREFLY_III_BASE_URL
});

server.start().then(() => {
  console.log('MCP 服务器运行于 http://localhost:3000');
});
```

#### 自定义配置

```typescript
import { createServer, ServerConfig } from '@firefly-iii-mcp/server';

const config: ServerConfig = {
  port: 8080,
  pat: 'YOUR_FIREFLY_III_PAT',
  baseUrl: 'YOUR_FIREFLY_III_BASE_URL',
  corsOptions: {
    origin: 'https://yourdomain.com',
    credentials: true
  },
  logLevel: 'info'
};

const server = createServer(config);
server.start();
```

#### 使用 HTTPS

```typescript
import { createServer } from '@firefly-iii-mcp/server';
import fs from 'fs';

const server = createServer({
  port: 443,
  pat: process.env.FIREFLY_III_PAT,
  baseUrl: process.env.FIREFLY_III_BASE_URL,
  https: {
    key: fs.readFileSync('path/to/key.pem'),
    cert: fs.readFileSync('path/to/cert.pem')
  }
});

server.start();
```

## 功能特点

- **基于 Express 的服务器**：稳健且可用于生产环境的 Web 服务器
- **Streamable HTTP 支持**：兼容流式 API 交互
- **服务器发送事件 (SSE)**：高效的单向通信通道
- **CORS 支持**：可配置的跨域资源共享
- **HTTPS 支持**：安全通信选项
- **可定制的日志**：灵活的日志配置
- **命令行界面**：无需编写代码即可轻松部署

## API 端点

- `POST /mcp` - 用于 Streamable HTTP 请求的主要 MCP 端点
- `GET /sse` - 用于流式响应的服务器发送事件端点
- `POST /messages` - 用于 SSE 请求的消息端点
- `GET /health` - 健康检查端点

## 系统要求

- Node.js >= 20
- Firefly III 实例及有效的个人访问令牌

## 开发

本包是 monorepo 的一部分，使用 Turborepo 进行管理。请参阅项目根目录的 [CONTRIBUTING.md](../../CONTRIBUTING.md) 了解详细的贡献指南。

## 许可证

本项目根据 [MIT 许可证](../../LICENSE) 授权。 