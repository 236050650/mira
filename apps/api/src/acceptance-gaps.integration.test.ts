import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ErrorCodes } from "@mira/contracts";
import type {
  ChatChunk,
  ChatRequest,
  HealthResult,
  ModelDescriptor,
  ModelProvider,
  ProviderId,
} from "@mira/model-gateway";
import { buildApp, type BuiltApp } from "./main.js";

class TrackingProvider implements ModelProvider {
  calls = 0;

  constructor(
    readonly id: ProviderId,
    private readonly failureCode?: string,
  ) {}

  async healthCheck(): Promise<HealthResult> {
    return { ok: !this.failureCode, detail: this.failureCode ? "unavailable" : "ready" };
  }

  async listModels(): Promise<ModelDescriptor[]> {
    return [];
  }

  async *streamChat(_request: ChatRequest): AsyncIterable<ChatChunk> {
    this.calls += 1;
    if (this.failureCode) {
      yield {
        type: "error",
        error: { code: this.failureCode, message: "本地模型不可用，请检查 Ollama 服务" },
      };
      return;
    }
    yield { type: "content", delta: "本地模型回复" };
    yield {
      type: "usage",
      usage: { inputTokens: 8, outputTokens: 4, totalTokens: 12 },
    };
    yield { type: "done", finishReason: "stop" };
  }
}

async function registerUser(built: BuiltApp) {
  const response = await built.app.inject({
    method: "POST",
    url: "/v1/auth/register",
    payload: {
      email: `acceptance-${randomUUID()}@example.com`,
      nickname: "验收用户",
      password: "Passw0rd1",
    },
  });
  expect(response.statusCode).toBe(201);
  return response.json().accessToken as string;
}

async function seededPersonaId(built: BuiltApp, accessToken: string) {
  const response = await built.app.inject({
    method: "GET",
    url: "/v1/personas?limit=1",
    headers: { authorization: `Bearer ${accessToken}` },
  });
  return response.json().items[0].id as string;
}

async function createConversation(
  built: BuiltApp,
  accessToken: string,
  personaId: string,
) {
  const response = await built.app.inject({
    method: "POST",
    url: "/v1/conversations",
    headers: { authorization: `Bearer ${accessToken}` },
    payload: { personaId },
  });
  expect(response.statusCode).toBe(201);
  return response.json().conversation.id as string;
}

describe("final acceptance gaps", () => {
  let built: BuiltApp;
  let accessToken = "";

  beforeAll(async () => {
    built = await buildApp({
      migrate: true,
      seed: true,
      env: {
        ...process.env,
        USE_PGLITE: "true",
        DATABASE_URL: "",
        MODEL_MODE: "remote",
        LOG_LEVEL: "error",
        LOGIN_RATE_LIMIT_MAX: "2",
        CHAT_RATE_LIMIT_MAX: "20",
        RATE_LIMIT_WINDOW_MS: "60000",
        MODEL_DAILY_REMOTE_TOKEN_BUDGET: "10",
      },
    });
    await built.app.ready();
    accessToken = await registerUser(built);
  }, 120_000);

  afterAll(async () => {
    await built?.app.close();
  });

  it("creates, uploads, publishes, reopens and chats with a custom persona", async () => {
    const avatar =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z7uAAAAAASUVORK5CYII=";
    const created = await built.app.inject({
      method: "POST",
      url: "/v1/personas",
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        name: "月见",
        subtitle: "月海列车的神秘乘务员",
        bio: "温柔而清醒，擅长陪伴旅客梳理困惑。",
        tags: ["温柔", "神秘"],
        greeting: "欢迎上车，今晚想去哪里？",
        suggestedReplies: ["你来自哪里？", "陪我聊聊", "看看月海"],
        systemPrompt: "你是月见。保持温柔、清醒，不捏造未知事实，并记住用户偏好。",
        avatarUrl: avatar,
        category: "原创角色",
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().persona.avatarUrl).toBe(avatar);
    const personaId = created.json().persona.id as string;

    const publish = await built.app.inject({
      method: "POST",
      url: `/v1/personas/${personaId}/publish`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {},
    });
    expect(publish.statusCode).toBe(200);

    const reopened = await built.app.inject({
      method: "GET",
      url: `/v1/personas/${personaId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(reopened.statusCode).toBe(200);
    expect(reopened.json().persona.name).toBe("月见");
    expect(reopened.json().persona.version.greeting).toContain("欢迎上车");

    const conversationId = await createConversation(built, accessToken, personaId);
    const local = new TrackingProvider("ollama");
    built.gateway.setProvider("ollama", local);
    const stream = await built.app.inject({
      method: "POST",
      url: `/v1/conversations/${conversationId}/messages/stream`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        clientMessageId: randomUUID(),
        content: "记住我喜欢雨夜。",
        modelProfileId: "ollama-local",
      },
    });
    expect(stream.statusCode).toBe(200);
    expect(stream.body).toContain("message.completed");
    expect(local.calls).toBe(1);
  });

  it("returns stable 429 responses for repeated login attempts", async () => {
    const payload = { email: "rate-limit@example.com", password: "wrong-password" };
    const first = await built.app.inject({ method: "POST", url: "/v1/auth/login", payload });
    const second = await built.app.inject({ method: "POST", url: "/v1/auth/login", payload });
    const limited = await built.app.inject({ method: "POST", url: "/v1/auth/login", payload });
    expect(first.statusCode).toBe(401);
    expect(second.statusCode).toBe(401);
    expect(limited.statusCode).toBe(429);
    expect(limited.json().error.code).toBe("RATE_LIMITED");
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("rejects remote generation after budget while keeping local generation available", async () => {
    const personaId = await seededPersonaId(built, accessToken);
    const conversationId = await createConversation(built, accessToken, personaId);
    const deepseek = new TrackingProvider("deepseek");
    const ollama = new TrackingProvider("ollama");
    built.gateway.setProvider("deepseek", deepseek);
    built.gateway.setProvider("ollama", ollama);
    built.gateway.addRemoteUsage(10);

    const remote = await built.app.inject({
      method: "POST",
      url: `/v1/conversations/${conversationId}/messages/stream`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        clientMessageId: randomUUID(),
        content: "远程请求",
        modelProfileId: "deepseek-flash",
      },
    });
    expect(remote.statusCode).toBe(200);
    expect(remote.body).toContain(ErrorCodes.MODEL_BUDGET_EXCEEDED);
    expect(deepseek.calls).toBe(0);

    const local = await built.app.inject({
      method: "POST",
      url: `/v1/conversations/${conversationId}/messages/stream`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        clientMessageId: randomUUID(),
        content: "改用本地",
        modelProfileId: "ollama-local",
      },
    });
    expect(local.body).toContain("message.completed");
    expect(ollama.calls).toBe(1);
  });

  it("reports Ollama outage and never falls back to DeepSeek", async () => {
    const personaId = await seededPersonaId(built, accessToken);
    const conversationId = await createConversation(built, accessToken, personaId);
    const ollama = new TrackingProvider("ollama", ErrorCodes.MODEL_UNAVAILABLE);
    const deepseek = new TrackingProvider("deepseek");
    built.gateway.setProvider("ollama", ollama);
    built.gateway.setProvider("deepseek", deepseek);

    const response = await built.app.inject({
      method: "POST",
      url: `/v1/conversations/${conversationId}/messages/stream`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        clientMessageId: randomUUID(),
        content: "测试本地离线",
        modelProfileId: "ollama-local",
      },
    });
    expect(response.body).toContain(ErrorCodes.MODEL_UNAVAILABLE);
    expect(response.body).toContain("本地模型不可用");
    expect(ollama.calls).toBe(1);
    expect(deepseek.calls).toBe(0);
  });
});

describe("chat endpoint rate limit", () => {
  let built: BuiltApp;

  beforeAll(async () => {
    built = await buildApp({
      migrate: true,
      seed: true,
      env: {
        ...process.env,
        USE_PGLITE: "true",
        DATABASE_URL: "",
        MODEL_MODE: "mock",
        LOG_LEVEL: "error",
        LOGIN_RATE_LIMIT_MAX: "20",
        CHAT_RATE_LIMIT_MAX: "1",
        RATE_LIMIT_WINDOW_MS: "60000",
      },
    });
    await built.app.ready();
  }, 120_000);

  afterAll(async () => {
    await built?.app.close();
  });

  it("returns 429 before starting a second chat stream", async () => {
    const token = await registerUser(built);
    const personaId = await seededPersonaId(built, token);
    const conversationId = await createConversation(built, token, personaId);
    const send = () =>
      built.app.inject({
        method: "POST",
        url: `/v1/conversations/${conversationId}/messages/stream`,
        headers: { authorization: `Bearer ${token}` },
        payload: { clientMessageId: randomUUID(), content: "你好" },
      });

    expect((await send()).statusCode).toBe(200);
    const limited = await send();
    expect(limited.statusCode).toBe(429);
    expect(limited.json().error.code).toBe("RATE_LIMITED");
  });
});
