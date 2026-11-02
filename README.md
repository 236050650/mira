# MIRA 镜语

[![CI](https://github.com/236050650/mira/actions/workflows/ci.yml/badge.svg)](https://github.com/236050650/mira/actions/workflows/ci.yml)

跨平台人格模拟器 monorepo：Web 高保真 Demo、Fastify API、Expo 移动端共享同一套契约与视觉语言。身份、说话方式和禁用表达固定写进系统提示；角色知识和更早的对话用 LangChain 按当前这句话检索。生成回复仍走自有模型网关，不经过 LangChain 的 Chat Model。

本目录是可公开的应用代码，许可证为 [MIT](./LICENSE)。

## 界面

<p>
  <img src="./docs/screenshots/auth.jpg" alt="登录" width="180" />
  <img src="./docs/screenshots/home.jpg" alt="首页" width="180" />
  <img src="./docs/screenshots/detail.jpg" alt="角色" width="180" />
  <img src="./docs/screenshots/chat.jpg" alt="对话" width="180" />
</p>

## 检索与生成

一轮对话分成两段：

1. `@mira/rag` 用 `RecursiveCharacterTextSplitter` 切分角色知识，用 `OllamaEmbeddings`（默认 `bge-m3`）或离线哈希向量嵌入，再用 `MemoryVectorStore` 召回知识、长期记忆和最近窗口之外的旧消息。向量存在 `retrieval_chunks`，进程重启后不用重切原文。
2. `@mira/model-gateway` 按 `mock` / `local` / `remote` 流式生成。停止、日预算和 `think:false` 都留在这一层。Ollama 不可用时检索自动退回哈希向量，聊天不会因此中断。

固定上下文还有平台规则、关系阶段和会话摘要。摘要在超过 12 轮后压缩窗口外的旧对话，不把截断原文再贴一遍。

## 仓库结构

```text
persona-app-demo/
├── apps/
│   ├── api/          # Fastify REST + SSE，模型网关，Drizzle ORM
│   ├── web/          # Vinext/Next 产品 Demo（默认本地 data.ts）
│   └── mobile/       # Expo Router 移动端（Expo 53 / RN 0.79）
├── packages/
│   ├── contracts/    # Zod 契约、SSE 事件、模型配置
│   ├── domain/       # 领域逻辑
│   ├── model-gateway/# DeepSeek / Ollama / Mock 提供方
│   ├── prompts/      # 提示词模板
│   ├── rag/          # LangChain 切分、嵌入与检索
│   └── ui/           # 共享设计 token
├── docker/           # Postgres docker compose
├── docs/             # PRD、技术设计、验收方案
└── .env.example      # 服务端环境变量模板（勿提交 .env.local）
```

## 环境要求

- Node.js `>=22.13.0`
- npm workspaces（根目录 `npm install`）
- 可选：Docker（Postgres）、Ollama（本地模型）

## 快速启动

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境

复制 `.env.example` 为 `.env.local`，仅在**服务端**填写模型密钥与 JWT 密钥：

```bash
cp .env.example .env.local
```

**安全规则：**

- 不要给 `DEEPSEEK_*`、`JWT_*` 等变量加 `NEXT_PUBLIC_` 或 `EXPO_PUBLIC_` 前缀
- 客户端只允许公开 API 地址，例如 `NEXT_PUBLIC_MIRA_API_URL` / `EXPO_PUBLIC_MIRA_API_URL` / `VITE_MIRA_API_URL`

### 3. 启动 API（端口 4000）

**PGlite（默认，零依赖）：**

```bash
# .env.local 中 USE_PGLITE=true（默认）
npm run dev:api
```

首次启动会自动迁移并 seed 18 个内置角色。

**Postgres（docker compose）：**

```bash
npm run db:up
# .env.local 设置 DATABASE_URL=postgres://mira:mira@127.0.0.1:5432/mira
# 并关闭 USE_PGLITE 或删除该变量
npm run db:migrate
npm run db:seed
npm run dev:api
```

### 4. 启动 Web Demo（端口 3000）

```bash
npm run dev:web
# 或根目录
npm run dev
```

浏览器打开：`http://localhost:3000/#home`

- 默认使用 `apps/web/app/data.ts` 本地 Demo 数据
- 设置 `NEXT_PUBLIC_MIRA_API_URL=http://127.0.0.1:4000` 后，可通过 `useApiMode()` 切换为真实 API（见 `apps/web/lib/api.ts`）

**公开 Demo 端点速率限制：**

`/api/demo-chat` 端点（Web Demo 的简化对话路径）实现了以下保护机制：

- 每个 IP 每小时最多 10 次请求
- 全局每日 1000 次请求上限
- 超出限制返回 429 状态码，fail-closed 机制
- **生产环境应配置独立密钥并移除或加固此端点**

### 5. 启动 Mobile（Expo）

```bash
npm run dev:mobile
```

- 默认 API：`http://127.0.0.1:4000`
- 可通过 `EXPO_PUBLIC_MIRA_API_URL` 覆盖（仅 API URL，禁止任何 DeepSeek 密钥）
- Android 模拟器访问宿主机 API 时，常用 `http://10.0.2.2:4000`

## MODEL_MODE

| 值 | 说明 |
|---|---|
| `mock` | 默认。集成测试与无密钥开发；聊天返回模拟流式回复 |
| `remote` | 按选择调用 DeepSeek / Ollama 真实模型（需配置密钥与网络）；兼容旧值 `live` |
| `local` | 所有真实模型请求使用 `OLLAMA_DEFAULT_MODEL` 指定的 Ollama 模型 |

在 `.env.local` 中设置 `MODEL_MODE`。`OLLAMA_EMBED_MODEL` 只影响检索向量，默认 `bge-m3`；`mock` 模式不访问 Ollama。模型状态可通过 `GET /v1/models/status`（需登录）查看。

远程模式下，`DEEPSEEK_DEFAULT_MODEL` 和 `DEEPSEEK_PREMIUM_MODEL` 分别配置普通和高级模型的实际名称。模型状态、聊天请求与用量记录保持一致。未知的 `MODEL_MODE` 值会在启动时报错。

## 数据库

| 方式 | 命令 / 配置 |
|---|---|
| PGlite 嵌入式 | `USE_PGLITE=true`（开发默认） |
| Postgres | `npm run db:up` + `DATABASE_URL=postgres://mira:mira@127.0.0.1:5432/mira` |
| 生成迁移 | `npm run db:generate` |
| 执行迁移 | `npm run db:migrate` |
| 种子数据 | `npm run db:seed` |
| 停止 Postgres | `npm run db:down` |

## 验收命令

```bash
# 全仓库类型检查
npm run typecheck

# 单元测试
npm test

# API 集成测试（PGlite + mock 模型，含注册/登录/角色/聊天 SSE）
npm run test:integration

# 真实模型冒烟（需 MODEL_LIVE_TESTS_ENABLED=true 与密钥）
npm run test:model:live

# 生产构建
npm run build
```

Web 构建测试：

```bash
npm run test -w @mira/web
```

Mobile 类型检查：

```bash
npm run typecheck -w @mira/mobile
```

## API 概览（`/v1`）

| 领域 | 端点 |
|---|---|
| 认证 | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `GET /auth/me` |
| 角色 | `GET /personas`, `GET /personas/:id`, `POST/DELETE /personas/:id/favorite` |
| 会话 | `GET/POST /conversations`, `GET /conversations/:id/messages` |
| 聊天 | `POST /conversations/:id/messages/stream`（SSE） |
| 模型 | `GET /models/status` |

客户端实现：

- Mobile：`apps/mobile/lib/api.ts`（SecureStore 存 refreshToken）
- Web：`apps/web/lib/api.ts`（localStorage 仅存 refreshToken 与 theme）

## 开发文档

1. [文档索引](./docs/README.md)
2. [产品需求规格书](./docs/01-产品需求规格书.md)
3. [技术设计文档](./docs/02-技术设计文档.md)
4. [最终验收方案](./docs/03-最终验收方案.md)

## 视觉

Demo 与 Mobile 对齐象牙浅色 / 墨色深色主题，靛蓝与朱红点缀（非紫色霓虹）。Web token 见 `apps/web/app/globals.css`，Mobile 见 `apps/mobile/lib/theme.ts`。
