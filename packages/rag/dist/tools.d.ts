import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import type { PersonaRetrievalInput } from "./chain.js";
import type { PersonaRetrieval } from "./retrieve.js";
export declare function createPersonaKnowledgeLookupTool(input: {
    retrieve: (query: PersonaRetrievalInput) => Promise<PersonaRetrieval>;
    personaId: string;
    userId: string;
    conversationId: string;
    budgets: PersonaRetrievalInput["budgets"];
}): DynamicStructuredTool<z.ZodObject<{
    query: z.ZodString;
}, "strip", z.ZodTypeAny, {
    query: string;
}, {
    query: string;
}>, {
    query: string;
}, {
    query: string;
}, string, unknown, "persona_knowledge_lookup">;
//# sourceMappingURL=tools.d.ts.map