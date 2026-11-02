import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("api config", () => {
  it("normalizes live and rejects unknown model modes", () => {
    expect(loadConfig({ MODEL_MODE: "live" }).modelMode).toBe("remote");
    expect(() => loadConfig({ MODEL_MODE: "invalid" })).toThrow("MODEL_MODE");
  });
  it("defaults to mock-friendly local settings", () => {
    const config = loadConfig({
      USE_PGLITE: "true",
      MODEL_MODE: "mock",
    } as NodeJS.ProcessEnv);
    expect(config.usePglite).toBe(true);
    expect(config.modelMode).toBe("mock");
    expect(config.deepseekDefaultModel).toBe("deepseek-v4-flash");
    expect(config.ollamaDefaultModel).toBe("qwen3.5:latest");
  });
});
