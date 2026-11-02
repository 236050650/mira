import Fastify from "fastify";
import cors from "@fastify/cors";
import { createGatewayFromEnv } from "@mira/model-gateway";
import { resolveEmbeddings } from "@mira/rag";
import { AuthService } from "./auth/auth.service.js";
import { loadConfig } from "./config.js";
import { createDb, runMigrations, type DbHandle } from "./db/client.js";
import { seedPersonas } from "./db/seed-lib.js";
import { attachRequestId, ErrorCodes, sendError } from "./http/errors.js";
import { registerAuthRoutes } from "./routes/auth.routes.js";
import { registerConversationRoutes } from "./routes/conversations.routes.js";
import { registerMemoryRoutes } from "./routes/memories.routes.js";
import { registerModelRoutes } from "./routes/models.routes.js";
import { registerPersonaRoutes } from "./routes/personas.routes.js";
import { ChatService } from "./services/chat.service.js";
import { RetrievalIndex } from "./services/retrieval-index.js";
import { FixedWindowRateLimiter } from "./http/rate-limiter.js";

export type BuiltApp = {
  app: ReturnType<typeof Fastify>;
  config: ReturnType<typeof loadConfig>;
  handle: DbHandle;
  auth: AuthService;
  gateway: ReturnType<typeof createGatewayFromEnv>;
  chat: ChatService;
  retrieval: RetrievalIndex;
};

export async function buildApp(options?: {
  migrate?: boolean;
  seed?: boolean;
  env?: NodeJS.ProcessEnv;
}): Promise<BuiltApp> {
  const config = loadConfig(options?.env ?? process.env);
  const handle = await createDb(config);
  if (options?.migrate !== false) {
    await runMigrations(handle);
  }
  if (options?.seed !== false) {
    await seedPersonas(handle.db);
  }

  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
      redact: {
        paths: [
          "req.headers.authorization",
          "body.password",
          "body.refreshToken",
          "passwordHash",
        ],
        remove: true,
      },
    },
  });

  await app.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
  });

  app.addHook("onRequest", async (request, reply) => {
    attachRequestId(request, reply);
  });

  const auth = new AuthService(handle.db, config);
  const gateway = createGatewayFromEnv({
    ...process.env,
    MODEL_MODE: config.modelMode,
    DEEPSEEK_API_KEY: config.deepseekApiKey,
    DEEPSEEK_BASE_URL: config.deepseekBaseUrl,
    DEEPSEEK_DEFAULT_MODEL: config.deepseekDefaultModel,
    DEEPSEEK_PREMIUM_MODEL: config.deepseekPremiumModel,
    OLLAMA_BASE_URL: config.ollamaBaseUrl,
    OLLAMA_API_KEY: config.ollamaApiKey,
    OLLAMA_DEFAULT_MODEL: config.ollamaDefaultModel,
    MODEL_REQUEST_TIMEOUT_MS: String(config.modelTimeoutMs),
    MODEL_DAILY_REMOTE_TOKEN_BUDGET: String(config.dailyRemoteTokenBudget),
  });
  const embedding = await resolveEmbeddings({
    mode: config.modelMode,
    ollamaBaseUrl: config.ollamaBaseUrl,
    embedModel: config.ollamaEmbedModel,
    timeoutMs: Math.min(config.modelTimeoutMs, 4000),
  });
  const retrieval = new RetrievalIndex(
    handle.db,
    embedding.embeddings,
    embedding.modelId,
    config.ragMinScore,
  );
  const chat = new ChatService(handle.db, gateway, config, retrieval);
  const loginLimiter = new FixedWindowRateLimiter(config.loginRateLimit, config.rateLimitWindowMs);
  const chatLimiter = new FixedWindowRateLimiter(config.chatRateLimit, config.rateLimitWindowMs);

  const requireAuth = async (request: any, reply: any) => {
    const header = request.headers.authorization as string | undefined;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) {
      return sendError(reply, request, 401, ErrorCodes.AUTH_UNAUTHORIZED, "未登录");
    }
    const userId = await auth.verifyAccessToken(token);
    if (!userId) {
      return sendError(reply, request, 401, ErrorCodes.AUTH_TOKEN_EXPIRED, "登录已过期，请重新登录");
    }
    const user = await auth.getUser(userId);
    if (!user) {
      return sendError(reply, request, 401, ErrorCodes.AUTH_TOKEN_EXPIRED, "登录已过期，请重新登录");
    }
    request.userId = userId;
  };

  const requireLoginRateLimit = async (request: any, reply: any) => {
    const email =
      typeof request.body?.email === "string" ? request.body.email.trim().toLowerCase() : "unknown";
    const decision = loginLimiter.consume(`${request.ip}:${email}`);
    reply.header("x-ratelimit-limit", decision.limit);
    reply.header("x-ratelimit-remaining", decision.remaining);
    if (!decision.allowed) {
      reply.header("retry-after", decision.retryAfterSec);
      return sendError(reply, request, 429, ErrorCodes.RATE_LIMITED, "登录尝试过于频繁，请稍后重试");
    }
  };

  const requireChatRateLimit = async (request: any, reply: any) => {
    const decision = chatLimiter.consume(request.userId ?? request.ip);
    reply.header("x-ratelimit-limit", decision.limit);
    reply.header("x-ratelimit-remaining", decision.remaining);
    if (!decision.allowed) {
      reply.header("retry-after", decision.retryAfterSec);
      return sendError(reply, request, 429, ErrorCodes.RATE_LIMITED, "消息发送过于频繁，请稍后重试");
    }
  };

  app.get("/health", async () => ({ ok: true, mode: config.modelMode, db: handle.kind }));

  registerAuthRoutes(app, { auth, db: handle.db, requireAuth, requireLoginRateLimit });
  registerPersonaRoutes(app, { db: handle.db, requireAuth });
  registerConversationRoutes(app, {
    db: handle.db,
    gateway,
    config,
    chat,
    requireAuth,
    requireChatRateLimit,
  });
  registerMemoryRoutes(app, { db: handle.db, requireAuth, retrieval });
  registerModelRoutes(app, { 
    db: handle.db, 
    gateway, 
    config, 
    requireAuth,
    checkEmbeddingHealth: async () => {
      const { checkEmbeddingHealth } = await import("@mira/rag");
      return checkEmbeddingHealth(config.ollama.baseUrl);
    },
  });

  app.addHook("onClose", async () => {
    await handle.close();
  });

  return { app, config, handle, auth, gateway, chat, retrieval };
}

export async function startServer() {
  const built = await buildApp();
  await built.app.listen({ port: built.config.port, host: built.config.host });
  built.app.log.info(`MIRA API listening on http://${built.config.host}:${built.config.port}`);
  return built;
}

const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith("main.ts") ||
  process.argv[1].endsWith("main.js") ||
  process.argv[1].includes("apps\\api\\src\\main") ||
  process.argv[1].includes("apps/api/src/main")
);

if (isDirectRun) {
  startServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
