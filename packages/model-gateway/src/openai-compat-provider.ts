import { ErrorCodes } from "@mira/contracts";
import type { ChatChunk, ChatRequest, HealthResult, ModelDescriptor, ModelProvider } from "./types.js";

export type OpenAICompatConfig = {
  providerId: "deepseek" | "ollama";
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  timeoutMs: number;
  displayName: string;
};

type OpenAIStreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string | null;
      reasoning_content?: string | null;
    };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
    code?: string | number;
    type?: string;
  };
};

function mapProviderError(status: number, bodyText: string, providerId: string) {
  const lower = bodyText.toLowerCase();
  if (status === 401 || status === 403) {
    return {
      code: ErrorCodes.MODEL_UNAVAILABLE,
      message: `${providerId} 鉴权失败，请检查服务端密钥配置`,
    };
  }
  if (status === 402 || lower.includes("insufficient") || lower.includes("balance")) {
    return {
      code: ErrorCodes.MODEL_BALANCE_INSUFFICIENT,
      message: "远程模型余额不足，可切换到本地 Ollama",
    };
  }
  if (status === 429) {
    return {
      code: ErrorCodes.MODEL_RATE_LIMITED,
      message: "模型服务繁忙或触发限流，请稍后重试",
    };
  }
  if (status === 404 && (lower.includes("model") || lower.includes("not found"))) {
    return {
      code: ErrorCodes.MODEL_NOT_INSTALLED,
      message: "指定模型未安装或不存在",
    };
  }
  if (status >= 500) {
    return {
      code: ErrorCodes.MODEL_UNAVAILABLE,
      message: "模型服务暂时不可用",
    };
  }
  return {
    code: ErrorCodes.MODEL_UNAVAILABLE,
    message: "模型请求失败",
  };
}

async function* parseSse(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<OpenAIStreamChunk> {
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    if (signal?.aborted) {
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    }
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";
    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        yield JSON.parse(data) as OpenAIStreamChunk;
      } catch {
        // ignore malformed chunks
      }
    }
  }
}

export class OpenAICompatProvider implements ModelProvider {
  readonly id: "deepseek" | "ollama";
  private readonly config: OpenAICompatConfig;

  constructor(config: OpenAICompatConfig) {
    this.id = config.providerId;
    this.config = config;
  }

  async healthCheck(): Promise<HealthResult> {
    const started = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(this.config.timeoutMs, 8000));
      const res = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/models`, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      const latencyMs = Date.now() - started;
      if (!res.ok) {
        return {
          ok: false,
          detail: `${this.id} health failed: HTTP ${res.status}`,
          latencyMs,
        };
      }
      return { ok: true, detail: "ok", latencyMs };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      const detail =
        this.id === "ollama"
          ? `Ollama 未启动或不可达（${message}）。请先运行 ollama serve，并确认已下载模型。`
          : `DeepSeek 不可达（${message}）`;
      return { ok: false, detail, latencyMs: Date.now() - started };
    }
  }

  async listModels(): Promise<ModelDescriptor[]> {
    try {
      const res = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/models`, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
      if (!res.ok) return [];
      const json = (await res.json()) as { data?: Array<{ id: string }> };
      return (json.data ?? []).map((item) => ({
        provider: this.id,
        id: item.id,
        displayName: item.id,
        supportsStreaming: true,
        supportsThinking: this.id === "deepseek",
        available: true,
      }));
    } catch {
      return [];
    }
  }

  async *streamChat(request: ChatRequest): AsyncIterable<ChatChunk> {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    request.signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const body: Record<string, unknown> = {
        model: request.model,
        messages: request.messages,
        stream: true,
        stream_options: { include_usage: true },
        max_tokens: request.maxOutputTokens,
      };

      if (this.id === "deepseek") {
        body.thinking = { type: request.thinking === "enabled" ? "enabled" : "disabled" };
      }

      let res: Response;
      try {
        res = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          yield {
            type: "error",
            error: { code: ErrorCodes.MODEL_TIMEOUT, message: "模型响应超时" },
          };
          return;
        }
        const hint =
          this.id === "ollama"
            ? "Ollama 未启动。请在本机运行 `ollama serve`，并执行 `ollama pull qwen3.5:latest`。"
            : "无法连接远程模型服务";
        yield {
          type: "error",
          error: { code: ErrorCodes.MODEL_UNAVAILABLE, message: hint },
        };
        return;
      }

      if (!res.ok) {
        const text = await res.text();
        if (this.id === "ollama" && res.status === 404) {
          yield {
            type: "error",
            error: {
              code: ErrorCodes.MODEL_NOT_INSTALLED,
              message: `本地模型未安装。请执行：ollama pull ${request.model}`,
            },
          };
          return;
        }
        yield { type: "error", error: mapProviderError(res.status, text, this.id) };
        return;
      }

      if (!res.body) {
        yield {
          type: "error",
          error: { code: ErrorCodes.MODEL_UNAVAILABLE, message: "模型返回空响应体" },
        };
        return;
      }

      const reader = res.body.getReader();
      let finishReason = "stop";
      for await (const chunk of parseSse(reader, request.signal)) {
        if (chunk.error) {
          yield {
            type: "error",
            error: mapProviderError(500, chunk.error.message ?? "provider error", this.id),
          };
          return;
        }

        const choice = chunk.choices?.[0];
        const reasoning = choice?.delta?.reasoning_content ?? (choice?.delta as { reasoning?: string } | undefined)?.reasoning;
        if (reasoning) {
          // Do not expose reasoning as persona speech.
          yield { type: "reasoning", delta: reasoning };
        }
        const content = choice?.delta?.content;
        if (content) {
          yield { type: "content", delta: content };
        }
        if (choice?.finish_reason) {
          finishReason = choice.finish_reason;
        }
        if (chunk.usage) {
          yield {
            type: "usage",
            usage: {
              inputTokens: chunk.usage.prompt_tokens ?? 0,
              outputTokens: chunk.usage.completion_tokens ?? 0,
              totalTokens: chunk.usage.total_tokens ?? 0,
            },
          };
        }
      }
      yield { type: "done", finishReason };
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener("abort", onAbort);
    }
  }
}

export function createDeepSeekProvider(env: {
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
  timeoutMs: number;
}) {
  return new OpenAICompatProvider({
    providerId: "deepseek",
    baseUrl: env.baseUrl,
    apiKey: env.apiKey,
    defaultModel: env.defaultModel,
    timeoutMs: env.timeoutMs,
    displayName: "DeepSeek",
  });
}
