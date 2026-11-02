import { describe, expect, it } from "vitest";
import { MockProvider } from "../src/mock-provider.js";

describe("MockProvider", () => {
  it("streams content chunks", async () => {
    const provider = new MockProvider({
      chunks: ["你好", "世界"],
      firstTokenDelayMs: 0,
      chunkDelayMs: 0,
    });
    const parts: string[] = [];
    for await (const chunk of provider.streamChat({
      requestId: "r1",
      model: "mock",
      messages: [{ role: "user", content: "hi" }],
      maxOutputTokens: 100,
      thinking: "disabled",
    })) {
      if (chunk.type === "content" && chunk.delta) parts.push(chunk.delta);
    }
    expect(parts.join("")).toBe("你好世界");
  });

  it("maps balance insufficient", async () => {
    const provider = new MockProvider({ scenario: "balance-insufficient" });
    const chunks = [];
    for await (const chunk of provider.streamChat({
      requestId: "r2",
      model: "mock",
      messages: [{ role: "user", content: "hi" }],
      maxOutputTokens: 100,
      thinking: "disabled",
    })) {
      chunks.push(chunk);
    }
    expect(chunks[0]?.type).toBe("error");
    expect(chunks[0]?.error?.code).toBe("MODEL_BALANCE_INSUFFICIENT");
  });
});
