import { Embeddings } from "@langchain/core/embeddings";
export declare const HASH_EMBEDDING_MODEL = "mira-hash-v1";
export declare const DEFAULT_OLLAMA_EMBED_MODEL = "bge-m3";
export declare function tokenize(text: string): string[];
export declare function hashEmbed(text: string): number[];
/** Deterministic bag-of-ngram embeddings for mock mode and offline tests. */
export declare class HashEmbeddings extends Embeddings {
    constructor();
    embedDocuments(documents: string[]): Promise<number[][]>;
    embedQuery(document: string): Promise<number[]>;
}
export declare function contentHash(text: string): string;
export declare function ollamaNativeBaseUrl(openaiCompatUrl: string): string;
export declare function resolveEmbeddings(options: {
    mode: "mock" | "local" | "remote";
    ollamaBaseUrl: string;
    embedModel?: string;
    timeoutMs?: number;
}): Promise<{
    embeddings: Embeddings;
    modelId: string;
}>;
export declare function checkEmbeddingHealth(ollamaBaseUrl: string): Promise<{
    available: boolean;
    model: string | null;
}>;
//# sourceMappingURL=embeddings.d.ts.map