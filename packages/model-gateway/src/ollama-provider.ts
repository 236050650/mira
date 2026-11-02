import { ErrorCodes } from "@mira/contracts";
import type { ChatChunk, ChatRequest, HealthResult, ModelDescriptor, ModelProvider } from "./types.js";

export type OllamaConfig = {
  baseUrl: string;
  apiKey?: string;
  defaultModel: string;
  timeoutMs: number;
};

/** Prefer native Ollama API so think:false works for qwen3.5. */
export class OllamaProvider implements ModelProvider {
  readonly id = "ollama" as const;

  constructor(private readonly config: OllamaConfig) {}

  private rootUrl() {
    // Accept either http://host:11434 or http://host:11434/v1
    return this.config.baseUrl.replace(/\/$/, "").replace(/\/v1$/, "");
  }

  async healthCheck(): Promise<HealthResult> {
    const started = Date.now();
    try {
      const res = await fetch(`${this.rootUrl()}/api/tags`, {
        signal: AbortSignal.timeout(Math.min(this.config.timeoutMs, 8000)),
      });
      const latencyMs = Date.now() - started;
      if (!res.ok) {
        return { ok: false, detail: `Ollama health failed: HTTP ${res.status}`, latencyMs };
      }
      return { ok: true, detail: "ok", latencyMs };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      return {
        ok: false,
        detail: `Ollama 未启动或不可达（${message}）。请先运行 ollama serve，并确认已下载模型。`,
        latencyMs: Date.now() - started,
      };
    }
  }

  async listModels(): Promise<ModelDescriptor[]> {
    try {
      const res = await fetch(`${this.rootUrl()}/api/tags`, {
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
      if (!res.ok) return [];
      const json = (await res.json()) as { models?: Array<{ name: string }> };
      return (json.models ?? []).map((item) => ({
        provider: "ollama",
        id: item.name,
        displayName: item.name,
        supportsStreaming: true,
        supportsThinking: true,
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
      let res: Response;
      try {
        res = await fetch(`${this.rootUrl()}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: request.model,
            messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
            stream: true,
            think: request.thinking === "enabled",
            options: {
              num_predict: request.maxOutputTokens,
            },
          }),
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
        yield {
          type: "error",
          error: {
            code: ErrorCodes.MODEL_UNAVAILABLE,
            message: "Ollama 未启动。请在本机运行 `ollama serve`，并执行 `ollama pull qwen3.5:latest`。",
          },
        };
        return;
      }

      if (!res.ok) {
        const text = await res.text();
        if (res.status === 404 || text.toLowerCase().includes("not found")) {
          yield {
            type: "error",
            error: {
              code: ErrorCodes.MODEL_NOT_INSTALLED,
              message: `本地模型未安装。请执行：ollama pull ${request.model}`,
            },
          };
          return;
        }
        yield {
          type: "error",
          error: { code: ErrorCodes.MODEL_UNAVAILABLE, message: "本地模型服务不可用" },
        };
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
      const decoder = new TextDecoder();
      let buffer = "";
      let finishReason = "stop";
      let promptTokens = 0;
      let outputTokens = 0;

      while (true) {
        if (request.signal?.aborted) {
          throw Object.assign(new Error("aborted"), { name: "AbortError" });
        }
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let json: {
            message?: { content?: string; thinking?: string };
            done?: boolean;
            done_reason?: string;
            prompt_eval_count?: number;
            eval_count?: number;
            error?: string;
          };
          try {
            json = JSON.parse(trimmed);
          } catch {
            continue;
          }
          if (json.error) {
            yield {
              type: "error",
              error: { code: ErrorCodes.MODEL_UNAVAILABLE, message: json.error },
            };
            return;
          }
          const thinking = json.message?.thinking;
          if (thinking) {
            yield { type: "reasoning", delta: thinking };
          }
          const content = json.message?.content;
          if (content) {
            yield { type: "content", delta: content };
          }
          if (typeof json.prompt_eval_count === "number") promptTokens = json.prompt_eval_count;
          if (typeof json.eval_count === "number") outputTokens = json.eval_count;
          if (json.done) {
            finishReason = json.done_reason || "stop";
          }
        }
      }

      yield {
        type: "usage",
        usage: {
          inputTokens: promptTokens,
          outputTokens,
          totalTokens: promptTokens + outputTokens,
        },
      };
      yield { type: "done", finishReason };
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener("abort", onAbort);
    }
  }
}

export function createOllamaProvider(env: {
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
  timeoutMs: number;
}) {
  return new OllamaProvider({
    baseUrl: env.baseUrl,
    apiKey: env.apiKey,
    defaultModel: env.defaultModel,
    timeoutMs: env.timeoutMs,
  });
}
