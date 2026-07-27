import { config } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");
config({ path: resolve(root, ".env.local") });
config({ path: resolve(root, ".env") });

export type AppConfig = {
  port: number;
  host: string;
  databaseUrl?: string;
  usePglite: boolean;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  accessTokenTtlSec: number;
  refreshTokenTtlSec: number;
  corsOrigins: string[];
  modelMode: "mock" | "local" | "remote";
  deepseekApiKey?: string;
  deepseekBaseUrl: string;
  deepseekDefaultModel: string;
  deepseekPremiumModel: string;
  ollamaBaseUrl: string;
  ollamaApiKey: string;
  ollamaDefaultModel: string;
  modelTimeoutMs: number;
  modelMaxOutputTokens: number;
  dailyRemoteTokenBudget: number;
  liveTestsEnabled: boolean;
  loginRateLimit: number;
  chatRateLimit: number;
  rateLimitWindowMs: number;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: Number(env.API_PORT || 4000),
    host: env.API_HOST || "0.0.0.0",
    databaseUrl: env.DATABASE_URL,
    usePglite: env.USE_PGLITE === "true" || !env.DATABASE_URL,
    jwtAccessSecret: env.JWT_ACCESS_SECRET || "dev-access-secret-change-me",
    jwtRefreshSecret: env.JWT_REFRESH_SECRET || "dev-refresh-secret-change-me",
    accessTokenTtlSec: Number(env.ACCESS_TOKEN_TTL_SEC || 900),
    refreshTokenTtlSec: Number(env.REFRESH_TOKEN_TTL_SEC || 60 * 60 * 24 * 30),
    corsOrigins: (
      env.CORS_ORIGINS ||
      "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8081,http://127.0.0.1:8081"
    ).split(","),
    modelMode: (env.MODEL_MODE as AppConfig["modelMode"]) || "mock",
    deepseekApiKey: env.DEEPSEEK_API_KEY,
    deepseekBaseUrl: env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    deepseekDefaultModel: env.DEEPSEEK_DEFAULT_MODEL || "deepseek-v4-flash",
    deepseekPremiumModel: env.DEEPSEEK_PREMIUM_MODEL || "deepseek-v4-pro",
    ollamaBaseUrl: env.OLLAMA_BASE_URL || "http://127.0.0.1:11434/v1",
    ollamaApiKey: env.OLLAMA_API_KEY || "ollama",
    ollamaDefaultModel: env.OLLAMA_DEFAULT_MODEL || "qwen3.5:latest",
    modelTimeoutMs: Number(env.MODEL_REQUEST_TIMEOUT_MS || 60000),
    modelMaxOutputTokens: Number(env.MODEL_MAX_OUTPUT_TOKENS || 800),
    dailyRemoteTokenBudget: Number(env.MODEL_DAILY_REMOTE_TOKEN_BUDGET || 200000),
    liveTestsEnabled: env.MODEL_LIVE_TESTS_ENABLED === "true",
    loginRateLimit: Number(env.LOGIN_RATE_LIMIT_MAX || 10),
    chatRateLimit: Number(env.CHAT_RATE_LIMIT_MAX || 30),
    rateLimitWindowMs: Number(env.RATE_LIMIT_WINDOW_MS || 60_000),
  };
}
