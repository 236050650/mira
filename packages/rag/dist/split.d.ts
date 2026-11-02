export type KnowledgePiece = {
    sourceId: string;
    content: string;
    kind: "knowledge" | "boundary";
};
export declare function splitPersonaKnowledge(input: {
    versionId: string;
    knowledge: string;
    knowledgeBoundary: Record<string, unknown>;
}): Promise<KnowledgePiece[]>;
//# sourceMappingURL=split.d.ts.map