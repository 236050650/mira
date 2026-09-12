import { describe, expect, it } from "vitest";
import { createGatewayFromEnv, ModelGateway, parseModelMode } from "./gateway.js";

function gateway(budget: number) {
  return new ModelGateway({
    mode: "remote",
    deepseekApiKey: "test",
    deepseekBaseUrl: "http://127.0.0.1:1",
    deepseekDefaultModel: "test",
    ollamaBaseUrl: "http://127.0.0.1:2",
    ollamaApiKey: "ollama",
    ollamaDefaultModel: "test",
    timeoutMs: 50,
    dailyRemoteTokenBudget: budget,
  });
}

describe("remote token budget", () => {
  it("blocks new remote requests when usage reaches the daily budget", () => {
    const subject = gateway(10);
    expect(subject.canUseRemote()).toBe(true);
    subject.addRemoteUsage(10);
    expect(subject.canUseRemote()).toBe(false);
  });

  it("does not affect local provider resolution", () => {
    const subject = gateway(0);
    expect(subject.canUseRemote()).toBe(false);
    expect(subject.resolveProviderForMode("ollama").id).toBe("ollama");
  });
});

describe("model routing", () => {
  it("routes auto and remote selections to the configured local model in local mode", () => {
    const subject = createGatewayFromEnv({ MODEL_MODE: "local", OLLAMA_DEFAULT_MODEL: "local-test" });
    for (const id of ["auto", "deepseek-flash", "deepseek-pro", "ollama-local"] as const) {
      expect(subject.resolveProfile(id)).toMatchObject({
        id: "ollama-local", provider: "ollama", model: "local-test",
      });
    }
  });

  it("honors configured remote model names and leaves explicit local requests local", () => {
    const subject = createGatewayFromEnv({
      MODEL_MODE: "remote", DEEPSEEK_DEFAULT_MODEL: "flash-test",
      DEEPSEEK_PREMIUM_MODEL: "pro-test", OLLAMA_DEFAULT_MODEL: "local-test",
    });
    expect(subject.resolveProfile("auto").model).toBe("flash-test");
    expect(subject.resolveProfile("deepseek-pro").model).toBe("pro-test");
    expect(subject.resolveProfile("ollama-local")).toMatchObject({ provider: "ollama", model: "local-test" });
  });

  it("labels mock output with the actual provider and model", () => {
    expect(createGatewayFromEnv({}).resolveProfile("deepseek-pro"))
      .toMatchObject({ provider: "mock", model: "mock-persona" });
  });

  it("accepts the documented legacy live alias and rejects typos", () => {
    expect(parseModelMode("live")).toBe("remote");
    expect(() => parseModelMode("remtoe")).toThrow("MODEL_MODE");
  });
});
