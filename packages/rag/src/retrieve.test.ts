import { describe, expect, it } from "vitest";
import { HASH_EMBEDDING_MODEL, HashEmbeddings, resolveEmbeddings } from "./embeddings.js";
import { retrievePersonaContext } from "./retrieve.js";
import { splitPersonaKnowledge } from "./split.js";

describe("persona retrieval", () => {
  it("returns the matching knowledge chunk and hides other personas", async () => {
    const embeddings = new HashEmbeddings();
    const cavalry = "霍去病率领骑兵奔袭河西，以快打慢，不问宅第。";
    const brew = "酿酒使用小麦与酒曲，封存于潮湿地窖，与战事无关。";
    const other = "河西骑兵是另一个人的军事笔记，不应被检索。";
    const [cavalryVector, brewVector, otherVector] = await embeddings.embedDocuments([
      cavalry,
      brew,
      other,
    ]);
    const result = await retrievePersonaContext({
      embeddings,
      query: "河西的骑兵怎么打？",
      personaId: "huo",
      userId: "user-1",
      conversationId: "conv-1",
      budgets: { knowledge: 30, memories: 20, history: 20 },
      estimateTokens: (text) => text.length,
      chunks: [
        {
          scope: "persona",
          personaId: "huo",
          sourceId: "huo#k0",
          content: cavalry,
          embedding: cavalryVector ?? [],
          kind: "knowledge",
        },
        {
          scope: "persona",
          personaId: "huo",
          sourceId: "huo#k1",
          content: brew,
          embedding: brewVector ?? [],
          kind: "knowledge",
        },
        {
          scope: "persona",
          personaId: "other",
          sourceId: "other#k0",
          content: other,
          embedding: otherVector ?? [],
          kind: "knowledge",
        },
      ],
    });

    expect(result.knowledge.join("\n")).toContain("骑兵");
    expect(result.knowledge.join("\n")).not.toContain("酒曲");
    expect(result.knowledge.join("\n")).not.toContain("另一个人");
  });

  it("drops recent chit-chat and still retrieves an earlier preference", async () => {
    const embeddings = new HashEmbeddings();
    const preference = "用户：请记住我不喝咖啡，更喜欢乌龙茶。";
    const chatter = "用户：今天天气还行，随便闲聊填充甲乙丙丁。";
    const [preferenceVector, chatterVector] = await embeddings.embedDocuments([
      preference,
      chatter,
    ]);
    const result = await retrievePersonaContext({
      embeddings,
      query: "我更喜欢喝什么？",
      personaId: "confucius",
      userId: "user-1",
      conversationId: "conv-1",
      excludeSourceIds: ["recent-chatter"],
      budgets: { knowledge: 10, memories: 80, history: 80 },
      estimateTokens: (text) => text.length,
      chunks: [
        {
          scope: "message",
          personaId: "confucius",
          userId: "user-1",
          conversationId: "conv-1",
          sourceId: "early-preference",
          content: preference,
          embedding: preferenceVector ?? [],
        },
        {
          scope: "message",
          personaId: "confucius",
          userId: "user-1",
          conversationId: "conv-1",
          sourceId: "recent-chatter",
          content: chatter,
          embedding: chatterVector ?? [],
        },
        {
          scope: "memory",
          personaId: "confucius",
          userId: "user-1",
          sourceId: "memory-1",
          category: "preference",
          content: "我不喝咖啡，更喜欢乌龙茶。",
          embedding: (await embeddings.embedQuery("我不喝咖啡，更喜欢乌龙茶。")),
        },
      ],
    });

    expect(result.history.map((item) => item.sourceId)).toEqual(["early-preference"]);
    expect(result.history[0]?.content).toContain("乌龙茶");
    expect(result.memories.some((item) => item.content.includes("乌龙茶"))).toBe(true);
    expect(result.history.some((item) => item.content.includes("闲聊填充"))).toBe(false);
  });
});

describe("knowledge splitting", () => {
  it("splits long Chinese knowledge on sentence boundaries and keeps the boundary chunk", async () => {
    const sentence = "河西骑兵以迅速奔袭取胜，不在后方修建宅第。";
    const pieces = await splitPersonaKnowledge({
      versionId: "ver-1",
      knowledge: sentence.repeat(20),
      knowledgeBoundary: { 不确定: "宅第传闻没有同时代记载" },
    });
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.some((piece) => piece.kind === "boundary" && piece.content.includes("宅第传闻"))).toBe(
      true,
    );
    expect(pieces.every((piece) => !piece.content.includes("sourceNotes"))).toBe(true);
  });
});

describe("resolveEmbeddings", () => {
  it("uses hash embeddings in mock mode", async () => {
    const resolved = await resolveEmbeddings({
      mode: "mock",
      ollamaBaseUrl: "http://127.0.0.1:11434/v1",
    });
    expect(resolved.modelId).toBe(HASH_EMBEDDING_MODEL);
    const vector = await resolved.embeddings.embedQuery("乌龙茶");
    expect(vector).toHaveLength(512);
  });

  it("falls back when the embedding server is unreachable", async () => {
    const resolved = await resolveEmbeddings({
      mode: "local",
      ollamaBaseUrl: "http://127.0.0.1:1/v1",
      timeoutMs: 300,
    });
    expect(resolved.modelId).toBe(HASH_EMBEDDING_MODEL);
  });
});
