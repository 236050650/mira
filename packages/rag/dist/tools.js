import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
export function createPersonaKnowledgeLookupTool(input) {
    return new DynamicStructuredTool({
        name: "persona_knowledge_lookup",
        description: "按用户问题检索角色知识库片段，返回最相关的设定与边界信息。",
        schema: z.object({
            query: z.string().describe("要检索的自然语言问题"),
        }),
        func: async ({ query }) => {
            const result = await input.retrieve({
                query,
                personaId: input.personaId,
                userId: input.userId,
                conversationId: input.conversationId,
                excludeSourceIds: [],
                budgets: input.budgets,
            });
            return JSON.stringify({
                knowledge: result.knowledge,
                memories: result.memories.map((item) => item.content),
            });
        },
    });
}
//# sourceMappingURL=tools.js.map