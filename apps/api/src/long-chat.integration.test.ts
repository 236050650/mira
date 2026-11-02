import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { estimateTokens } from "@mira/domain";
import { buildApp, type BuiltApp } from "./main.js";

describe("long conversation budget", () => {
  let built: BuiltApp;
  let accessToken = "";
  let conversationId = "";

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
        email: `long-${randomUUID()}@example.com`,
        nickname: "长会话",
        password: "Passw0rd1",
      },
    });
    accessToken = reg.json().accessToken;

    const personas = await built.app.inject({
      method: "GET",
      url: "/v1/personas?query=霍去病",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const personaId = personas.json().items[0].id;
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

  it("completes 30 turns with summary and bounded growth", async () => {
    for (let i = 0; i < 30; i += 1) {
      const res = await built.app.inject({
        method: "POST",
        url: `/v1/conversations/${conversationId}/messages/stream`,
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          clientMessageId: randomUUID(),
          content: `第${i + 1}轮：我担心补给不足，该如何判断？补充编号 ${i + 1}`,
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.body).toContain("message.completed");
    }

    await new Promise((r) => setTimeout(r, 1000));

    const detail = await built.app.inject({
      method: "GET",
      url: `/v1/conversations/${conversationId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(detail.statusCode).toBe(200);
    const summary = detail.json().conversation.summary as string | null;
    expect(summary && summary.length > 0).toBe(true);

    const messages = await built.app.inject({
      method: "GET",
      url: `/v1/conversations/${conversationId}/messages`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const items = messages.json().items as Array<{ role: string; content: string }>;
    expect(items.filter((m) => m.role === "user").length).toBeGreaterThanOrEqual(30);

    // Full history token estimate would be large; summary itself stays bounded.
    expect(estimateTokens(summary || "")).toBeLessThan(2000);
  }, 180000);
});
