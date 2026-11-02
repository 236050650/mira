import { randomUUID } from "node:crypto";
import type { Embeddings } from "@langchain/core/embeddings";
import { estimateTokens } from "@mira/domain";
import {
  contentHash,
  splitPersonaKnowledge,
} from "@mira/rag";
import { and, eq, like, inArray, sql, notInArray } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { retrievalChunks } from "../db/schema.js";

type ChunkRow = typeof retrievalChunks.$inferSelect;

export type RetrievalResult = {
  knowledge: Array<{ content: string; score: number; sourceId: string }>;
  memories: Array<{ sourceId: string; category: string; content: string; score: number }>;
  history: Array<{ sourceId: string; content: string; score: number }>;
};

function asVector(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (!value.every((item) => typeof item === "number")) return null;
  return value;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

type ScoredChunk = {
  sourceId: string;
  content: string;
  score: number;
  category?: string;
};

function unpackMemory(packed: string): { category: string; content: string } {
  const match = packed.match(/^\[([^\]]+)\] ([\s\S]*)$/);
  if (!match?.[1] || match[2] === undefined) return { category: "memory", content: packed };
  return { category: match[1], content: match[2] };
}

export class RetrievalIndex {
  private personaKnowledgeCache = new Map<string, Promise<void>>();

  constructor(
    private readonly db: Db,
    private readonly embeddings: Embeddings,
    readonly modelId: string,
    private readonly minScore: number = 0.3,
  ) {}

  async ensurePersonaKnowledge(input: {
    personaId: string;
    versionId: string;
    knowledge: string;
    knowledgeBoundary: Record<string, unknown>;
  }): Promise<void> {
    const cacheKey = `${input.personaId}:${input.versionId}`;
    const cached = this.personaKnowledgeCache.get(cacheKey);
    if (cached) return cached;

    const task = this._ensurePersonaKnowledgeUncached(input);
    this.personaKnowledgeCache.set(cacheKey, task);
    return task;
  }

  private async _ensurePersonaKnowledgeUncached(input: {
    personaId: string;
    versionId: string;
    knowledge: string;
    knowledgeBoundary: Record<string, unknown>;
  }): Promise<void> {
    const pieces = await splitPersonaKnowledge({
      versionId: input.versionId,
      knowledge: input.knowledge,
      knowledgeBoundary: input.knowledgeBoundary,
    });
    const existing = await this.db
      .select()
      .from(retrievalChunks)
      .where(
        and(
          eq(retrievalChunks.scope, "persona"),
          eq(retrievalChunks.personaId, input.personaId),
          like(retrievalChunks.sourceId, `${input.versionId}#%`),
        ),
      );

    const keep = new Set(pieces.map((piece) => piece.sourceId));
    const toDelete = existing.filter((row) => !keep.has(row.sourceId));
    if (toDelete.length > 0) {
      await this.db
        .delete(retrievalChunks)
        .where(inArray(retrievalChunks.sourceId, toDelete.map((r) => r.sourceId)));
    }

    const pending = pieces.filter((piece) => {
      const hash = contentHash(piece.content);
      return !existing.some(
        (row) =>
          row.sourceId === piece.sourceId &&
          row.contentHash === hash &&
          row.embeddingModel === this.modelId,
      );
    });
    if (pending.length === 0) return;

    const vectors = await this.embeddings.embedDocuments(pending.map((piece) => piece.content));
    
    const values = pending.map((piece, index) => {
      const embedding = vectors[index];
      if (!embedding) return null;
      return {
        id: randomUUID(),
        scope: "persona" as const,
        personaId: input.personaId,
        userId: null,
        conversationId: null,
        sourceId: piece.sourceId,
        content: piece.content,
        embedding,
        embeddingVector: embedding,
        embeddingModel: this.modelId,
        contentHash: contentHash(piece.content),
      };
    }).filter((v): v is NonNullable<typeof v> => v !== null);

    if (values.length === 0) return;

    for (const value of values) {
      await this.db.insert(retrievalChunks).values({
        ...value,
        embeddingVector: value.embedding,
      }).onConflictDoUpdate({
        target: [retrievalChunks.scope, retrievalChunks.sourceId],
        set: {
          content: value.content,
          embedding: value.embedding,
          embeddingVector: value.embedding,
          embeddingModel: value.embeddingModel,
          contentHash: value.contentHash,
          personaId: value.personaId,
          updatedAt: new Date(),
        },
      });
    }
  }

  async upsertMemory(memory: {
    id: string;
    userId: string;
    personaId: string;
    conversationId: string | null;
    category: string;
    content: string;
  }): Promise<void> {
    const content = memory.content.trim();
    if (!content) return;
    const [embedding] = await this.embeddings.embedDocuments([content]);
    if (!embedding) return;
    await this.upsert({
      scope: "memory",
      personaId: memory.personaId,
      userId: memory.userId,
      conversationId: memory.conversationId,
      sourceId: memory.id,
      content: `[${memory.category}] ${content}`,
      embedding,
    });
  }

  async upsertMessage(message: {
    id: string;
    userId: string;
    personaId: string;
    conversationId: string;
    role: "user" | "assistant";
    content: string;
  }): Promise<void> {
    const text = message.content.trim();
    if (!text) return;
    const content = `${message.role === "user" ? "用户" : "角色"}：${text}`;
    const [embedding] = await this.embeddings.embedDocuments([content]);
    if (!embedding) return;
    await this.upsert({
      scope: "message",
      personaId: message.personaId,
      userId: message.userId,
      conversationId: message.conversationId,
      sourceId: message.id,
      content,
      embedding,
    });
  }

  async removeSource(scope: "persona" | "memory" | "message", sourceId: string): Promise<void> {
    await this.db
      .delete(retrievalChunks)
      .where(and(eq(retrievalChunks.scope, scope), eq(retrievalChunks.sourceId, sourceId)));
  }

  async retrieve(input: {
    query: string;
    personaId: string;
    userId: string;
    conversationId: string;
    excludeSourceIds: string[];
    budgets: { knowledge: number; memories: number; history: number };
  }): Promise<RetrievalResult> {
    const [queryVector] = await this.embeddings.embedDocuments([input.query]);
    if (!queryVector) {
      return { knowledge: [], memories: [], history: [] };
    }

    const [personaRows, memoryRows, messageRows] = await Promise.all([
      this.db
        .select()
        .from(retrievalChunks)
        .where(
          and(
            eq(retrievalChunks.scope, "persona"),
            eq(retrievalChunks.personaId, input.personaId),
            eq(retrievalChunks.embeddingModel, this.modelId),
          ),
        ),
      this.db
        .select()
        .from(retrievalChunks)
        .where(
          and(
            eq(retrievalChunks.scope, "memory"),
            eq(retrievalChunks.personaId, input.personaId),
            eq(retrievalChunks.userId, input.userId),
            eq(retrievalChunks.embeddingModel, this.modelId),
          ),
        ),
      this.db
        .select()
        .from(retrievalChunks)
        .where(
          and(
            eq(retrievalChunks.scope, "message"),
            eq(retrievalChunks.conversationId, input.conversationId),
            eq(retrievalChunks.embeddingModel, this.modelId),
            input.excludeSourceIds.length > 0
              ? notInArray(retrievalChunks.sourceId, input.excludeSourceIds)
              : undefined,
          ),
        ),
    ]);

    const knowledgeScored = this.scoreAndSort(personaRows, queryVector, 8);
    const memoryScored = this.scoreAndSort(memoryRows, queryVector, 5);
    const historyScored = this.scoreAndSort(messageRows, queryVector, 4);

    const boundaryRows = personaRows.filter((row) => row.sourceId.endsWith("#boundary"));
    const boundaryItems = boundaryRows.map((row) => ({
      content: row.content,
      score: 1.0,
      sourceId: row.sourceId,
    }));

    const knowledgeItems = knowledgeScored
      .filter((item) => item.score >= this.minScore)
      .map((item) => ({
        content: item.content,
        score: item.score,
        sourceId: item.sourceId,
      }));

    const knowledge = this.takeWithinBudget(
      [...boundaryItems, ...knowledgeItems],
      input.budgets.knowledge,
    );

    const memories = this.takeWithinBudget(
      memoryScored
        .filter((item) => item.score >= this.minScore)
        .map((item) => {
          const memory = unpackMemory(item.content);
          return {
            sourceId: item.sourceId,
            category: memory.category,
            content: memory.content,
            score: item.score,
          };
        }),
      input.budgets.memories,
    );

    const history = this.takeWithinBudget(
      historyScored
        .filter((item) => item.score >= this.minScore)
        .map((item) => ({
          sourceId: item.sourceId,
          content: item.content,
          score: item.score,
        })),
      input.budgets.history,
    );

    return { knowledge, memories, history };
  }

  private scoreAndSort(rows: ChunkRow[], queryVector: number[], limit: number): ScoredChunk[] {
    const scored = rows
      .map((row) => {
        const embedding = asVector(row.embedding);
        if (!embedding) return null;
        const score = cosineSimilarity(queryVector, embedding);
        return {
          sourceId: row.sourceId,
          content: row.content,
          score,
        };
      })
      .filter((item): item is ScoredChunk => item !== null);

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  private takeWithinBudget<T extends { content: string }>(
    items: T[],
    tokenBudget: number,
  ): T[] {
    if (tokenBudget <= 0) return [];
    const selected: T[] = [];
    let used = 0;
    for (const item of items) {
      const cost = estimateTokens(item.content);
      if (selected.length > 0 && used + cost > tokenBudget) break;
      if (cost > tokenBudget) {
        break;
      }
      selected.push(item);
      used += cost;
    }
    return selected;
  }

  private async upsert(input: {
    scope: "persona" | "memory" | "message";
    personaId: string;
    userId: string | null;
    conversationId: string | null;
    sourceId: string;
    content: string;
    embedding: number[];
  }): Promise<void> {
    const hash = contentHash(input.content);
    await this.db
      .insert(retrievalChunks)
      .values({
        id: randomUUID(),
        scope: input.scope,
        personaId: input.personaId,
        userId: input.userId,
        conversationId: input.conversationId,
        sourceId: input.sourceId,
        content: input.content,
        embedding: input.embedding,
        embeddingVector: input.embedding,
        embeddingModel: this.modelId,
        contentHash: hash,
      })
      .onConflictDoUpdate({
        target: [retrievalChunks.scope, retrievalChunks.sourceId],
        set: {
          content: input.content,
          embedding: input.embedding,
          embeddingVector: input.embedding,
          embeddingModel: this.modelId,
          contentHash: hash,
          personaId: input.personaId,
          userId: input.userId,
          conversationId: input.conversationId,
          updatedAt: new Date(),
        },
      });
  }
}
