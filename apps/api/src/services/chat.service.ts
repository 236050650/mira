import { randomUUID } from "node:crypto";
import {
  ErrorCodes,
  type MessageAcceptedEvent,
  type MessageCompletedEvent,
  type MessageDeltaEvent,
  type MessageFailedEvent,
  type MessageUsageEvent,
  type ModelProfileId,
  type SseEventName,
} from "@mira/contracts";
import {
  advanceRelationship,
  allocateContextBudget,
  buildRuleSummary,
  extractMemoryCandidates,
  messagesOutsideRecentTurns,
  selectRecentMessages,
  shouldSummarize,
  trimToTokenBudget,
} from "@mira/domain";
import type { ModelGateway } from "@mira/model-gateway";
import { composePersonaPrompt, type PersonaExample, type PersonaVersion } from "@mira/prompts";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { AppConfig } from "../config.js";
import type { Db } from "../db/client.js";
import {
  conversations,
  generations,
  memories,
  messages,
  modelUsage,
  personaVersions,
  personas,
} from "../db/schema.js";
import type { RetrievalIndex } from "./retrieval-index.js";

export type ChatStreamCallback = (
  event: SseEventName,
  data:
    | MessageAcceptedEvent
    | MessageSourcesEvent
    | MessageDeltaEvent
    | MessageUsageEvent
    | MessageCompletedEvent
    | MessageFailedEvent,
) => void;

export type StreamMessageInput = {
  userId: string;
  conversationId: string;
  clientMessageId: string;
  content: string;
  modelProfileId?: ModelProfileId;
  signal?: AbortSignal;
  onEvent: ChatStreamCallback;
};

export type RegenerateMessageInput = {
  userId: string;
  conversationId: string;
  assistantMessageId: string;
  modelProfileId?: ModelProfileId;
  signal?: AbortSignal;
  onEvent: ChatStreamCallback;
};

export class ChatServiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ChatServiceError";
  }
}

function jsonToPromptString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return JSON.stringify(value);
}

function mapPersonaVersion(row: typeof personaVersions.$inferSelect): PersonaVersion {
  const examples = (row.examples as unknown[]).flatMap((item) => {
    if (
      typeof item === "object" &&
      item !== null &&
      "user" in item &&
      "assistant" in item &&
      typeof (item as PersonaExample).user === "string" &&
      typeof (item as PersonaExample).assistant === "string"
    ) {
      return [item as PersonaExample];
    }
    return [];
  });

  return {
    greeting: row.greeting,
    suggestedReplies: row.suggestedReplies,
    systemPrompt: row.systemPrompt,
    speakingStyle: row.speakingStyle,
    knowledgeBoundary: row.knowledgeBoundary,
    relationshipPreset: row.relationshipPreset,
    memoryPolicy: row.memoryPolicy,
    sourceNotes: row.sourceNotes as Record<string, unknown>,
    identity: jsonToPromptString(row.identity),
    goals: jsonToPromptString(row.goals),
    voice: jsonToPromptString(row.voice),
    behavior: jsonToPromptString(row.behavior),
    worldview: jsonToPromptString(row.worldview),
    knowledge: jsonToPromptString(row.knowledge),
    examples,
    forbiddenExpressions: row.forbiddenExpressions,
  };
}

const RELATIONSHIP_LABELS = ["初见", "熟悉", "信赖", "默契"] as const;
const STREAM_FLUSH_MS = 200;

export class ChatService {
  private readonly postProcessQueue = new Map<string, Promise<void>>();
  private readonly stopFlags = new Set<string>();

  constructor(
    private readonly db: Db,
    private readonly gateway: ModelGateway,
    private readonly config: AppConfig,
    private readonly retrieval: RetrievalIndex,
  ) {}

  async streamMessage(input: StreamMessageInput): Promise<void> {
    const conversation = await this.requireConversation(input.userId, input.conversationId);

    let userMessage = await this.db.query.messages.findFirst({
      where: and(
        eq(messages.conversationId, input.conversationId),
        eq(messages.clientMessageId, input.clientMessageId),
        eq(messages.role, "user"),
      ),
    });

    if (!userMessage) {
      try {
        const [inserted] = await this.db
          .insert(messages)
          .values({
            conversationId: input.conversationId,
            clientMessageId: input.clientMessageId,
            role: "user",
            content: input.content,
            status: "completed",
          })
          .returning();
        if (!inserted) throw new Error("insert user message failed");
        userMessage = inserted;
      } catch {
        userMessage = await this.db.query.messages.findFirst({
          where: and(
            eq(messages.conversationId, input.conversationId),
            eq(messages.clientMessageId, input.clientMessageId),
            eq(messages.role, "user"),
          ),
        });
        if (!userMessage) throw new Error("insert user message failed");
      }
    }

    const existingAssistant = await this.db.query.messages.findFirst({
      where: and(
        eq(messages.conversationId, input.conversationId),
        eq(messages.parentMessageId, userMessage.id),
        eq(messages.role, "assistant"),
      ),
      orderBy: [desc(messages.createdAt)],
    });

    if (existingAssistant?.status === "completed") {
      input.onEvent("message.accepted", {
        userMessageId: userMessage.id,
        assistantMessageId: existingAssistant.id,
        generationId: existingAssistant.generationId ?? "",
      });
      input.onEvent("message.delta", {
        assistantMessageId: existingAssistant.id,
        delta: existingAssistant.content,
      });
      input.onEvent("message.completed", {
        assistantMessageId: existingAssistant.id,
        finishReason: existingAssistant.finishReason ?? "stop",
      });
      return;
    }

    await this.runGeneration({
      conversation,
      userMessage,
      existingAssistant:
        existingAssistant && ["pending", "streaming", "failed", "interrupted"].includes(existingAssistant.status)
          ? existingAssistant
          : undefined,
      modelProfileId: input.modelProfileId ?? (conversation.preferredModelProfileId as ModelProfileId),
      userContent: userMessage.content,
      signal: input.signal,
      onEvent: input.onEvent,
      isRegenerate: false,
    });
  }

  async regenerateMessage(input: RegenerateMessageInput): Promise<void> {
    const conversation = await this.requireConversation(input.userId, input.conversationId);

    const assistantMessage = await this.db.query.messages.findFirst({
      where: and(
        eq(messages.id, input.assistantMessageId),
        eq(messages.conversationId, input.conversationId),
        eq(messages.role, "assistant"),
      ),
    });
    if (!assistantMessage) {
      throw new ChatServiceError(ErrorCodes.MESSAGE_NOT_FOUND, "消息不存在");
    }

    const lastAssistant = await this.db.query.messages.findFirst({
      where: and(eq(messages.conversationId, input.conversationId), eq(messages.role, "assistant")),
      orderBy: [desc(messages.createdAt)],
    });
    if (!lastAssistant || lastAssistant.id !== assistantMessage.id) {
      throw new ChatServiceError(ErrorCodes.VALIDATION_FAILED, "只能重新生成最后一条助手消息");
    }

    let userMessage = assistantMessage.parentMessageId
      ? await this.db.query.messages.findFirst({
          where: eq(messages.id, assistantMessage.parentMessageId),
        })
      : null;

    if (!userMessage) {
      const recentUser = await this.db.query.messages.findFirst({
        where: and(eq(messages.conversationId, input.conversationId), eq(messages.role, "user")),
        orderBy: [desc(messages.createdAt)],
      });
      userMessage = recentUser ?? null;
    }
    if (!userMessage) {
      throw new ChatServiceError(ErrorCodes.MESSAGE_NOT_FOUND, "找不到对应的用户消息");
    }

    await this.runGeneration({
      conversation,
      userMessage,
      existingAssistant: assistantMessage,
      modelProfileId: input.modelProfileId ?? (conversation.preferredModelProfileId as ModelProfileId),
      userContent: userMessage.content,
      signal: input.signal,
      onEvent: input.onEvent,
      isRegenerate: true,
    });
  }

  async requestStop(userId: string, conversationId: string, generationId: string): Promise<boolean> {
    const conversation = await this.requireConversation(userId, conversationId);
    const generation = await this.db.query.generations.findFirst({
      where: and(
        eq(generations.id, generationId),
        eq(generations.conversationId, conversation.id),
        eq(generations.userId, userId),
      ),
    });
    if (!generation) return false;
    this.stopFlags.add(generationId);
    await this.db
      .update(generations)
      .set({ stopRequested: true, updatedAt: new Date() })
      .where(eq(generations.id, generationId));
    return true;
  }

  private async requireConversation(userId: string, conversationId: string) {
    const conversation = await this.db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, userId),
        isNull(conversations.deletedAt),
      ),
    });
    if (!conversation) {
      throw new ChatServiceError(ErrorCodes.CONVERSATION_NOT_FOUND, "会话不存在");
    }
    return conversation;
  }

  private async runGeneration(params: {
    conversation: typeof conversations.$inferSelect;
    userMessage: typeof messages.$inferSelect;
    existingAssistant?: typeof messages.$inferSelect;
    modelProfileId: ModelProfileId;
    userContent: string;
    signal?: AbortSignal;
    onEvent: ChatStreamCallback;
    isRegenerate: boolean;
  }) {
    const { conversation, userMessage, userContent, signal, onEvent, isRegenerate } = params;
    let profile;
    try {
      profile = this.gateway.resolveProfile(params.modelProfileId);
    } catch {
      throw new ChatServiceError(ErrorCodes.MODEL_PROFILE_INVALID, "模型配置无效");
    }

    const effectiveProvider = profile.provider;
    if (effectiveProvider === "deepseek" && this.gateway.mode === "remote" && !this.gateway.canUseRemote()) {
      onEvent("message.failed", {
        code: ErrorCodes.MODEL_BUDGET_EXCEEDED,
        message: "已达到远程模型日预算，请切换本地模型",
      });
      return;
    }

    let assistantMessage = params.existingAssistant;
    if (assistantMessage) {
      await this.db
        .update(messages)
        .set({
          content: "",
          status: "streaming",
          provider: null,
          model: null,
          modelProfileId: profile.id,
          inputTokens: null,
          outputTokens: null,
          finishReason: null,
          updatedAt: new Date(),
        })
        .where(eq(messages.id, assistantMessage.id));
    } else {
      const [inserted] = await this.db
        .insert(messages)
        .values({
          conversationId: conversation.id,
          parentMessageId: userMessage.id,
          role: "assistant",
          content: "",
          status: "streaming",
          modelProfileId: profile.id,
        })
        .returning();
      if (!inserted) throw new Error("insert assistant message failed");
      assistantMessage = inserted;
    }

    const [generation] = await this.db
      .insert(generations)
      .values({
        conversationId: conversation.id,
        userId: conversation.userId,
        assistantMessageId: assistantMessage.id,
        status: "running",
      })
      .returning();
    if (!generation) throw new Error("insert generation failed");

    await this.db
      .update(messages)
      .set({ generationId: generation.id, updatedAt: new Date() })
      .where(eq(messages.id, assistantMessage.id));

    onEvent("message.accepted", {
      userMessageId: userMessage.id,
      assistantMessageId: assistantMessage.id,
      generationId: generation.id,
    });

    const persona = await this.db.query.personas.findFirst({
      where: eq(personas.id, conversation.personaId),
    });
    const version = await this.db.query.personaVersions.findFirst({
      where: eq(personaVersions.id, conversation.personaVersionId),
    });
    if (!persona || !version) {
      await this.failGeneration({
        assistantMessageId: assistantMessage.id,
        generationId: generation.id,
        onEvent,
        code: ErrorCodes.PERSONA_NOT_FOUND,
        message: "角色版本不存在",
      });
      return;
    }

    const historyRows = await this.db.query.messages.findMany({
      where: and(
        eq(messages.conversationId, conversation.id),
        eq(messages.status, "completed"),
      ),
      orderBy: [messages.createdAt],
    });

    const excludeIds = new Set<string>([assistantMessage.id]);
    if (!isRegenerate) {
      excludeIds.add(userMessage.id);
    }

    const budget = allocateContextBudget();
    const historyTurns = historyRows
      .filter(
        (m) =>
          !excludeIds.has(m.id) && (m.role === "user" || m.role === "assistant"),
      )
      .map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    const recentTurns = selectRecentMessages(historyTurns, budget.recentMessages);
    const personaVersion = mapPersonaVersion(version);
    let retrieved = {
      knowledge: [] as Array<{ content: string; score: number; sourceId: string }>,
      memories: [] as Array<{ sourceId: string; category: string; content: string; score: number }>,
      history: [] as Array<{ sourceId: string; content: string; score: number }>,
    };
    try {
      await this.retrieval.ensurePersonaKnowledge({
        personaId: persona.id,
        versionId: version.id,
        knowledge: personaVersion.knowledge,
        knowledgeBoundary: personaVersion.knowledgeBoundary,
      });
      retrieved = await this.retrieval.retrieve({
        query: userContent,
        personaId: persona.id,
        userId: conversation.userId,
        conversationId: conversation.id,
        excludeSourceIds: recentTurns.map((turn) => turn.id),
        budgets: {
          knowledge: this.config.ragKnowledgeBudget,
          memories: this.config.ragMemoriesBudget,
          history: this.config.ragHistoryBudget,
        },
      });
      if (retrieved.memories.length > 0) {
        await this.db
          .update(memories)
          .set({ lastUsedAt: new Date(), updatedAt: new Date() })
          .where(inArray(memories.id, retrieved.memories.map((memory) => memory.sourceId)));
      }
    } catch (error) {
      console.error("retrieval failed", error);
    }

    const allSources = [
      ...retrieved.knowledge.map((item) => ({
        sourceId: item.sourceId,
        scope: "persona" as const,
        score: item.score,
        snippet: item.content.slice(0, 100),
      })),
      ...retrieved.memories.map((item) => ({
        sourceId: item.sourceId,
        scope: "memory" as const,
        score: item.score,
        snippet: item.content.slice(0, 100),
      })),
      ...retrieved.history.map((item) => ({
        sourceId: item.sourceId,
        scope: "message" as const,
        score: item.score,
        snippet: item.content.slice(0, 100),
      })),
    ];

    if (allSources.length > 0) {
      onEvent("message.sources", { sources: allSources });
    }

    const relationshipLevel =
      RELATIONSHIP_LABELS[Math.min(conversation.relationshipLevel, RELATIONSHIP_LABELS.length - 1)] ??
      "初见";
    const relationshipState = conversation.relationshipState as {
      title?: string;
      events?: string[];
    };

    const systemPrompt = composePersonaPrompt({
      personaName: persona.name,
      personaVersion,
      relationship: {
        level: relationshipLevel,
        title: relationshipState.title,
        events: relationshipState.events,
      },
      memories: retrieved.memories.map((memory) => ({
        category: memory.category,
        content: memory.content,
      })),
      summary: conversation.summary ?? undefined,
      retrievedKnowledge: retrieved.knowledge.map((item) => item.content),
      retrievedHistory: retrieved.history.map((item) => item.content),
    });

    const chatMessages = [
      { role: "system" as const, content: systemPrompt },
      ...recentTurns.map((turn) => ({ role: turn.role, content: turn.content })),
    ];
    if (!isRegenerate) {
      chatMessages.push({ role: "user" as const, content: userContent });
    }

    const provider = this.gateway.getProvider(profile.provider);
    const requestId = generation.id;
    const startedAt = Date.now();
    let firstTokenMs: number | undefined;
    let accumulated = "";
    let finishReason = "stop";
    let inputTokens = 0;
    let outputTokens = 0;
    let failed = false;

    let lastFlushAt = 0;
    let lastStopCheck = 0;
    try {
      for await (const chunk of provider.streamChat({
        requestId,
        model: profile.model,
        messages: chatMessages,
        maxOutputTokens: profile.maxOutputTokens,
        thinking: profile.thinking,
        signal,
      })) {
        const now = Date.now();
        const checkDatabase = now - lastStopCheck >= STREAM_FLUSH_MS;
        if (checkDatabase) lastStopCheck = now;
        if (await this.shouldStop(generation.id, signal, checkDatabase)) {
          finishReason = "interrupted";
          break;
        }

        if (chunk.type === "content" && chunk.delta) {
          if (firstTokenMs === undefined) firstTokenMs = Date.now() - startedAt;
          accumulated += chunk.delta;
          onEvent("message.delta", {
            assistantMessageId: assistantMessage.id,
            delta: chunk.delta,
          });
          if (now - lastFlushAt >= STREAM_FLUSH_MS) {
            lastFlushAt = now;
            await this.db
              .update(messages)
              .set({ content: accumulated, updatedAt: new Date() })
              .where(eq(messages.id, assistantMessage.id));
          }
        }

        if (chunk.type === "usage" && chunk.usage) {
          inputTokens = chunk.usage.inputTokens;
          outputTokens = chunk.usage.outputTokens;
          onEvent("message.usage", {
            inputTokens,
            outputTokens,
            totalTokens: chunk.usage.totalTokens,
            provider: effectiveProvider,
            model: profile.model,
          });
        }

        if (chunk.type === "error" && chunk.error) {
          failed = true;
          await this.failGeneration({
            assistantMessageId: assistantMessage.id,
            generationId: generation.id,
            onEvent,
            code: chunk.error.code,
            message: chunk.error.message,
          });
          return;
        }

        if (chunk.type === "done") {
          finishReason = chunk.finishReason ?? "stop";
        }
      }

      if (await this.shouldStop(generation.id, signal)) {
        finishReason = "interrupted";
      }

      const latencyMs = Date.now() - startedAt;
      const finalStatus =
        finishReason === "interrupted" ? "interrupted" : accumulated ? "completed" : "failed";

      await this.db
        .update(messages)
        .set({
          content: accumulated,
          status: finalStatus,
          provider: effectiveProvider,
          model: profile.model,
          modelProfileId: profile.id,
          inputTokens,
          outputTokens,
          finishReason,
          updatedAt: new Date(),
        })
        .where(eq(messages.id, assistantMessage.id));

      await this.db
        .update(generations)
        .set({
          status: finishReason === "interrupted" ? "interrupted" : failed ? "failed" : "completed",
          updatedAt: new Date(),
        })
        .where(eq(generations.id, generation.id));

      await this.db
        .update(conversations)
        .set({ lastMessageAt: new Date(), updatedAt: new Date() })
        .where(eq(conversations.id, conversation.id));

      if (finalStatus === "failed") {
        await this.failGeneration({
          assistantMessageId: assistantMessage.id,
          generationId: generation.id,
          onEvent,
          code: ErrorCodes.INTERNAL_ERROR,
          message: "模型未返回有效内容",
        });
        return;
      }

      await this.db.insert(modelUsage).values({
        userId: conversation.userId,
        conversationId: conversation.id,
        messageId: assistantMessage.id,
        provider: effectiveProvider,
        model: profile.model,
        inputTokens,
        outputTokens,
        latencyMs,
        firstTokenMs: firstTokenMs ?? null,
        status: finalStatus === "interrupted" ? "interrupted" : "ok",
      });

      if (effectiveProvider === "deepseek") {
        this.gateway.addRemoteUsage(inputTokens + outputTokens);
      }

      onEvent("message.completed", {
        assistantMessageId: assistantMessage.id,
        finishReason,
      });

      if (finalStatus === "completed") {
        this.enqueuePostProcess(conversation.id, () =>
          this.postProcess({
            conversationId: conversation.id,
            userId: conversation.userId,
            personaId: conversation.personaId,
            modelProfileId: profile.id,
            userMessageId: userMessage.id,
            assistantMessageId: assistantMessage.id,
            userContent,
            assistantContent: accumulated,
            isRegenerate,
          }),
        );
      }
    } catch (error) {
      const aborted = error instanceof Error && error.name === "AbortError";
      if (aborted || (await this.shouldStop(generation.id, signal))) {
        await this.db
          .update(messages)
          .set({
            content: accumulated,
            status: "interrupted",
            finishReason: "interrupted",
            updatedAt: new Date(),
          })
          .where(eq(messages.id, assistantMessage.id));
        await this.db
          .update(generations)
          .set({ status: "interrupted", updatedAt: new Date() })
          .where(eq(generations.id, generation.id));
        onEvent("message.completed", {
          assistantMessageId: assistantMessage.id,
          finishReason: "interrupted",
        });
        return;
      }

      await this.failGeneration({
        assistantMessageId: assistantMessage.id,
        generationId: generation.id,
        onEvent,
        code: ErrorCodes.INTERNAL_ERROR,
        message: "生成失败",
      });
    } finally {
      this.stopFlags.delete(generation.id);
    }
  }

  private async shouldStop(
    generationId: string,
    signal?: AbortSignal,
    checkDatabase = true,
  ): Promise<boolean> {
    if (signal?.aborted || this.stopFlags.has(generationId)) return true;
    if (!checkDatabase) return false;
    const row = await this.db.query.generations.findFirst({
      where: eq(generations.id, generationId),
    });
    if (row?.stopRequested) this.stopFlags.add(generationId);
    return row?.stopRequested ?? false;
  }

  private async failGeneration(params: {
    assistantMessageId: string;
    generationId: string;
    onEvent: ChatStreamCallback;
    code: string;
    message: string;
  }) {
    await this.db
      .update(messages)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(messages.id, params.assistantMessageId));
    await this.db
      .update(generations)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(generations.id, params.generationId));
    params.onEvent("message.failed", { code: params.code, message: params.message });
  }

  private enqueuePostProcess(conversationId: string, work: () => Promise<void>) {
    const previous = this.postProcessQueue.get(conversationId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(work);
    this.postProcessQueue.set(conversationId, next);
    void next.finally(() => {
      if (this.postProcessQueue.get(conversationId) === next) {
        this.postProcessQueue.delete(conversationId);
      }
    });
  }

  private async summarizeWithModel(input: {
    previous: string | null;
    turns: Array<{ role: "user" | "assistant"; content: string }>;
    modelProfileId: ModelProfileId;
    tokenBudget: number;
  }): Promise<string | null> {
    if (this.gateway.mode === "mock") return null;
    let profile;
    try {
      profile = this.gateway.resolveProfile(input.modelProfileId);
    } catch {
      return null;
    }
    if (profile.provider === "deepseek" && this.gateway.mode === "remote" && !this.gateway.canUseRemote()) {
      return null;
    }
    const transcript = input.turns
      .map((turn) => `${turn.role === "user" ? "用户" : "角色"}：${turn.content}`)
      .join("\n");
    const provider = this.gateway.getProvider(profile.provider);
    let summary = "";
    let totalTokens = 0;
    for await (const chunk of provider.streamChat({
      requestId: randomUUID(),
      model: profile.model,
      messages: [
        {
          role: "system",
          content: "把对话压缩成四行：事实、关系、未完成话题、偏好。不要逐字复述，不要加入新事实。",
        },
        {
          role: "user",
          content: `${input.previous ? `已有摘要：\n${input.previous}\n\n` : ""}新增对话：\n${transcript}`,
        },
      ],
      maxOutputTokens: 400,
      thinking: "disabled",
    })) {
      if (chunk.type === "content" && chunk.delta) summary += chunk.delta;
      if (chunk.type === "usage" && chunk.usage) totalTokens = chunk.usage.totalTokens;
    }
    if (profile.provider === "deepseek" && totalTokens > 0) {
      this.gateway.addRemoteUsage(totalTokens);
    }
    const trimmed = summary.trim();
    return trimmed ? trimToTokenBudget(trimmed, input.tokenBudget) : null;
  }

  private async postProcess(params: {
    conversationId: string;
    userId: string;
    personaId: string;
    modelProfileId: ModelProfileId;
    userMessageId: string;
    assistantMessageId: string;
    userContent: string;
    assistantContent: string;
    isRegenerate: boolean;
  }) {
    try {
      await this.retrieval.upsertMessage({
        id: params.userMessageId,
        userId: params.userId,
        personaId: params.personaId,
        conversationId: params.conversationId,
        role: "user",
        content: params.userContent,
      });
      await this.retrieval.upsertMessage({
        id: params.assistantMessageId,
        userId: params.userId,
        personaId: params.personaId,
        conversationId: params.conversationId,
        role: "assistant",
        content: params.assistantContent,
      });
      if (params.isRegenerate) return;

      const conversation = await this.db.query.conversations.findFirst({
        where: eq(conversations.id, params.conversationId),
      });
      const rows = await this.db.query.messages.findMany({
        where: and(eq(messages.conversationId, params.conversationId), eq(messages.status, "completed")),
      });
      const ordered = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const userCount = ordered.filter((message) => message.role === "user").length;
      const nextLevel = advanceRelationship(conversation?.relationshipLevel ?? 0, { messageCount: userCount });
      let summary = conversation?.summary ?? null;
      let summaryThroughMessageId = conversation?.summaryThroughMessageId ?? null;

      if (shouldSummarize(userCount)) {
        const older = messagesOutsideRecentTurns(ordered, 8);
        const throughIndex = summaryThroughMessageId
          ? ordered.findIndex((message) => message.id === summaryThroughMessageId)
          : -1;
        const fresh = older.filter((message) => {
          if (message.role !== "user" && message.role !== "assistant") return false;
          if (throughIndex < 0) return true;
          return ordered.findIndex((item) => item.id === message.id) > throughIndex;
        });
        if (fresh.length > 0) {
          const tokenBudget = allocateContextBudget().summary;
          const turns = fresh.map((message) => ({
            role: message.role as "user" | "assistant",
            content: message.content,
          }));
          const modelSummary = await this.summarizeWithModel({
            previous: summary,
            turns,
            modelProfileId: params.modelProfileId,
            tokenBudget,
          });
          const piece = modelSummary ?? buildRuleSummary(turns, tokenBudget);
          summary = trimToTokenBudget([summary, piece].filter(Boolean).join("\n"), tokenBudget);
          summaryThroughMessageId = fresh.at(-1)?.id ?? summaryThroughMessageId;
        }
      }

      await this.db
        .update(conversations)
        .set({
          summary,
          summaryThroughMessageId,
          relationshipLevel: nextLevel,
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, params.conversationId));

      const candidates = extractMemoryCandidates(params.userContent);
      for (const candidate of candidates) {
        const id = randomUUID();
        await this.db.insert(memories).values({
          id,
          userId: params.userId,
          personaId: params.personaId,
          conversationId: params.conversationId,
          sourceMessageId: params.userMessageId,
          category: candidate.category,
          content: candidate.content,
          confidence: candidate.confidence,
        });
        await this.retrieval.upsertMemory({
          id,
          userId: params.userId,
          personaId: params.personaId,
          conversationId: params.conversationId,
          category: candidate.category,
          content: candidate.content,
        });
      }
    } catch (error) {
      console.error("postProcess failed", error);
    }
  }
}
