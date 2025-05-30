# Firefly III MCP Server

这是一个为 Firefly III（一款免费开源的个人财务管理工具）开发的 MCP（Model Context Protocol）服务器。通过这个 MCP 服务器，用户可以利用 AI 工具来管理他们的 Firefly III 账户和交易记录，从而实现个人理财和会计的 AI 助手功能。

*[English](README.md)*

## 功能特点

* 通过 AI 与 Firefly III 实例进行交互
* 以编程方式管理账户和交易
* 可扩展的工具集，用于各种财务操作
* 支持本地运行和云端部署
* 兼容 Model Context Protocol 标准

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
```

## 运行 MCP 服务器

### 方式 1: 本地模式运行

这种方式适合支持以 标准输入/输出（stdio）调用 MCP 工具的客户端，如 [Claude Desktop](https://claude.ai/download)。

基本运行命令：

```bash
npx @firefly-iii-mcp/local --pat YOUR_PAT --baseUrl YOUR_FIREFLY_III_URL
```

也可以参考 [官方教程](https://modelcontextprotocol.io/quickstart/user) 以 JSON 格式进行配置。

```json
{
  "mcpServers": {
    "firefly-iii": {
      "command": "npx",
      "args": [
        "@firefly-iii-mcp/local",
        "--pat",
        "<Your Firefly III Personal Access Token>",
        "--baseUrl",
        "<Your Firefly III Base URL>"
      ]
    }
  }
}
```

### 方式 2: 部署到 Cloudflare Workers（推荐用于生产环境）

您可以使用以下按钮轻松地将此 MCP 服务器部署到 Cloudflare Workers：

[![部署到 Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/etnperlong/firefly-iii-mcp/tree/main/packages/cloudflare-worker)

**注意：** 部署后，您需要在 Cloudflare Worker 设置中配置 `FIREFLY_III_BASE_URL` 和 `FIREFLY_III_PAT` 环境变量：

1. 进入您的 Cloudflare 仪表板
2. 导航至 Workers & Pages
3. 选择您部署的 Worker
4. 进入设置 > 变量
5. 添加 `FIREFLY_III_BASE_URL` 和 `FIREFLY_III_PAT` 作为秘密变量

## 开发指南

本项目使用 [Turborepo](https://turbo.build/) 来管理 monorepo 工作流和 [Changesets](https://github.com/changesets/changesets) 进行版本控制和发布。

### 项目结构

本项目包含以下几个主要包：

* **@firefly-iii-mcp/core** - 核心功能模块，提供与 Firefly III API 交互的基础功能
* **@firefly-iii-mcp/local** - 本地运行 MCP 服务器的命令行工具
* **@firefly-iii-mcp/cloudflare-worker** - 用于部署到 Cloudflare Workers 的实现

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