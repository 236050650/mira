import type { Embeddings } from "@langchain/core/embeddings";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";

export type RetrievalScope = "persona" | "memory" | "message";

export type RetrievalChunk = {
  scope: RetrievalScope;
  personaId: string;
  userId?: string | null;
  conversationId?: string | null;
  sourceId: string;
  content: string;
  embedding: number[];
  category?: string;
  kind?: "knowledge" | "boundary";
};

export type RetrievalBudgets = {
  knowledge: number;
  memories: number;
  history: number;
};

export type RetrievedMemory = {
  sourceId: string;
  category: string;
  content: string;
};

export type RetrievedSnippet = {
  sourceId: string;
  content: string;
};

export type PersonaRetrieval = {
  knowledge: string[];
  memories: RetrievedMemory[];
  history: RetrievedSnippet[];
};

function defaultEstimate(text: string): number {
  const cjk = text.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const rest = text.length - cjk;
  return Math.max(1, Math.ceil(cjk * 1.2 + rest / 4));
}

export function takeWithinBudget(
  items: string[],
  tokenBudget: number,
  estimateTokens: (text: string) => number = defaultEstimate,
): string[] {
  if (tokenBudget <= 0) return [];
  const selected: string[] = [];
  let used = 0;
  for (const item of items) {
    const cost = estimateTokens(item);
    if (selected.length > 0 && used + cost > tokenBudget) break;
    if (cost > tokenBudget) {
      const sliced = item.slice(0, Math.max(20, tokenBudget * 2));
      selected.push(sliced);
      break;
    }
    selected.push(item);
    used += cost;
  }
  return selected;
}

async function rankChunks(
  embeddings: Embeddings,
  chunks: RetrievalChunk[],
  query: string,
  k: number,
): Promise<RetrievalChunk[]> {
  if (chunks.length === 0 || k <= 0) return [];
  const store = new MemoryVectorStore(embeddings);
  await store.addVectors(
    chunks.map((chunk) => chunk.embedding),
    chunks.map((chunk) => ({
      pageContent: chunk.content,
      metadata: { sourceId: chunk.sourceId },
    })),
  );
  const found = await store.similaritySearch(query, Math.min(k, chunks.length));
  const byId = new Map(chunks.map((chunk) => [chunk.sourceId, chunk]));
  return found.flatMap((doc) => {
    const sourceId = String(doc.metadata.sourceId ?? "");
    const chunk = byId.get(sourceId);
    return chunk ? [chunk] : [];
  });
}

function dedupe(chunks: RetrievalChunk[]): RetrievalChunk[] {
  const seen = new Set<string>();
  const ordered: RetrievalChunk[] = [];
  for (const chunk of chunks) {
    if (seen.has(chunk.sourceId)) continue;
    seen.add(chunk.sourceId);
    ordered.push(chunk);
  }
  return ordered;
}

function takeChunks(
  chunks: RetrievalChunk[],
  tokenBudget: number,
  estimateTokens: (text: string) => number,
): RetrievalChunk[] {
  const selected: RetrievalChunk[] = [];
  let used = 0;
  for (const chunk of chunks) {
    const cost = estimateTokens(chunk.content);
    if (selected.length > 0 && used + cost > tokenBudget) break;
    if (cost > tokenBudget) {
      selected.push({ ...chunk, content: chunk.content.slice(0, Math.max(20, tokenBudget * 2)) });
      break;
    }
    selected.push(chunk);
    used += cost;
  }
  return selected;
}

export async function retrievePersonaContext(input: {
  embeddings: Embeddings;
  query: string;
  personaId: string;
  userId: string;
  conversationId: string;
  chunks: RetrievalChunk[];
  excludeSourceIds?: string[];
  budgets: RetrievalBudgets;
  estimateTokens?: (text: string) => number;
}): Promise<PersonaRetrieval> {
  const estimate = input.estimateTokens ?? defaultEstimate;
  const excluded = new Set(input.excludeSourceIds ?? []);
  const knowledgeChunks = input.chunks.filter(
    (chunk) => chunk.scope === "persona" && chunk.personaId === input.personaId,
  );
  const memoryChunks = input.chunks.filter(
    (chunk) =>
      chunk.scope === "memory" &&
      chunk.personaId === input.personaId &&
      chunk.userId === input.userId,
  );
  const historyChunks = input.chunks.filter(
    (chunk) =>
      chunk.scope === "message" &&
      chunk.conversationId === input.conversationId &&
      !excluded.has(chunk.sourceId),
  );

  const [rankedKnowledge, rankedMemories, rankedHistory] = await Promise.all([
    rankChunks(input.embeddings, knowledgeChunks, input.query, 8),
    rankChunks(input.embeddings, memoryChunks, input.query, 5),
    rankChunks(input.embeddings, historyChunks, input.query, 4),
  ]);

  const boundary = knowledgeChunks.filter((chunk) => chunk.kind === "boundary");
  const knowledge = takeChunks(dedupe([...boundary, ...rankedKnowledge]), input.budgets.knowledge, estimate).map(
    (chunk) => chunk.content,
  );
  const memories = takeChunks(rankedMemories, input.budgets.memories, estimate).map((chunk) => ({
    sourceId: chunk.sourceId,
    category: chunk.category || "memory",
    content: chunk.content,
  }));
  const history = takeChunks(rankedHistory, input.budgets.history, estimate).map((chunk) => ({
    sourceId: chunk.sourceId,
    content: chunk.content,
  }));

  return { knowledge, memories, history };
}
