# Firefly III MCP Server - Local

这个包提供了一个命令行工具，用于在本地运行 Firefly III MCP (Model Context Protocol) 服务器。MCP 服务器集成了 Firefly III，这是一款免费开源的个人财务管理工具。

*[English](README.md)*

## 安装

```bash
# 全局安装
npm install -g @firefly-iii-mcp/local

# 或者直接使用 npx
npx @firefly-iii-mcp/local --pat YOUR_PAT --baseUrl YOUR_FIREFLY_III_URL
```

## 使用方法

运行 MCP 服务器需要提供两个必要参数：

- `FIREFLY_III_PAT`: Firefly III 实例的个人访问令牌
- `FIREFLY_III_BASE_URL`: Firefly III 实例的 URL

您可以通过以下两种方式提供这些参数：

### 1. 命令行参数

```bash
firefly-iii-mcp --pat YOUR_PAT --baseUrl YOUR_FIREFLY_III_URL
```

### 2. 环境变量

创建一个 `.env` 文件，内容如下：

```
FIREFLY_III_PAT=YOUR_PAT
FIREFLY_III_BASE_URL=YOUR_FIREFLY_III_URL
```

然后运行：

```bash
firefly-iii-mcp
```

## 与 AI 工具集成

一旦 MCP 服务器运行起来，您可以使用兼容 MCP 的 AI 工具连接到它。例如，使用 [supergateway](https://github.com/supergateway/supergateway)：

```bash
npx -y supergateway --streamableHttp "stdio://"
```

这将创建一个网关，AI 模型可以通过该网关与您的 Firefly III 实例交互。

## 系统要求

- Node.js >= 20
- Firefly III 实例及有效的个人访问令牌

## 开发

本包是 monorepo 的一部分，使用 Turborepo 进行管理。请参阅项目根目录的 [CONTRIBUTING.md](../../CONTRIBUTING.md) 了解详细的贡献指南。

## 许可证

本项目根据 [MIT 许可证](../../LICENSE) 授权。 