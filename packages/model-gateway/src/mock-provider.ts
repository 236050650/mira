import type { ChatChunk, ChatRequest, HealthResult, ModelDescriptor, ModelProvider } from "./types.js";

export type MockScenario =
  | "ok"
  | "slow-first-token"
  | "mid-stream-error"
  | "rate-limited"
  | "balance-insufficient"
  | "timeout"
  | "empty"
  | "content-filter";

export type MockProviderOptions = {
  scenario?: MockScenario;
  chunks?: string[];
  firstTokenDelayMs?: number;
  chunkDelayMs?: number;
};

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      },
      { once: true },
    );
  });
}

export class MockProvider implements ModelProvider {
  readonly id = "mock" as const;
  private scenario: MockScenario;
  private chunks: string[];
  private firstTokenDelayMs: number;
  private chunkDelayMs: number;

  constructor(options: MockProviderOptions = {}) {
    this.scenario = options.scenario ?? "ok";
    this.chunks = options.chunks ?? ["这是", "一段", "模拟", "流式", "回复。"];
    this.firstTokenDelayMs = options.firstTokenDelayMs ?? 20;
    this.chunkDelayMs = options.chunkDelayMs ?? 5;
  }

  setScenario(scenario: MockScenario) {
    this.scenario = scenario;
  }

  async healthCheck(): Promise<HealthResult> {
    return { ok: true, detail: "mock ready", latencyMs: 1 };
  }

  async listModels(): Promise<ModelDescriptor[]> {
    return [
      {
        provider: "mock",
        id: "mock-persona",
        displayName: "Mock Persona",
        supportsStreaming: true,
        supportsThinking: false,
        available: true,
      },
    ];
  }

  async *streamChat(request: ChatRequest): AsyncIterable<ChatChunk> {
    if (this.scenario === "timeout") {
      await sleep(request.maxOutputTokens > 0 ? 50 : 50, request.signal);
      yield {
        type: "error",
        error: { code: "MODEL_TIMEOUT", message: "模型响应超时" },
      };
      return;
    }

    if (this.scenario === "rate-limited") {
      yield {
        type: "error",
        error: { code: "MODEL_RATE_LIMITED", message: "模型服务繁忙，请稍后重试" },
      };
      return;
    }

    if (this.scenario === "balance-insufficient") {
      yield {
        type: "error",
        error: {
          code: "MODEL_BALANCE_INSUFFICIENT",
          message: "远程模型余额不足，可切换到本地 Ollama",
        },
      };
      return;
    }

    if (this.scenario === "empty") {
      yield {
        type: "usage",
        usage: { inputTokens: 12, outputTokens: 0, totalTokens: 12 },
      };
      yield { type: "done", finishReason: "stop" };
      return;
    }

    if (this.scenario === "content-filter") {
      yield { type: "content", delta: "……" };
      yield {
        type: "usage",
        usage: { inputTokens: 20, outputTokens: 1, totalTokens: 21 },
      };
      yield { type: "done", finishReason: "content_filter" };
      return;
    }

    const delay = this.scenario === "slow-first-token" ? 120 : this.firstTokenDelayMs;
    await sleep(delay, request.signal);

    for (let i = 0; i < this.chunks.length; i += 1) {
      if (this.scenario === "mid-stream-error" && i === Math.max(1, Math.floor(this.chunks.length / 2))) {
        yield {
          type: "error",
          error: { code: "GENERATION_INTERRUPTED", message: "流式输出中断" },
        };
        return;
      }
      yield { type: "content", delta: this.chunks[i] };
      if (this.chunkDelayMs > 0) {
        await sleep(this.chunkDelayMs, request.signal);
      }
    }

    yield {
      type: "usage",
      usage: {
        inputTokens: 48,
        outputTokens: 16,
        totalTokens: 64,
      },
    };
    yield { type: "done", finishReason: "stop" };
  }
}
