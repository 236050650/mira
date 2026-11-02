import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ChatChunk, ChatRequest, ModelProvider } from "@mira/model-gateway";
import { buildApp, type BuiltApp } from "./main.js";

class RecordingProvider implements ModelProvider {
  readonly id = "ollama" as const;
  requests: ChatRequest[] = [];
  async healthCheck() { return { ok: true }; }
  async listModels() { return []; }
  async *streamChat(request: ChatRequest): AsyncIterable<ChatChunk> {
    this.requests.push(request);
    for (const delta of ["你好", "，", "这是", "完整回复"]) {
      await delay(20);
      if (request.signal?.aborted) return;
      yield { type: "content", delta };
    }
    yield { type: "usage", usage: { inputTokens: 8, outputTokens: 4, totalTokens: 12 } };
    yield { type: "done", finishReason: "stop" };
  }
}

describe("chat over real HTTP", () => {
  let built: BuiltApp;
  let base: string;
  let token: string;
  let conversationId: string;
  const provider = new RecordingProvider();
  const origin = "http://localhost:3000";

  beforeAll(async () => {
    built = await buildApp({ env: {
      ...process.env, USE_PGLITE: "true", DATABASE_URL: "", MODEL_MODE: "local",
      OLLAMA_DEFAULT_MODEL: "local-routing-test", CORS_ORIGINS: origin,
    } });
    built.gateway.setProvider("ollama", provider);
    base = await built.app.listen({ port: 0, host: "127.0.0.1" });
    const reg = await built.app.inject({ method: "POST", url: "/v1/auth/register", payload: {
      email: `http-${randomUUID()}@example.com`, nickname: "HTTP测试", password: "Passw0rd1",
    } });
    expect(reg.statusCode).toBe(201);
    token = reg.json().accessToken;
    const personas = await built.app.inject({ url: "/v1/personas", headers: { authorization: `Bearer ${token}` } });
    const created = await built.app.inject({ method: "POST", url: "/v1/conversations",
      headers: { authorization: `Bearer ${token}` }, payload: { personaId: personas.json().items[0].id },
    });
    expect(created.json().conversation.preferredModelProfileId).toBe("ollama-local");
    conversationId = created.json().conversation.id;
  });

  afterAll(async () => { await built?.app.close(); });

  function post(path: string, body: unknown) {
    return fetch(`${base}${path}`, { method: "POST", headers: {
      authorization: `Bearer ${token}`, "content-type": "application/json", origin,
    }, body: JSON.stringify(body) });
  }

  async function savedMessages() {
    const response = await built.app.inject({ url: `/v1/conversations/${conversationId}/messages`,
      headers: { authorization: `Bearer ${token}` },
    });
    return response.json().items as Array<{ id: string; role: string; content: string; status: string; provider: string; model: string }>;
  }

  it("keeps SSE alive after the request body ends, preserves CORS, and replays a completed retry", async () => {
    const path = `/v1/conversations/${conversationId}/messages/stream`;
    const body = { clientMessageId: randomUUID(), content: "你好", modelProfileId: "deepseek-pro" };
    const res = await post(path, body);
    expect(res.headers.get("access-control-allow-origin")).toBe(origin);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain("完整回复");
    expect(text).toContain('"finishReason":"stop"');
    expect(provider.requests[0]?.model).toBe("local-routing-test");
    const messages = await savedMessages();
    expect(messages.at(-1)).toMatchObject({ content: "你好，这是完整回复", status: "completed",
      provider: "ollama", model: "local-routing-test" });
    const count = provider.requests.length;
    const retry = await post(path, body);
    expect(await retry.text()).toContain("你好，这是完整回复");
    expect(provider.requests).toHaveLength(count);
    expect(await savedMessages()).toHaveLength(messages.length);
  });

  it("regenerates over HTTP without duplicating the user turn", async () => {
    const before = await savedMessages();
    const response = await post(`/v1/conversations/${conversationId}/messages/${before.at(-1)!.id}/regenerate`, {});
    expect(response.headers.get("access-control-allow-origin")).toBe(origin);
    expect(await response.text()).toContain('"finishReason":"stop"');
    expect(await savedMessages()).toHaveLength(before.length);
    expect(provider.requests.at(-1)?.messages.filter(m => m.role === "user" && m.content === "你好")).toHaveLength(1);
  });

  it("reports the effective model in status and connection checks", async () => {
    const status = await built.app.inject({ url: "/v1/models/status", headers: { authorization: `Bearer ${token}` } });
    for (const profile of status.json().profiles) {
      expect(profile).toMatchObject({ provider: "ollama", model: "local-routing-test", available: true });
    }
    const result = await post("/v1/models/test", { profileId: "auto" });
    expect(await result.json()).toMatchObject({ provider: "ollama", model: "local-routing-test" });
  });

  async function startAndReadFirstDelta(signal?: AbortSignal) {
    const response = await fetch(`${base}/v1/conversations/${conversationId}/messages/stream`, {
      method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", origin },
      body: JSON.stringify({ clientMessageId: randomUUID(), content: "慢慢回答" }), signal,
    });
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let text = "";
    while (!text.includes("event: message.delta")) {
      const chunk = await reader.read();
      if (chunk.done) throw new Error("Stream ended before first delta");
      text += decoder.decode(chunk.value, { stream: true });
    }
    const acceptedBlock = text.split("\n\n").find(block => block.includes("event: message.accepted"))!;
    const accepted = JSON.parse(acceptedBlock.split("data: ")[1]!) as { generationId: string; assistantMessageId: string };
    return { reader, decoder, text, accepted };
  }

  it("stops over HTTP and persists the partial reply", async () => {
    const stream = await startAndReadFirstDelta();
    const stopped = await post(`/v1/conversations/${conversationId}/generations/${stream.accepted.generationId}/stop`, {});
    expect(stopped.status).toBe(200);
    let text = stream.text;
    while (true) {
      const chunk = await stream.reader.read();
      if (chunk.done) break;
      text += stream.decoder.decode(chunk.value, { stream: true });
    }
    expect(text).toContain('"finishReason":"interrupted"');
    const message = (await savedMessages()).find(m => m.id === stream.accepted.assistantMessageId)!;
    expect(message.status).toBe("interrupted");
    expect(message.content.length).toBeGreaterThan(0);
    expect(message.content).not.toBe("你好，这是完整回复");
  });

  it("cancels model work when the HTTP client disconnects", async () => {
    const controller = new AbortController();
    const stream = await startAndReadFirstDelta(controller.signal);
    controller.abort();
    await stream.reader.cancel().catch(() => undefined);
    await expect.poll(() => provider.requests.at(-1)?.signal?.aborted).toBe(true);
    await expect.poll(async () => (await savedMessages())
      .find(m => m.id === stream.accepted.assistantMessageId)?.status).toBe("interrupted");
  });
});
