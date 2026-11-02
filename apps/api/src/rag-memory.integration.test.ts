import { randomUUID } from "node:crypto";
import { allocateContextBudget, selectRecentMessages } from "@mira/domain";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, type BuiltApp } from "./main.js";

describe("rag memory retrieval", () => {
  let built: BuiltApp;
  let accessToken = "";
  let userId = "";
  let conversationId = "";
  let personaId = "";

  beforeAll(async () => {
    process.env.USE_PGLITE = "true";
    process.env.MODEL_MODE = "mock";
    process.env.LOG_LEVEL = "error";
    delete process.env.DATABASE_URL;
    built = await buildApp({ migrate: true, seed: true });
    await built.app.ready();

    const reg = await built.app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: `rag-${randomUUID()}@example.com`,
        nickname: "检索测试",
        password: "Passw0rd1",
      },
    });
    accessToken = reg.json().accessToken;
    userId = reg.json().user.id;

    const personas = await built.app.inject({
      method: "GET",
      url: "/v1/personas?query=孔子",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    personaId = personas.json().items[0].id;
    const created = await built.app.inject({
      method: "POST",
      url: "/v1/conversations",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { personaId },
    });
    conversationId = created.json().conversation.id;
  }, 120000);

  afterAll(async () => {
    if (built?.app) await built.app.close();
  });

  it("keeps an early preference after later chit-chat fills the recent window", async () => {
    const headers = { authorization: `Bearer ${accessToken}` };
    const preference = "请记住我不喝咖啡，更喜欢乌龙茶。";
    const send = async (content: string) => {
      const response = await built.app.inject({
        method: "POST",
        url: `/v1/conversations/${conversationId}/messages/stream`,
        headers,
        payload: { clientMessageId: randomUUID(), content },
      });
      expect(response.statusCode).toBe(200);
      expect(response.body).toContain("message.completed");
    };

    await send(preference);
    for (let index = 0; index < 8; index += 1) {
      const marker = index === 7 ? "最近闲聊专属标记" : `闲聊填充${index}`;
      await send(`${marker}${"今天天气还行，随便聊聊。".repeat(40)}`);
    }

    let memoryId = "";
    for (let attempt = 0; attempt < 30 && !memoryId; attempt += 1) {
      const list = await built.app.inject({
        method: "GET",
        url: `/v1/memories?personaId=${personaId}`,
        headers,
      });
      const items = list.json().items as Array<{ id: string; content: string }>;
      memoryId = items.find((item) => item.content.includes("乌龙茶"))?.id ?? "";
      if (!memoryId) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(memoryId).toBeTruthy();

    const listed = await built.app.inject({
      method: "GET",
      url: `/v1/conversations/${conversationId}/messages`,
      headers,
    });
    const turns = (listed.json().items as Array<{ id: string; role: string; content: string; status: string }>)
      .filter((item) => item.status === "completed" && (item.role === "user" || item.role === "assistant"))
      .map((item) => ({ id: item.id, role: item.role as "user" | "assistant", content: item.content }));
    const recentIds = selectRecentMessages(turns, allocateContextBudget().recentMessages).map((turn) => turn.id);

    let retrieved = await built.retrieval.retrieve({
      query: "我更喜欢喝什么？",
      personaId,
      userId,
      conversationId,
      excludeSourceIds: recentIds,
      budgets: { knowledge: 400, memories: 400, history: 400 },
    });
    for (let attempt = 0; attempt < 20 && !retrieved.memories.some((memory) => memory.content.includes("乌龙茶")); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      retrieved = await built.retrieval.retrieve({
        query: "我更喜欢喝什么？",
        personaId,
        userId,
        conversationId,
        excludeSourceIds: recentIds,
        budgets: { knowledge: 400, memories: 400, history: 400 },
      });
    }

    expect(retrieved.memories.some((memory) => memory.content.includes("乌龙茶"))).toBe(true);
    expect(retrieved.history.every((item) => !recentIds.includes(item.sourceId))).toBe(true);
    expect(retrieved.history.some((item) => item.content.includes("最近闲聊专属标记"))).toBe(false);
    expect(
      retrieved.history.some((item) => item.content.includes("乌龙茶")) ||
        retrieved.memories.some((memory) => memory.content.includes("乌龙茶")),
    ).toBe(true);

    const deleted = await built.app.inject({
      method: "DELETE",
      url: `/v1/memories/${memoryId}`,
      headers,
    });
    expect(deleted.statusCode).toBe(200);
    const afterDelete = await built.retrieval.retrieve({
      query: "我更喜欢喝什么？",
      personaId,
      userId,
      conversationId,
      excludeSourceIds: recentIds,
      budgets: { knowledge: 400, memories: 400, history: 400 },
    });
    expect(afterDelete.memories.some((memory) => memory.sourceId === memoryId)).toBe(false);
  }, 120000);
});
