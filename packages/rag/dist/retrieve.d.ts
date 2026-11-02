import type { Embeddings } from "@langchain/core/embeddings";
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
export declare function takeWithinBudget(items: string[], tokenBudget: number): string[];
export declare function retrievePersonaContext(input: {
    embeddings: Embeddings;
    query: string;
    personaId: string;
    userId: string;
    conversationId: string;
    chunks: RetrievalChunk[];
    excludeSourceIds?: string[];
    budgets: RetrievalBudgets;
    estimateTokens?: (text: string) => number;
}): Promise<PersonaRetrieval>;
//# sourceMappingURL=retrieve.d.ts.map