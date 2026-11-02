import { createHash } from "node:crypto";
import { Embeddings } from "@langchain/core/embeddings";
export const HASH_EMBEDDING_MODEL = "mira-hash-v1";
export const DEFAULT_OLLAMA_EMBED_MODEL = "bge-m3";
const DIM = 512;
function fnv(token, seed) {
    let hash = seed;
    for (let i = 0; i < token.length; i += 1) {
        hash ^= token.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}
export function tokenize(text) {
    const tokens = [];
    const cjk = text.match(/[\u4e00-\u9fff]/g) ?? [];
    for (const char of cjk)
        tokens.push(char);
    for (let i = 0; i < cjk.length - 1; i += 1) {
        const pair = `${cjk[i] ?? ""}${cjk[i + 1] ?? ""}`;
        if (pair)
            tokens.push(pair);
    }
    const words = text.toLowerCase().match(/[a-z0-9_]+/g) ?? [];
    tokens.push(...words);
    return tokens.length > 0 ? tokens : ["empty"];
}
export function hashEmbed(text) {
    const vector = new Array(DIM).fill(0);
    for (const token of tokenize(text)) {
        const weight = token.length > 1 ? 4 : 1;
        const index = fnv(token, 2166136261) % DIM;
        const sign = (fnv(token, 16777619) & 1) === 0 ? 1 : -1;
        vector[index] = (vector[index] ?? 0) + sign * weight;
    }
    let norm = 0;
    for (const value of vector)
        norm += value * value;
    const scale = Math.sqrt(norm) || 1;
    return vector.map((value) => value / scale);
}
/** Deterministic bag-of-ngram embeddings for mock mode and offline tests. */
export class HashEmbeddings extends Embeddings {
    constructor() {
        super({});
    }
    embedDocuments(documents) {
        return Promise.resolve(documents.map((document) => hashEmbed(document)));
    }
    embedQuery(document) {
        return Promise.resolve(hashEmbed(document));
    }
}
export function contentHash(text) {
    return createHash("sha256").update(text).digest("hex");
}
export function ollamaNativeBaseUrl(openaiCompatUrl) {
    return openaiCompatUrl.replace(/\/v1\/?$/, "");
}
function withTimeout(work, timeoutMs) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("embedding timeout")), timeoutMs);
    });
    return Promise.race([work, timeout]).finally(() => {
        if (timer)
            clearTimeout(timer);
    });
}
export async function resolveEmbeddings(options) {
    if (options.mode === "mock") {
        return { embeddings: new HashEmbeddings(), modelId: HASH_EMBEDDING_MODEL };
    }
    const modelId = options.embedModel?.trim() || DEFAULT_OLLAMA_EMBED_MODEL;
    try {
        const { OllamaEmbeddings } = await import("@langchain/ollama");
        const embeddings = new OllamaEmbeddings({
            model: modelId,
            baseUrl: ollamaNativeBaseUrl(options.ollamaBaseUrl),
        });
        await withTimeout(embeddings.embedQuery("ping"), options.timeoutMs ?? 4000);
        console.log(`[Embeddings] Using Ollama model: ${modelId}`);
        return { embeddings, modelId };
    }
    catch (error) {
        console.warn(`[Embeddings] Ollama unavailable, falling back to hash: ${error}`);
        return { embeddings: new HashEmbeddings(), modelId: HASH_EMBEDDING_MODEL };
    }
}
export async function checkEmbeddingHealth(ollamaBaseUrl) {
    try {
        const response = await fetch(`${ollamaNativeBaseUrl(ollamaBaseUrl)}/api/tags`, {
            signal: AbortSignal.timeout(2000),
        });
        if (!response.ok) {
            return { available: false, model: null };
        }
        const data = await response.json();
        const hasBgeM3 = data.models?.some((m) => m.name.includes("bge-m3")) ?? false;
        return {
            available: true,
            model: hasBgeM3 ? DEFAULT_OLLAMA_EMBED_MODEL : data.models?.[0]?.name ?? null
        };
    }
    catch {
        return { available: false, model: null };
    }
}
//# sourceMappingURL=embeddings.js.map