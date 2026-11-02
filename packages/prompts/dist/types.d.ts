export type PersonaExample = {
    user: string;
    assistant: string;
};
export type PersonaVersion = {
    greeting: string;
    suggestedReplies: string[];
    systemPrompt: string;
    speakingStyle: Record<string, unknown>;
    knowledgeBoundary: Record<string, unknown>;
    relationshipPreset: Record<string, unknown>;
    memoryPolicy: Record<string, unknown>;
    sourceNotes: Record<string, unknown>;
    identity: string;
    goals: string;
    voice: string;
    behavior: string;
    worldview: string;
    knowledge: string;
    examples: PersonaExample[];
    forbiddenExpressions: string[];
};
export type PersonaSeed = {
    id: string;
    name: string;
    category: string;
    subtitle: string;
    bio: string;
    tags: string[];
    avatarUrl?: string;
    coverUrl?: string;
    accent?: string;
    panel?: number;
    atlas?: "original" | "history-war" | "history-thought";
    image?: string;
    artTone?: string;
    online: boolean;
    conversations: string;
    version: PersonaVersion;
};
export type RelationshipContext = {
    level?: string;
    title?: string;
    events?: string[];
};
export type MemorySnippet = {
    category: string;
    content: string;
};
export type ComposePersonaPromptInput = {
    personaName: string;
    personaVersion: PersonaVersion;
    relationship?: RelationshipContext;
    memories?: MemorySnippet[];
    summary?: string;
    retrievedKnowledge?: string[];
    retrievedHistory?: string[];
    platformRules?: string;
};
//# sourceMappingURL=types.d.ts.map