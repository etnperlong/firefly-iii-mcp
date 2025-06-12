# Firefly III MCP Server - Cloudflare Worker

这个包提供了在 Cloudflare Workers 上运行 Firefly III MCP (Model Context Protocol) 服务器的实现。通过 Cloudflare Workers，您可以轻松部署 MCP 服务器到云端并享受全球边缘网络的性能优势。

*[English](README.md)*

## 功能特点

- 基于 Cloudflare Workers 的全球边缘部署
- 低延迟高可用性服务
- 无需服务器维护
- 无缝集成 Firefly III API
- 支持通过预设或自定义标签过滤工具

## 部署方式

### 一键部署

最简单的方法是使用 "Deploy to Cloudflare Workers" 按钮一键部署：

[![部署到 Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/etnperlong/firefly-iii-mcp/tree/main/packages/cloudflare-worker)

### 手动部署

1. 克隆本仓库：
   ```bash
   git clone https://github.com/etnperlong/firefly-iii-mcp.git
   cd firefly-iii-mcp
   ```

2. 安装依赖：
   ```bash
   npm install
   ```

3. 构建项目：
   ```bash
   npm run build
   ```

4. 部署到 Cloudflare Workers：
   ```bash
   cd packages/cloudflare-worker
   npm run deploy
   ```

## 配置

部署后，您需要在 Cloudflare Workers 的环境变量中配置以下内容：

### 必需变量

- `FIREFLY_III_BASE_URL`: 您的 Firefly III 实例 URL（例如：`https://firefly.yourdomain.com`）
- `FIREFLY_III_PAT`: 您的 Firefly III 个人访问令牌

### 可选变量

- `FIREFLY_III_PRESET`: 要使用的工具预设（default, full, basic, budget, reporting, admin, automation）
- `FIREFLY_III_TOOLS`: 启用的工具标签的逗号分隔列表（如果同时设置了 FIREFLY_III_PRESET，此项优先）

#### 可用预设

- `default`: 日常使用的基本工具（账户、账单、分类、标签、交易、搜索、摘要）
- `full`: 所有可用工具
- `basic`: 核心财务管理工具
- `budget`: 预算相关工具
- `reporting`: 报告和分析工具
- `admin`: 管理工具
- `automation`: 自动化相关工具

### 配置步骤

1. 进入您的 Cloudflare 仪表板
2. 导航至 Workers & Pages
3. 选择您部署的 Worker
4. 进入设置 > 变量
5. 添加必需和可选变量作为秘密变量

## 使用方法

部署并配置好后，您可以通过以下 URL 访问 MCP 服务器：

```
https://your-worker-name.your-account.workers.dev/mcp
```

您可以将此 URL 提供给支持 MCP 的 AI 工具，使其能够与您的 Firefly III 实例交互。

## 自定义域名

如果您希望使用自己的域名，可以在 Cloudflare Workers 设置中配置自定义域名。具体步骤请参考 [Cloudflare 文档](https://developers.cloudflare.com/workers/platform/routing/custom-domains/)。

## 技术细节

本包使用 [Hono](https://hono.dev/) 框架构建，并利用了 Cloudflare Workers 的边缘计算能力。

## 许可证

本项目根据 [MIT 许可证](../../LICENSE) 授权。 