import { RunnableLambda, RunnableSequence, type Runnable } from "@langchain/core/runnables";
import type { PersonaRetrieval } from "./retrieve.js";

export type PersonaRetrievalInput = {
  query: string;
  personaId: string;
  userId: string;
  conversationId: string;
  excludeSourceIds: string[];
  budgets: { knowledge: number; memories: number; history: number };
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

export function createPersonaRetrievalRunnable(
  deps: PersonaRetrievalDeps,
): Runnable<PersonaRetrievalContext, PersonaRetrieval> {
  const ensure = RunnableLambda.from(async (input: PersonaRetrievalContext) => {
    await deps.ensurePersonaKnowledge({
      personaId: input.personaId,
      versionId: input.personaVersionId,
      knowledge: input.knowledge,
      knowledgeBoundary: input.knowledgeBoundary,
    });
    return input;
  }).withConfig({ runName: "ensure_persona_knowledge" });

  const retrieve = RunnableLambda.from(
    (input: PersonaRetrievalContext): Promise<PersonaRetrieval> =>
      deps.retrieve({
        query: input.query,
        personaId: input.personaId,
        userId: input.userId,
        conversationId: input.conversationId,
        excludeSourceIds: input.excludeSourceIds,
        budgets: input.budgets,
      }),
  ).withConfig({ runName: "retrieve_persona_context" });

  return RunnableSequence.from([ensure, retrieve]);
}

export type ComposedChatContext = {
  retrieval: PersonaRetrieval;
  systemPrompt: string;
};

export function createPromptAssemblyRunnable(
  compose: (retrieval: PersonaRetrieval) => string,
): Runnable<PersonaRetrieval, ComposedChatContext> {
  const runnable = RunnableLambda.from((retrieval: PersonaRetrieval) => ({
    retrieval,
    systemPrompt: compose(retrieval),
  }));
  return runnable.withConfig({ runName: "compose_persona_prompt" }) as Runnable<
    PersonaRetrieval,
    ComposedChatContext
  >;
}
