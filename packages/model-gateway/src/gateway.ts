import { resolveModelProfile, type ModelProfile, type ProviderId } from "@mira/contracts";
import { createDeepSeekProvider } from "./openai-compat-provider.js";
import { createOllamaProvider } from "./ollama-provider.js";
import { MockProvider } from "./mock-provider.js";
import type { ModelProvider } from "./types.js";

export type ModelMode = "mock" | "local" | "remote";

export function parseModelMode(value?: string): ModelMode {
  const mode = value?.trim() || "mock";
  if (mode === "live") return "remote";
  if (mode === "mock" || mode === "local" || mode === "remote") return mode;
  throw new Error("MODEL_MODE must be mock, local, or remote (live is a legacy alias)");
}

export type GatewayEnv = {
  mode: ModelMode;
  deepseekApiKey?: string;
  deepseekBaseUrl: string;
  deepseekDefaultModel: string;
  deepseekPremiumModel?: string;
  ollamaBaseUrl: string;
  ollamaApiKey: string;
  ollamaDefaultModel: string;
  timeoutMs: number;
  dailyRemoteTokenBudget: number;
};

export class ModelGateway {
  private readonly providers = new Map<ProviderId, ModelProvider>();
  readonly mode: ModelMode;
  readonly dailyRemoteTokenBudget: number;
  private remoteTokensUsed = 0;

  constructor(private readonly env: GatewayEnv) {
    this.mode = env.mode;
    this.dailyRemoteTokenBudget = env.dailyRemoteTokenBudget;
    this.providers.set("mock", new MockProvider());
    this.providers.set(
      "ollama",
      createOllamaProvider({
        apiKey: env.ollamaApiKey,
        baseUrl: env.ollamaBaseUrl,
        defaultModel: env.ollamaDefaultModel,
        timeoutMs: env.timeoutMs,
      }),
    );
    this.providers.set(
      "deepseek",
      createDeepSeekProvider({
        apiKey: env.deepseekApiKey || "",
        baseUrl: env.deepseekBaseUrl,
        defaultModel: env.deepseekDefaultModel,
        timeoutMs: env.timeoutMs,
      }),
    );
  }

  getProvider(id: ProviderId): ModelProvider {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new Error(`Unknown provider: ${id}`);
    }
    return provider;
  }

  getMock(): MockProvider {
    return this.getProvider("mock") as MockProvider;
  }

  /** Test/dev helper to swap a provider implementation. */
  setProvider(id: ProviderId, provider: ModelProvider) {
    this.providers.set(id, provider);
  }

  resolveProviderForMode(preferred: ProviderId): ModelProvider {
    if (this.mode === "mock") return this.getProvider("mock");
    if (this.mode === "local") {
      return preferred === "deepseek" ? this.getProvider("ollama") : this.getProvider(preferred);
    }
    return this.getProvider(preferred);
  }

  /** Resolve the provider and model together so mode overrides cannot split them. */
  resolveProfile(profileId?: ModelProfile["id"]): ModelProfile {
    const requested = resolveModelProfile(profileId, this.env.ollamaDefaultModel);
    if (this.mode === "mock") {
      return { ...requested, provider: "mock", model: "mock-persona" };
    }
    if (this.mode === "local") {
      return resolveModelProfile("ollama-local", this.env.ollamaDefaultModel);
    }
    if (requested.provider === "deepseek") {
      return {
        ...requested,
        model: requested.id === "deepseek-pro"
          ? this.env.deepseekPremiumModel || requested.model
          : this.env.deepseekDefaultModel,
      };
    }
    return requested;
  }

  getRemoteTokensUsed() {
    return this.remoteTokensUsed;
  }

  addRemoteUsage(totalTokens: number) {
    this.remoteTokensUsed += totalTokens;
  }

  resetDailyBudget() {
    this.remoteTokensUsed = 0;
  }

  canUseRemote(estimated = 0) {
    return this.remoteTokensUsed + estimated < this.dailyRemoteTokenBudget;
  }
}

export function createGatewayFromEnv(processEnv: NodeJS.ProcessEnv): ModelGateway {
  const mode = parseModelMode(processEnv.MODEL_MODE);
  return new ModelGateway({
    mode,
    deepseekApiKey: processEnv.DEEPSEEK_API_KEY,
    deepseekBaseUrl: processEnv.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    deepseekDefaultModel: processEnv.DEEPSEEK_DEFAULT_MODEL || "deepseek-v4-flash",
    deepseekPremiumModel: processEnv.DEEPSEEK_PREMIUM_MODEL,
    ollamaBaseUrl: processEnv.OLLAMA_BASE_URL || "http://127.0.0.1:11434/v1",
    ollamaApiKey: processEnv.OLLAMA_API_KEY || "ollama",
    ollamaDefaultModel: processEnv.OLLAMA_DEFAULT_MODEL || "qwen3.5:latest",
    timeoutMs: Number(processEnv.MODEL_REQUEST_TIMEOUT_MS || 60000),
    dailyRemoteTokenBudget: Number(processEnv.MODEL_DAILY_REMOTE_TOKEN_BUDGET || 200000),
  });
}
