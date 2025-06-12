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
- `-s, --preset <name>` - 使用的工具预设（default, full, basic, budget, reporting, admin, automation）
- `-t, --tools <list>` - 启用的工具标签的逗号分隔列表
- `-h, --help` - 显示帮助信息

#### 环境变量

您也可以使用环境变量配置服务器：

```
FIREFLY_III_PAT=YOUR_PAT
FIREFLY_III_BASE_URL=YOUR_FIREFLY_III_URL
PORT=3000
LOG_LEVEL=info
FIREFLY_III_PRESET=default
FIREFLY_III_TOOLS=accounts,transactions,categories
```

#### 工具过滤选项

您可以使用预设或自定义工具标签来过滤向 MCP 客户端公开的工具：

##### 使用预设

```bash
# 命令行参数
firefly-iii-mcp-server --preset 预设名称

# 或环境变量
FIREFLY_III_PRESET=预设名称
```

可用的预设：
- `default`: 日常使用的基本工具（账户、账单、分类、标签、交易、搜索、摘要）
- `full`: 所有可用工具
- `basic`: 核心财务管理工具
- `budget`: 预算相关工具
- `reporting`: 报告和分析工具
- `admin`: 管理工具
- `automation`: 自动化相关工具

##### 使用自定义工具标签

```bash
# 命令行参数
firefly-iii-mcp-server --tools 标签1,标签2,标签3

# 或环境变量
FIREFLY_III_TOOLS=标签1,标签2,标签3
```

> **注意**：命令行参数优先级高于环境变量。如果同时提供了 `--tools` 和 `--preset`，将使用 `--tools`。

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
  logLevel: 'info',
  enableToolTags: ['accounts', 'transactions', 'categories'] // 过滤可用工具
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
- **工具过滤**：使用预设或自定义标签过滤可用工具

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