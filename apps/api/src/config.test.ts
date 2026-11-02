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

  it("rejects default JWT secrets in production", () => {
    expect(() => 
      loadConfig({ 
        NODE_ENV: "production",
        JWT_ACCESS_SECRET: "dev-access-secret-change-me",
        JWT_REFRESH_SECRET: "custom-secret",
      } as NodeJS.ProcessEnv)
    ).toThrow(/JWT_ACCESS_SECRET.*must not use the default value/);

    expect(() => 
      loadConfig({ 
        NODE_ENV: "production",
        JWT_ACCESS_SECRET: "custom-secret",
        JWT_REFRESH_SECRET: "dev-refresh-secret-change-me",
      } as NodeJS.ProcessEnv)
    ).toThrow(/JWT_REFRESH_SECRET.*must not use the default value/);

    expect(() => 
      loadConfig({ 
        NODE_ENV: "production",
      } as NodeJS.ProcessEnv)
    ).toThrow(/JWT_ACCESS_SECRET.*must not use the default value/);
  });

  it("allows default secrets in development", () => {
    expect(() => 
      loadConfig({ 
        NODE_ENV: "development",
      } as NodeJS.ProcessEnv)
    ).not.toThrow();

    expect(() => 
      loadConfig({} as NodeJS.ProcessEnv)
    ).not.toThrow();
  });

  it("allows custom secrets in production", () => {
    const config = loadConfig({
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: "secure-random-access-secret-123",
      JWT_REFRESH_SECRET: "secure-random-refresh-secret-456",
      USE_PGLITE: "true",
      MODEL_MODE: "mock",
    } as NodeJS.ProcessEnv);

    expect(config.jwtAccessSecret).toBe("secure-random-access-secret-123");
    expect(config.jwtRefreshSecret).toBe("secure-random-refresh-secret-456");
  });
});
