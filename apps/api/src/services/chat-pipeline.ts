import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";
import { composePersonaPrompt, type PersonaVersion } from "@mira/prompts";
import { MiraConversationMemory, type PersonaRetrievalContext } from "@mira/rag";
import type { RetrievalIndex, RetrievalResult } from "./retrieval-index.js";

export type BuildChatContextInput = {
  query: string;
  personaId: string;
  personaVersionId: string;
  personaName: string;
  personaVersion: PersonaVersion;
  userId: string;
  conversationId: string;
  excludeSourceIds: string[];
  budgets: { knowledge: number; memories: number; history: number };
  relationship: { level: string; title?: string; events?: string[] };
  summary?: string | null;
};

export type BuiltChatContext = {
  retrieval: RetrievalResult;
  systemPrompt: string;
};

export function createPersonaChatContextPipeline(retrieval: RetrievalIndex) {
  const ensure = RunnableLambda.from(async (input: PersonaRetrievalContext) => {
    await retrieval.ensurePersonaKnowledge({
      personaId: input.personaId,
      versionId: input.personaVersionId,
      knowledge: input.knowledge,
      knowledgeBoundary: input.knowledgeBoundary,
    });
    return input;
  }).withConfig({ runName: "ensure_persona_knowledge" });

  const retrieve = RunnableLambda.from(
    (input: PersonaRetrievalContext): Promise<RetrievalResult> =>
      retrieval.retrieve({
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

export async function runPersonaChatContext(
  retrieval: RetrievalIndex,
  input: BuildChatContextInput,
): Promise<BuiltChatContext> {
  const contextInput: PersonaRetrievalContext = {
    query: input.query,
    personaId: input.personaId,
    personaVersionId: input.personaVersionId,
    knowledge: input.personaVersion.knowledge,
    knowledgeBoundary: input.personaVersion.knowledgeBoundary,
    userId: input.userId,
    conversationId: input.conversationId,
    excludeSourceIds: input.excludeSourceIds,
    budgets: input.budgets,
  };

  const retrieved = await createPersonaChatContextPipeline(retrieval).invoke(contextInput);

  const systemPrompt = composePersonaPrompt({
    personaName: input.personaName,
    personaVersion: input.personaVersion,
    relationship: input.relationship,
    memories: retrieved.memories.map((memory) => ({
      category: memory.category,
      content: memory.content,
    })),
    summary: input.summary ?? undefined,
    retrievedKnowledge: retrieved.knowledge.map((item) => item.content),
    retrievedHistory: retrieved.history.map((item) => item.content),
  });

  return { retrieval: retrieved, systemPrompt };
}

export function createConversationMemory() {
  return new MiraConversationMemory();
}
