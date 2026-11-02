import { createHash } from "node:crypto";
import { Embeddings } from "@langchain/core/embeddings";

export const HASH_EMBEDDING_MODEL = "mira-hash-v1";
export const DEFAULT_OLLAMA_EMBED_MODEL = "bge-m3";

const DIM = 512;

function fnv(token: string, seed: number): number {
  let hash = seed;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const cjk = text.match(/[\u4e00-\u9fff]/g) ?? [];
  for (const char of cjk) tokens.push(char);
  for (let i = 0; i < cjk.length - 1; i += 1) {
    const pair = `${cjk[i] ?? ""}${cjk[i + 1] ?? ""}`;
    if (pair) tokens.push(pair);
  }
  const words = text.toLowerCase().match(/[a-z0-9_]+/g) ?? [];
  tokens.push(...words);
  return tokens.length > 0 ? tokens : ["empty"];
}

export function hashEmbed(text: string): number[] {
  const vector = new Array<number>(DIM).fill(0);
  for (const token of tokenize(text)) {
    const weight = token.length > 1 ? 4 : 1;
    const index = fnv(token, 2166136261) % DIM;
    const sign = (fnv(token, 16777619) & 1) === 0 ? 1 : -1;
    vector[index] = (vector[index] ?? 0) + sign * weight;
  }
  let norm = 0;
  for (const value of vector) norm += value * value;
  const scale = Math.sqrt(norm) || 1;
  return vector.map((value) => value / scale);
}

/** Deterministic bag-of-ngram embeddings for mock mode and offline tests. */
export class HashEmbeddings extends Embeddings {
  constructor() {
    super({});
  }

  embedDocuments(documents: string[]): Promise<number[][]> {
    return Promise.resolve(documents.map((document) => hashEmbed(document)));
  }

  embedQuery(document: string): Promise<number[]> {
    return Promise.resolve(hashEmbed(document));
  }
}

export function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function ollamaNativeBaseUrl(openaiCompatUrl: string): string {
  return openaiCompatUrl.replace(/\/v1\/?$/, "");
}

function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("embedding timeout")), timeoutMs);
  });
  return Promise.race([work, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export async function resolveEmbeddings(options: {
  mode: "mock" | "local" | "remote";
  ollamaBaseUrl: string;
  embedModel?: string;
  timeoutMs?: number;
}): Promise<{ embeddings: Embeddings; modelId: string }> {
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
    return { embeddings, modelId };
  } catch {
    return { embeddings: new HashEmbeddings(), modelId: HASH_EMBEDDING_MODEL };
  }
}
