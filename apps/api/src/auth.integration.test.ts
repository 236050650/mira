import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { buildApp, type BuiltApp } from "./main.js";

describe("auth + personas integration", () => {
  let built: BuiltApp;
  const email = `user-${randomUUID()}@example.com`;
  const password = "Passw0rd1";
  let accessToken = "";
  let refreshToken = "";

  beforeAll(async () => {
    process.env.USE_PGLITE = "true";
    process.env.MODEL_MODE = "mock";
    process.env.LOG_LEVEL = "error";
    delete process.env.DATABASE_URL;
    built = await buildApp({ migrate: true, seed: true });
    await built.app.ready();
  }, 120000);

  afterAll(async () => {
    if (built?.app) {
      await built.app.close();
    }
  });

  it("registers a new user", async () => {
    const res = await built.app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email, nickname: "测试用户", password },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user.email).toBe(email);
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    accessToken = body.accessToken;
    refreshToken = body.refreshToken;
  });

  it("rejects duplicate email", async () => {
    const res = await built.app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email, nickname: "另一个", password },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("AUTH_EMAIL_EXISTS");
  });

  it("rejects weak password", async () => {
    const res = await built.app.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email: `weak-${randomUUID()}@example.com`, nickname: "弱密码", password: "123" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_FAILED");
  });

  it("logs in and refreshes", async () => {
    const login = await built.app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email, password },
    });
    expect(login.statusCode).toBe(200);
    accessToken = login.json().accessToken;
    refreshToken = login.json().refreshToken;

    const refreshed = await built.app.inject({
      method: "POST",
      url: "/v1/auth/refresh",
      payload: { refreshToken },
    });
    expect(refreshed.statusCode).toBe(200);
    accessToken = refreshed.json().accessToken;
    refreshToken = refreshed.json().refreshToken;
  });

  it("lists seeded personas", async () => {
    const res = await built.app.inject({
      method: "GET",
      url: "/v1/personas",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const items = res.json().items;
    expect(items.length).toBeGreaterThanOrEqual(18);
    expect(items.some((p: { slug: string }) => p.slug === "huo-qubing")).toBe(true);
    expect(items.some((p: { slug: string }) => p.slug === "pikachu")).toBe(true);
  });

  it("creates conversation and streams mock chat", async () => {
    const list = await built.app.inject({
      method: "GET",
      url: "/v1/personas?query=霍去病",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const persona = list.json().items[0];
    expect(persona).toBeTruthy();

    const created = await built.app.inject({
      method: "POST",
      url: "/v1/conversations",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { personaId: persona.id, modelProfileId: "deepseek-flash" },
    });
    expect(created.statusCode).toBe(201);
    const conversationId = created.json().conversation.id;

    const stream = await built.app.inject({
      method: "POST",
      url: `/v1/conversations/${conversationId}/messages/stream`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        clientMessageId: randomUUID(),
        content: "你好，霍将军。",
        modelProfileId: "deepseek-flash",
      },
    });
    expect(stream.statusCode).toBe(200);
    expect(stream.body).toContain("message.accepted");
    expect(stream.body).toContain("message.completed");

    const messages = await built.app.inject({
      method: "GET",
      url: `/v1/conversations/${conversationId}/messages`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(messages.statusCode).toBe(200);
    const rows = messages.json().items;
    expect(rows.some((m: { role: string }) => m.role === "user")).toBe(true);
    expect(rows.some((m: { role: string; status: string }) => m.role === "assistant" && m.status === "completed")).toBe(true);
  });
});
