# Firefly III MCP 服务器

这是一个用于 Firefly III 的 Model Context Protocol (MCP) 服务器，Firefly III 是一款免费开源的个人财务管理工具。通过这个 MCP 服务器，用户可以利用 AI 工具来管理他们的 Firefly III 账户和交易，创建个人财务和会计的 AI 助手。

*[English](README.md)*

## 项目结构

这个项目使用 Turborepo 管理的 monorepo 结构，包含以下主要包：

* **@firefly-iii-mcp/core** - 提供与 Firefly III API 交互基础的核心功能模块
* **@firefly-iii-mcp/local** - 用于在本地运行 MCP 服务器的命令行工具
* **@firefly-iii-mcp/cloudflare-worker** - 用于部署到 Cloudflare Workers 的实现方案
* **@firefly-iii-mcp/server** - 基于 Express 的服务器实现，支持 Streamable HTTP 和 SSE

## 功能特点

* 通过 AI 与 Firefly III 实例进行交互
* 以编程方式管理账户和交易
* 可扩展的工具集，用于各种财务操作
* 支持本地运行和云端部署
* 兼容 Model Context Protocol 标准
* 通过预设或自定义标签过滤工具，减少 Token 使用量

## 前置条件

* 一个运行中的 [Firefly III](https://www.firefly-iii.org/) 实例
* 如果计划通过"部署到 Cloudflare"按钮部署，需要一个 Cloudflare 账户

## 开始使用

### 1. 获取 Firefly III Personal Access Token (PAT)

要允许 MCP 服务器与您的 Firefly III 实例交互，您需要生成一个个人访问令牌（PAT）：

1. 登录到您的 Firefly III 实例
2. 导航到 **选项 > 个人资料 > OAuth**
3. 在"个人访问令牌"部分，点击"创建新令牌"
4. 为令牌提供一个描述性名称（例如，"MCP 服务器令牌"）
5. 点击"创建"
6. **重要提示：** 立即复制生成的令牌，您将无法再次查看它

更多详细信息，请参阅 Firefly III 官方文档中关于[个人访问令牌](https://docs.firefly-iii.org/how-to/firefly-iii/features/api/)的内容。

### 2. 配置 MCP 服务器

您需要向 MCP 服务器提供 Firefly III Personal Access Token (PAT) 和您的 Firefly III 实例 URL。这可以通过多种方式完成：

#### 请求头方式（推荐）

在每个请求的头信息中提供这些值。这通常是最安全的方法：

* `X-Firefly-III-Url`: 您的 Firefly III 实例 URL（例如，`https://firefly.yourdomain.com`）
* `Authorization`: 个人访问令牌，通常带有 `Bearer ` 前缀（例如，`Bearer YOUR_FIREFLY_III_PAT`）

请查阅您正在使用的 AI 工具或客户端的文档，了解它期望的确切头名称。

#### 查询参数方式（谨慎使用）

或者，您可以在 MCP 服务器的每个请求的查询参数中提供这些值：

* `baseUrl`: 您的 Firefly III 实例 URL
* `pat`: 您的 Firefly III 个人访问令牌

请注意，URL（包括查询参数）可能会在各个地方被记录，潜在地暴露敏感信息。

#### 环境变量方式（主要用于自托管/本地开发）

在运行服务器之前设置环境变量：

```bash
FIREFLY_III_BASE_URL="YOUR_FIREFLY_III_INSTANCE_URL" # 例如，https://firefly.yourdomain.com
FIREFLY_III_PAT="YOUR_FIREFLY_III_PAT"
# 可选：使用预设或自定义标签过滤工具
FIREFLY_III_PRESET="default" # 可用选项：default, full, basic, budget, reporting, admin, automation
# 或指定自定义工具标签（如果同时设置了预设，此项优先）
FIREFLY_III_TOOLS="accounts,transactions,categories"
```

## 运行 MCP 服务器

### 方式一：本地模式
这种方式适用于支持通过标准输入输出（stdio）调用 MCP 工具的客户端，如 [Claude Desktop](https://claude.ai/download)。

基本运行命令：

```bash
npx @firefly-iii-mcp/local --pat YOUR_PAT --baseUrl YOUR_FIREFLY_III_URL
```

您也可以过滤可用的工具以减少 Token 使用量：

```bash
# 使用预设
npx @firefly-iii-mcp/local --pat YOUR_PAT --baseUrl YOUR_FIREFLY_III_URL --preset budget

# 使用自定义工具标签
npx @firefly-iii-mcp/local --pat YOUR_PAT --baseUrl YOUR_FIREFLY_III_URL --tools accounts,transactions,categories
```

您也可以参考 [官方教程](https://modelcontextprotocol.io/quickstart/user) 了解 JSON 格式的配置方式。

```json
{
  "mcpServers": {
    "firefly-iii": {
      "command": "npx",
      "args": [
        "@firefly-iii-mcp/local",
        "--pat",
        "<您的 Firefly III 个人访问令牌>",
        "--baseUrl",
        "<您的 Firefly III 基础 URL>",
        "--preset",
        "default"
      ]
    }
  }
}
```

### 方式二：Express 服务器（推荐用于网页应用）

这种方式提供了一个基于 HTTP 的服务器，支持 Streamable HTTP 和 SSE，非常适合网页应用使用。

#### 作为命令行工具

```bash
npx @firefly-iii-mcp/server --pat YOUR_PAT --baseUrl YOUR_FIREFLY_III_URL
```

命令行选项：
- `-p, --pat <token>` - Firefly III 个人访问令牌
- `-b, --baseUrl <url>` - Firefly III 基础 URL
- `-P, --port <number>` - 监听端口（默认：3000）
- `-l, --logLevel <level>` - 日志级别：debug, info, warn, error（默认：info）
- `-s, --preset <name>` - 使用的工具预设（default, full, basic, budget, reporting, admin, automation）
- `-t, --tools <list>` - 启用的工具标签的逗号分隔列表

#### 作为库使用

```bash
npm install @firefly-iii-mcp/server
```

基本用法：

```typescript
import { createServer } from '@firefly-iii-mcp/server';

const server = createServer({
  port: 3000,
  pat: process.env.FIREFLY_III_PAT,
  baseUrl: process.env.FIREFLY_III_BASE_URL,
  enableToolTags: ['accounts', 'transactions', 'categories'] // 可选：过滤可用工具
});

server.start().then(() => {
  console.log('MCP 服务器运行于 http://localhost:3000');
});
```

更多详情，请查看 [@firefly-iii-mcp/server 文档](packages/server/README_ZH.md)。

### 方式三：部署到 Cloudflare Workers（推荐用于生产环境）

您可以使用下面的按钮轻松将此 MCP 服务器部署到 Cloudflare Workers：

[![部署到 Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/etnperlong/firefly-iii-mcp/tree/main/packages/cloudflare-worker)

**注意：** 部署后，您需要在 Cloudflare Worker 的设置中配置环境变量：

1. 进入您的 Cloudflare 仪表板
2. 导航至 Workers & Pages
3. 选择您部署的 Worker
4. 进入设置 > 变量
5. 添加以下变量：
   - 必需：`FIREFLY_III_BASE_URL` 和 `FIREFLY_III_PAT`
   - 可选：`FIREFLY_III_PRESET` 或 `FIREFLY_III_TOOLS`

### 方式四：从源代码本地运行

> [!NOTE]
> 对于生产用途，建议使用 NPM 包或部署到 Cloudflare Workers。

1. 克隆本仓库：
   ```bash
   git clone https://github.com/etnperlong/firefly-iii-mcp.git
   cd firefly-iii-mcp
   ```

2. 安装依赖：
   ```bash
   npm install
   ```

3. 创建一个 `.env` 文件：
   ```
   FIREFLY_III_BASE_URL="YOUR_FIREFLY_III_INSTANCE_URL"
   FIREFLY_III_PAT="YOUR_FIREFLY_III_PAT"
   # 可选：过滤工具
   FIREFLY_III_PRESET="default"
   # 或
   FIREFLY_III_TOOLS="accounts,transactions,categories"
   ```

4. 构建项目：
   ```bash
   npm run build
   ```

5. 启动开发服务器：
   ```bash
   npm run dev
   ```

## 工具过滤选项

您可以过滤向 MCP 客户端公开的工具，以减少 Token 使用量并专注于特定功能：

### 可用预设

- `default`: 日常使用的基本工具（账户、账单、分类、标签、交易、搜索、摘要）
- `full`: 所有可用工具
- `basic`: 核心财务管理工具
- `budget`: 预算相关工具
- `reporting`: 报告和分析工具
- `admin`: 管理工具
- `automation`: 自动化相关工具

## 开发指南

本项目使用 [Turborepo](https://turbo.build/) 来管理 monorepo 工作流和 [Changesets](https://github.com/changesets/changesets) 进行版本控制和发布。

### 常用命令

- 构建所有包：`npm run build`
- 构建特定包：`npm run build:core` 或 `npm run build:local`
- 清理构建产物：`npm run clean`
- 开发模式：`npm run dev`
- 发布包：`npm run publish-packages`

详细的开发指南，请参阅[贡献指南](CONTRIBUTING.md)。

## 致谢

本项目使用并修改了来自 [harsha-iiiv/openapi-mcp-generator](https://github.com/harsha-iiiv/openapi-mcp-generator) 的生成脚本。感谢原作者的工作。

## 贡献

欢迎贡献！本项目使用 Turborepo 管理 monorepo 工作流。请参阅 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详细的贡献指南。

## 许可证

本项目根据 [MIT 许可证](LICENSE) 授权。 