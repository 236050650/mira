import { describe, expect, it } from "vitest";
import { MiraConversationMemory } from "./memory.js";

describe("MiraConversationMemory", () => {
  it("builds LangChain messages with summary and recent turns", async () => {
    const memory = new MiraConversationMemory();
    await memory.seedRecentTurns([
      { role: "user", content: "你好" },
      { role: "assistant", content: "你好呀" },
    ]);
    const messages = await memory.toChatMessages({
      systemPrompt: "你是测试角色",
      summary: "用户打过招呼",
      recentTurns: [],
      currentUserMessage: "继续聊",
    });
    expect(messages).toHaveLength(5);
    expect(String(messages[0]?.content)).toContain("你是测试角色");
    expect(String(messages[1]?.content)).toContain("会话摘要");
    expect(String(messages.at(-1)?.content)).toBe("继续聊");
  });
});
