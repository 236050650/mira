export type ContextBudget = {
    totalTokens: number;
    platformAndPersona: number;
    memories: number;
    summary: number;
    recentMessages: number;
    currentAndSafety: number;
};
export declare function allocateContextBudget(totalTokens?: number): ContextBudget;
/** Rough CJK-aware token estimate. */
export declare function estimateTokens(text: string): number;
export type ChatTurn = {
    role: "user" | "assistant" | "system";
    content: string;
};
export declare function selectRecentMessages(messages: ChatTurn[], tokenBudget: number, keepMinTurns?: number): ChatTurn[];
export declare function shouldSummarize(turnCount: number, threshold?: number): boolean;
export type MemoryCandidate = {
    category: string;
    content: string;
    confidence: number;
};
export declare function extractMemoryCandidates(userText: string): MemoryCandidate[];
export declare const RELATIONSHIP_LEVELS: readonly ["初见", "熟悉", "信赖", "默契"];
export type RelationshipLevel = (typeof RELATIONSHIP_LEVELS)[number];
export declare function advanceRelationship(level: number, events: {
    messageCount: number;
}): number;
//# sourceMappingURL=context.d.ts.map