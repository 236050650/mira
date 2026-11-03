import { type Runnable } from "@langchain/core/runnables";
import type { PersonaRetrieval } from "./retrieve.js";
export type PersonaRetrievalInput = {
    query: string;
    personaId: string;
    userId: string;
    conversationId: string;
    excludeSourceIds: string[];
    budgets: {
        knowledge: number;
        memories: number;
        history: number;
    };
};
export type PersonaRetrievalDeps = {
    ensurePersonaKnowledge: (input: {
        personaId: string;
        versionId: string;
        knowledge: string;
        knowledgeBoundary: Record<string, unknown>;
    }) => Promise<void>;
    retrieve: (input: PersonaRetrievalInput) => Promise<PersonaRetrieval>;
};
export type PersonaRetrievalContext = PersonaRetrievalInput & {
    personaVersionId: string;
    knowledge: string;
    knowledgeBoundary: Record<string, unknown>;
};
export declare function createPersonaRetrievalRunnable(deps: PersonaRetrievalDeps): Runnable<PersonaRetrievalContext, PersonaRetrieval>;
export type ComposedChatContext = {
    retrieval: PersonaRetrieval;
    systemPrompt: string;
};
export declare function createPromptAssemblyRunnable(compose: (retrieval: PersonaRetrieval) => string): Runnable<PersonaRetrieval, ComposedChatContext>;
//# sourceMappingURL=chain.d.ts.map