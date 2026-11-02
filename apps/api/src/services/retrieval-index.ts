import { randomUUID } from "node:crypto";
import type { Embeddings } from "@langchain/core/embeddings";
import { estimateTokens } from "@mira/domain";
import {
  contentHash,
  retrievePersonaContext,
  splitPersonaKnowledge,
  type PersonaRetrieval,
  type RetrievalChunk,
} from "@mira/rag";
import { and, eq, like } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { retrievalChunks } from "../db/schema.js";

type ChunkRow = typeof retrievalChunks.$inferSelect;

function asVector(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (!value.every((item) => typeof item === "number")) return null;
  return value;
}

function unpackMemory(packed: string): { category: string; content: string } {
  const match = packed.match(/^\[([^\]]+)\] ([\s\S]*)$/);
  if (!match?.[1] || match[2] === undefined) return { category: "memory", content: packed };
  return { category: match[1], content: match[2] };
}

function toChunk(row: ChunkRow): RetrievalChunk | null {
  const embedding = asVector(row.embedding);
  if (!embedding) return null;
  const memory = row.scope === "memory" ? unpackMemory(row.content) : null;
  return {
    scope: row.scope as RetrievalChunk["scope"],
    personaId: row.personaId,
    userId: row.userId,
    conversationId: row.conversationId,
    sourceId: row.sourceId,
    content: memory?.content ?? row.content,
    embedding,
    category: memory?.category,
    kind: row.sourceId.endsWith("#boundary") ? "boundary" : undefined,
  };
}

export class RetrievalIndex {
  constructor(
    private readonly db: Db,
    private readonly embeddings: Embeddings,
    readonly modelId: string,
  ) {}

  async ensurePersonaKnowledge(input: {
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
    for (const row of existing) {
      if (!keep.has(row.sourceId)) {
        await this.removeSource("persona", row.sourceId);
      }
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
    for (let index = 0; index < pending.length; index += 1) {
      const piece = pending[index];
      const embedding = vectors[index];
      if (!piece || !embedding) continue;
      await this.upsert({
        scope: "persona",
        personaId: input.personaId,
        userId: null,
        conversationId: null,
        sourceId: piece.sourceId,
        content: piece.content,
        embedding,
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
  }): Promise<PersonaRetrieval> {
    const [personaRows, memoryRows, messageRows] = await Promise.all([
      this.db
        .select()
        .from(retrievalChunks)
        .where(and(eq(retrievalChunks.scope, "persona"), eq(retrievalChunks.personaId, input.personaId))),
      this.db
        .select()
        .from(retrievalChunks)
        .where(
          and(
            eq(retrievalChunks.scope, "memory"),
            eq(retrievalChunks.personaId, input.personaId),
            eq(retrievalChunks.userId, input.userId),
          ),
        ),
      this.db
        .select()
        .from(retrievalChunks)
        .where(
          and(eq(retrievalChunks.scope, "message"), eq(retrievalChunks.conversationId, input.conversationId)),
        ),
    ]);

    const chunks = [...personaRows, ...memoryRows, ...messageRows].flatMap((row) => {
      if (row.embeddingModel !== this.modelId) return [];
      const chunk = toChunk(row);
      return chunk ? [chunk] : [];
    });

    return retrievePersonaContext({
      embeddings: this.embeddings,
      query: input.query,
      personaId: input.personaId,
      userId: input.userId,
      conversationId: input.conversationId,
      chunks,
      excludeSourceIds: input.excludeSourceIds,
      budgets: input.budgets,
      estimateTokens,
    });
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
        embeddingModel: this.modelId,
        contentHash: hash,
      })
      .onConflictDoUpdate({
        target: [retrievalChunks.scope, retrievalChunks.sourceId],
        set: {
          content: input.content,
          embedding: input.embedding,
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
