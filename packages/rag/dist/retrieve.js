import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { estimateTokens } from "@mira/domain";
export function takeWithinBudget(items, tokenBudget) {
    if (tokenBudget <= 0)
        return [];
    const selected = [];
    let used = 0;
    for (const item of items) {
        const cost = estimateTokens(item);
        if (selected.length > 0 && used + cost > tokenBudget)
            break;
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
async function rankChunks(embeddings, chunks, query, k) {
    if (chunks.length === 0 || k <= 0)
        return [];
    const store = new MemoryVectorStore(embeddings);
    await store.addVectors(chunks.map((chunk) => chunk.embedding), chunks.map((chunk) => ({
        pageContent: chunk.content,
        metadata: { sourceId: chunk.sourceId },
    })));
    const found = await store.similaritySearch(query, Math.min(k, chunks.length));
    const byId = new Map(chunks.map((chunk) => [chunk.sourceId, chunk]));
    return found.flatMap((doc) => {
        const sourceId = String(doc.metadata.sourceId ?? "");
        const chunk = byId.get(sourceId);
        return chunk ? [chunk] : [];
    });
}
async function rankChunksWithVector(embeddings, chunks, queryVector, k) {
    if (chunks.length === 0 || k <= 0)
        return [];
    const store = new MemoryVectorStore(embeddings);
    await store.addVectors(chunks.map((chunk) => chunk.embedding), chunks.map((chunk) => ({
        pageContent: chunk.content,
        metadata: { sourceId: chunk.sourceId },
    })));
    const found = await store.similaritySearchVectorWithScore(queryVector, Math.min(k, chunks.length));
    const byId = new Map(chunks.map((chunk) => [chunk.sourceId, chunk]));
    return found.flatMap(([doc]) => {
        const sourceId = String(doc.metadata.sourceId ?? "");
        const chunk = byId.get(sourceId);
        return chunk ? [chunk] : [];
    });
}
function dedupe(chunks) {
    const seen = new Set();
    const ordered = [];
    for (const chunk of chunks) {
        if (seen.has(chunk.sourceId))
            continue;
        seen.add(chunk.sourceId);
        ordered.push(chunk);
    }
    return ordered;
}
function takeChunks(chunks, tokenBudget, estimateTokens) {
    const selected = [];
    let used = 0;
    for (const chunk of chunks) {
        const cost = estimateTokens(chunk.content);
        if (selected.length > 0 && used + cost > tokenBudget)
            break;
        if (cost > tokenBudget) {
            selected.push({ ...chunk, content: chunk.content.slice(0, Math.max(20, tokenBudget * 2)) });
            break;
        }
        selected.push(chunk);
        used += cost;
    }
    return selected;
}
export async function retrievePersonaContext(input) {
    const estimate = input.estimateTokens ?? estimateTokens;
    const excluded = new Set(input.excludeSourceIds ?? []);
    const knowledgeChunks = input.chunks.filter((chunk) => chunk.scope === "persona" && chunk.personaId === input.personaId);
    const memoryChunks = input.chunks.filter((chunk) => chunk.scope === "memory" &&
        chunk.personaId === input.personaId &&
        chunk.userId === input.userId);
    const historyChunks = input.chunks.filter((chunk) => chunk.scope === "message" &&
        chunk.conversationId === input.conversationId &&
        !excluded.has(chunk.sourceId));
    const queryVector = await input.embeddings.embedQuery(input.query);
    const [rankedKnowledge, rankedMemories, rankedHistory] = await Promise.all([
        rankChunksWithVector(input.embeddings, knowledgeChunks, queryVector, 8),
        rankChunksWithVector(input.embeddings, memoryChunks, queryVector, 5),
        rankChunksWithVector(input.embeddings, historyChunks, queryVector, 4),
    ]);
    const boundary = knowledgeChunks.filter((chunk) => chunk.kind === "boundary");
    const knowledge = takeChunks(dedupe([...boundary, ...rankedKnowledge]), input.budgets.knowledge, estimate).map((chunk) => chunk.content);
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
//# sourceMappingURL=retrieve.js.map