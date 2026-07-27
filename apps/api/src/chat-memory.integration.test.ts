import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, type BuiltApp } from "./main.js";

describe("chat memory + model switch", () => {
  let built: BuiltApp;
  let accessToken = "";
  let conversationId = "";
  let personaId = "";

  beforeAll(async () => {
    process.env.USE_PGLITE = "true";
    process.env.MODEL_MODE = "mock";
    process.env.LOG_LEVEL = "error";
    delete process.env.DATABASE_URL;
    built = await buildApp({ migrate: true, seed: true });
    await built.app.ready();

    const email = `mem-${randomUUID()}@example.com`;
    const reg = await built.app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email, nickname: "记忆测试", password: "Passw0rd1" },
    });
    accessToken = reg.json().accessToken;

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
      payload: { personaId, modelProfileId: "deepseek-flash" },
    });
    conversationId = created.json().conversation.id;
  }, 120000);

  afterAll(async () => {
    if (built?.app) await built.app.close();
  });

  it("stores preference memory and soft-deletes it", async () => {
    const stream = await built.app.inject({
      method: "POST",
      url: `/v1/conversations/${conversationId}/messages/stream`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        clientMessageId: randomUUID(),
        content: "请记住我不喝咖啡，更喜欢乌龙茶。",
        modelProfileId: "deepseek-flash",
      },
    });
    expect(stream.statusCode).toBe(200);
    expect(stream.body).toContain("message.completed");

    // allow async postProcess
    await new Promise((r) => setTimeout(r, 200));

    const list = await built.app.inject({
      method: "GET",
      url: `/v1/memories?personaId=${personaId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(list.statusCode).toBe(200);
    const items = list.json().items as Array<{ id: string; content: string }>;
    expect(items.some((m) => m.content.includes("乌龙茶") || m.content.includes("咖啡"))).toBe(true);

    const memoryId = items[0]!.id;
    const deleted = await built.app.inject({
      method: "DELETE",
      url: `/v1/memories/${memoryId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(deleted.statusCode).toBe(200);

    const after = await built.app.inject({
      method: "GET",
      url: `/v1/memories?personaId=${personaId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(after.json().items.every((m: { id: string }) => m.id !== memoryId)).toBe(true);
  });

  it("switches model profile without losing history", async () => {
    const before = await built.app.inject({
      method: "GET",
      url: `/v1/conversations/${conversationId}/messages`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const beforeCount = before.json().items.length;

    const patched = await built.app.inject({
      method: "PATCH",
      url: `/v1/conversations/${conversationId}`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { modelProfileId: "ollama-local" },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().conversation.preferredModelProfileId).toBe("ollama-local");

    const stream = await built.app.inject({
      method: "POST",
      url: `/v1/conversations/${conversationId}/messages/stream`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        clientMessageId: randomUUID(),
        content: "继续聊。",
        modelProfileId: "ollama-local",
      },
    });
    expect(stream.statusCode).toBe(200);
    expect(stream.body).toContain("message.completed");

    const after = await built.app.inject({
      method: "GET",
      url: `/v1/conversations/${conversationId}/messages`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(after.json().items.length).toBeGreaterThan(beforeCount);
  });

  it("isolates conversations across users", async () => {
    const other = await built.app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: `other-${randomUUID()}@example.com`,
        nickname: "他人",
        password: "Passw0rd1",
      },
    });
    const otherToken = other.json().accessToken;
    const denied = await built.app.inject({
      method: "GET",
      url: `/v1/conversations/${conversationId}/messages`,
      headers: { authorization: `Bearer ${otherToken}` },
    });
    expect([403, 404]).toContain(denied.statusCode);
  });
});
