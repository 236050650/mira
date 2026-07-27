import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MockProvider } from "@mira/model-gateway";
import { buildApp, type BuiltApp } from "./main.js";

describe("stop and regenerate", () => {
  let built: BuiltApp;
  let accessToken = "";
  let userId = "";
  let conversationId = "";

  beforeAll(async () => {
    process.env.USE_PGLITE = "true";
    process.env.MODEL_MODE = "mock";
    process.env.LOG_LEVEL = "error";
    delete process.env.DATABASE_URL;
    built = await buildApp({ migrate: true, seed: true });

    built.gateway.setProvider(
      "mock",
      new MockProvider({
        chunks: ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"],
        firstTokenDelayMs: 20,
        chunkDelayMs: 50,
      }),
    );

    await built.app.ready();

    const reg = await built.app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: `stop-${randomUUID()}@example.com`,
        nickname: "停止测试",
        password: "Passw0rd1",
      },
    });
    accessToken = reg.json().accessToken;
    userId = reg.json().user.id;

    const personas = await built.app.inject({
      method: "GET",
      url: "/v1/personas?query=霍去病",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const created = await built.app.inject({
      method: "POST",
      url: "/v1/conversations",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { personaId: personas.json().items[0].id },
    });
    conversationId = created.json().conversation.id;
  }, 120000);

  afterAll(async () => {
    if (built?.app) await built.app.close();
  });

  it("stops a running generation and keeps partial content", async () => {
    let generationId = "";
    let assistantId = "";
    const events: string[] = [];

    await built.chat.streamMessage({
      userId,
      conversationId,
      clientMessageId: randomUUID(),
      content: "请慢慢回答。",
      onEvent: async (event, data) => {
        events.push(event);
        if (event === "message.accepted") {
          generationId = (data as { generationId: string }).generationId;
          assistantId = (data as { assistantMessageId: string }).assistantMessageId;
          await built.chat.requestStop(userId, conversationId, generationId);
        }
      },
    });

    expect(events).toContain("message.accepted");
    const messages = await built.app.inject({
      method: "GET",
      url: `/v1/conversations/${conversationId}/messages`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const assistant = messages.json().items.find((m: { id: string }) => m.id === assistantId) as {
      status: string;
      content: string;
    };
    expect(assistant).toBeTruthy();
    expect(["interrupted", "completed"]).toContain(assistant.status);
  });

  it("regenerates without duplicating the user message", async () => {
    let assistantId = "";
    await built.chat.streamMessage({
      userId,
      conversationId,
      clientMessageId: randomUUID(),
      content: "简短回答。",
      onEvent: (event, data) => {
        if (event === "message.accepted") {
          assistantId = (data as { assistantMessageId: string }).assistantMessageId;
        }
      },
    });

    const before = await built.app.inject({
      method: "GET",
      url: `/v1/conversations/${conversationId}/messages`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const beforeUsers = before.json().items.filter((m: { role: string }) => m.role === "user").length;

    await built.chat.regenerateMessage({
      userId,
      conversationId,
      assistantMessageId: assistantId,
      onEvent: () => undefined,
    });

    const after = await built.app.inject({
      method: "GET",
      url: `/v1/conversations/${conversationId}/messages`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const afterUsers = after.json().items.filter((m: { role: string }) => m.role === "user").length;
    expect(afterUsers).toBe(beforeUsers);
  });
});
