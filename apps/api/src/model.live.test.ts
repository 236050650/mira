import { describe, expect, it } from "vitest";
import { createOllamaProvider, createDeepSeekProvider } from "@mira/model-gateway";
import { loadConfig } from "./config.js";

const enabled = process.env.MODEL_LIVE_TESTS_ENABLED === "true";

describe.runIf(enabled)("live-model", () => {
  const config = loadConfig();

  it("ollama qwen3.5:latest streams a short reply", async () => {
    const provider = createOllamaProvider({
      apiKey: config.ollamaApiKey,
      baseUrl: config.ollamaBaseUrl,
      defaultModel: config.ollamaDefaultModel,
      timeoutMs: config.modelTimeoutMs,
    });
    const health = await provider.healthCheck();
    expect(health.ok).toBe(true);

    let text = "";
    let modelUsed = config.ollamaDefaultModel;
    for await (const chunk of provider.streamChat({
      requestId: "live-ollama",
      model: modelUsed,
      messages: [
        { role: "system", content: "你是孔子人格模拟。简短回答。" },
        { role: "user", content: "用一句话介绍你自己。" },
      ],
      maxOutputTokens: 120,
      thinking: "disabled",
    })) {
      if (chunk.type === "content" && chunk.delta) text += chunk.delta;
      if (chunk.type === "error") {
        throw new Error(`${chunk.error?.code}: ${chunk.error?.message}`);
      }
    }
    expect(text.length).toBeGreaterThan(4);
  }, 120000);

  it("deepseek-v4-flash streams a short reply", async () => {
    expect(config.deepseekApiKey).toBeTruthy();
    const provider = createDeepSeekProvider({
      apiKey: config.deepseekApiKey!,
      baseUrl: config.deepseekBaseUrl,
      defaultModel: config.deepseekDefaultModel,
      timeoutMs: config.modelTimeoutMs,
    });

    let text = "";
    let sawUsage = false;
    for await (const chunk of provider.streamChat({
      requestId: "live-deepseek",
      model: "deepseek-v4-flash",
      messages: [
        { role: "system", content: "你是孔子人格模拟。简短回答，不要使用列表。" },
        { role: "user", content: "用一句话介绍你自己。" },
      ],
      maxOutputTokens: 120,
      thinking: "disabled",
    })) {
      if (chunk.type === "reasoning") {
        // must not be treated as speech; just ignore
        continue;
      }
      if (chunk.type === "content" && chunk.delta) text += chunk.delta;
      if (chunk.type === "usage") sawUsage = true;
      if (chunk.type === "error") {
        throw new Error(`${chunk.error?.code}: ${chunk.error?.message}`);
      }
    }
    expect(text.length).toBeGreaterThan(4);
    expect(text.toLowerCase()).not.toContain("reasoning_content");
    expect(sawUsage).toBe(true);
  }, 120000);
});
