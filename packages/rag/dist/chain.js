import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";
export function createPersonaRetrievalRunnable(deps) {
    const ensure = RunnableLambda.from(async (input) => {
        await deps.ensurePersonaKnowledge({
            personaId: input.personaId,
            versionId: input.personaVersionId,
            knowledge: input.knowledge,
            knowledgeBoundary: input.knowledgeBoundary,
        });
        return input;
    }).withConfig({ runName: "ensure_persona_knowledge" });
    const retrieve = RunnableLambda.from((input) => deps.retrieve({
        query: input.query,
        personaId: input.personaId,
        userId: input.userId,
        conversationId: input.conversationId,
        excludeSourceIds: input.excludeSourceIds,
        budgets: input.budgets,
    })).withConfig({ runName: "retrieve_persona_context" });
    return RunnableSequence.from([ensure, retrieve]);
}
export function createPromptAssemblyRunnable(compose) {
    const runnable = RunnableLambda.from((retrieval) => ({
        retrieval,
        systemPrompt: compose(retrieval),
    }));
    return runnable.withConfig({ runName: "compose_persona_prompt" });
}
//# sourceMappingURL=chain.js.map