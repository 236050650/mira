import {
  CreateConversationSchema,
  ErrorCodes,
  ModelProfileIdSchema,
  StreamMessageSchema,
  type ModelProfileId,
  type SseEventName,
} from "@mira/contracts";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import type { Db } from "../db/client.js";
import { conversations, messages, personaVersions, personas } from "../db/schema.js";
import { handleRouteError, sendError } from "../http/errors.js";
import { ChatService, ChatServiceError } from "../services/chat.service.js";
import type { ModelGateway } from "@mira/model-gateway";
import type { AppConfig } from "../config.js";

const UpdateConversationSchema = z.object({
  title: z.string().max(80).optional(),
  modelProfileId: ModelProfileIdSchema.optional(),
});

function mapConversation(row: typeof conversations.$inferSelect, persona?: typeof personas.$inferSelect | null) {
  return {
    id: row.id,
    personaId: row.personaId,
    personaVersionId: row.personaVersionId,
    title: row.title,
    preferredModelProfileId: row.preferredModelProfileId,
    relationshipLevel: row.relationshipLevel,
    summary: row.summary,
    lastMessageAt: row.lastMessageAt,
    unreadCount: row.unreadCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    persona: persona
      ? {
          id: persona.id,
          name: persona.name,
          avatarUrl: persona.avatarUrl,
          slug: persona.slug,
        }
      : null,
  };
}

function mapMessage(row: typeof messages.$inferSelect) {
  return {
    id: row.id,
    conversationId: row.conversationId,
    clientMessageId: row.clientMessageId,
    parentMessageId: row.parentMessageId,
    role: row.role,
    content: row.content,
    status: row.status,
    provider: row.provider,
    model: row.model,
    modelProfileId: row.modelProfileId,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    finishReason: row.finishReason,
    generationId: row.generationId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function initSse(reply: FastifyReply) {
  for (const [name, value] of Object.entries(reply.getHeaders())) {
    if (value !== undefined) reply.raw.setHeader(name, value);
  }
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  reply.hijack();
}

function writeSse(reply: FastifyReply, event: SseEventName, data: unknown) {
  reply.raw.write(`event: ${event}\n`);
  reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
}

function endSse(reply: FastifyReply) {
  reply.raw.end();
}

export function registerConversationRoutes(
  app: FastifyInstance,
  deps: {
    db: Db;
    gateway: ModelGateway;
    config: AppConfig;
    chat: ChatService;
    requireAuth: (req: any, reply: any) => Promise<void>;
    requireChatRateLimit: (req: any, reply: any) => Promise<void>;
  },
) {
  app.get("/v1/conversations", { preHandler: deps.requireAuth }, async (request, reply) => {
    try {
      const userId = request.userId!;
      const rows = await deps.db.query.conversations.findMany({
        where: and(eq(conversations.userId, userId), isNull(conversations.deletedAt)),
        orderBy: [desc(conversations.lastMessageAt), desc(conversations.updatedAt)],
        limit: 100,
      });

      const personaIds = [...new Set(rows.map((r) => r.personaId))];
      const personaRows =
        personaIds.length > 0
          ? await deps.db.query.personas.findMany({
              where: inArray(personas.id, personaIds),
            })
          : [];
      const personaMap = new Map(personaRows.map((p) => [p.id, p]));

      return reply.send({
        items: rows.map((row) => mapConversation(row, personaMap.get(row.personaId))),
      });
    } catch (error) {
      return handleRouteError(error, request, reply);
    }
  });

  app.post("/v1/conversations", { preHandler: deps.requireAuth }, async (request, reply) => {
    try {
      const body = CreateConversationSchema.parse(request.body);
      const userId = request.userId!;

      const persona = await deps.db.query.personas.findFirst({
        where: eq(personas.id, body.personaId),
      });
      if (!persona || persona.status !== "published" || !persona.currentVersionId) {
        return sendError(reply, request, 404, ErrorCodes.PERSONA_NOT_FOUND, "角色不存在");
      }

      const version = await deps.db.query.personaVersions.findFirst({
        where: eq(personaVersions.id, persona.currentVersionId),
      });
      if (!version) {
        return sendError(reply, request, 404, ErrorCodes.PERSONA_NOT_FOUND, "角色版本不存在");
      }

      const modelProfileId = (body.modelProfileId ??
        (deps.config.modelMode === "local" ? "ollama-local" : "deepseek-flash")) as ModelProfileId;
      const [conversation] = await deps.db
        .insert(conversations)
        .values({
          userId,
          personaId: persona.id,
          personaVersionId: version.id,
          title: body.title ?? persona.name,
          preferredModelProfileId: modelProfileId,
          lastMessageAt: new Date(),
        })
        .returning();
      if (!conversation) throw new Error("create conversation failed");

      await deps.db.insert(messages).values({
        conversationId: conversation.id,
        role: "assistant",
        content: version.greeting,
        status: "completed",
      });

      return reply.status(201).send({ conversation: mapConversation(conversation, persona) });
    } catch (error) {
      return handleRouteError(error, request, reply);
    }
  });

  app.get("/v1/conversations/:id", { preHandler: deps.requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const conversation = await deps.db.query.conversations.findFirst({
        where: and(
          eq(conversations.id, id),
          eq(conversations.userId, request.userId!),
          isNull(conversations.deletedAt),
        ),
      });
      if (!conversation) {
        return sendError(reply, request, 404, ErrorCodes.CONVERSATION_NOT_FOUND, "会话不存在");
      }
      const persona = await deps.db.query.personas.findFirst({
        where: eq(personas.id, conversation.personaId),
      });
      return reply.send({ conversation: mapConversation(conversation, persona) });
    } catch (error) {
      return handleRouteError(error, request, reply);
    }
  });

  app.patch("/v1/conversations/:id", { preHandler: deps.requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = UpdateConversationSchema.parse(request.body);
      const conversation = await deps.db.query.conversations.findFirst({
        where: and(
          eq(conversations.id, id),
          eq(conversations.userId, request.userId!),
          isNull(conversations.deletedAt),
        ),
      });
      if (!conversation) {
        return sendError(reply, request, 404, ErrorCodes.CONVERSATION_NOT_FOUND, "会话不存在");
      }

      const [updated] = await deps.db
        .update(conversations)
        .set({
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.modelProfileId ? { preferredModelProfileId: body.modelProfileId } : {}),
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, id))
        .returning();
      if (!updated) throw new Error("update conversation failed");

      const persona = await deps.db.query.personas.findFirst({
        where: eq(personas.id, updated.personaId),
      });
      return reply.send({ conversation: mapConversation(updated, persona) });
    } catch (error) {
      return handleRouteError(error, request, reply);
    }
  });

  app.delete("/v1/conversations/:id", { preHandler: deps.requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const conversation = await deps.db.query.conversations.findFirst({
        where: and(eq(conversations.id, id), eq(conversations.userId, request.userId!)),
      });
      if (!conversation) {
        return sendError(reply, request, 404, ErrorCodes.CONVERSATION_NOT_FOUND, "会话不存在");
      }
      await deps.db
        .update(conversations)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(conversations.id, id));
      return reply.send({ ok: true });
    } catch (error) {
      return handleRouteError(error, request, reply);
    }
  });

  app.get("/v1/conversations/:id/messages", { preHandler: deps.requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const conversation = await deps.db.query.conversations.findFirst({
        where: and(
          eq(conversations.id, id),
          eq(conversations.userId, request.userId!),
          isNull(conversations.deletedAt),
        ),
      });
      if (!conversation) {
        return sendError(reply, request, 404, ErrorCodes.CONVERSATION_NOT_FOUND, "会话不存在");
      }

      const rows = await deps.db.query.messages.findMany({
        where: eq(messages.conversationId, id),
        orderBy: [messages.createdAt],
      });
      return reply.send({ items: rows.map(mapMessage) });
    } catch (error) {
      return handleRouteError(error, request, reply);
    }
  });

  app.post(
    "/v1/conversations/:id/messages/stream",
    { preHandler: [deps.requireAuth, deps.requireChatRateLimit] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const body = StreamMessageSchema.parse(request.body);
        initSse(reply);
        const abortController = new AbortController();
        reply.raw.on("close", () => abortController.abort());

        await deps.chat.streamMessage({
          userId: request.userId!,
          conversationId: id,
          clientMessageId: body.clientMessageId,
          content: body.content,
          modelProfileId: body.modelProfileId,
          signal: abortController.signal,
          onEvent: (event, data) => writeSse(reply, event, data),
        });
        endSse(reply);
      } catch (error) {
        if (reply.raw.headersSent) {
          if (error instanceof ChatServiceError) {
            writeSse(reply, "message.failed", { code: error.code, message: error.message });
          } else {
            writeSse(reply, "message.failed", {
              code: ErrorCodes.INTERNAL_ERROR,
              message: "服务暂时不可用",
            });
          }
          endSse(reply);
          return;
        }
        if (error instanceof ChatServiceError) {
          return sendError(reply, request, 404, error.code, error.message);
        }
        return handleRouteError(error, request, reply);
      }
    },
  );

  app.post(
    "/v1/conversations/:id/messages/:messageId/regenerate",
    { preHandler: [deps.requireAuth, deps.requireChatRateLimit] },
    async (request, reply) => {
      const { id, messageId } = request.params as { id: string; messageId: string };
      try {
        const body = z
          .object({ modelProfileId: ModelProfileIdSchema.optional() })
          .parse(request.body ?? {});
        initSse(reply);
        const abortController = new AbortController();
        reply.raw.on("close", () => abortController.abort());

        await deps.chat.regenerateMessage({
          userId: request.userId!,
          conversationId: id,
          assistantMessageId: messageId,
          modelProfileId: body.modelProfileId,
          signal: abortController.signal,
          onEvent: (event, data) => writeSse(reply, event, data),
        });
        endSse(reply);
      } catch (error) {
        if (reply.raw.headersSent) {
          if (error instanceof ChatServiceError) {
            writeSse(reply, "message.failed", { code: error.code, message: error.message });
          } else {
            writeSse(reply, "message.failed", {
              code: ErrorCodes.INTERNAL_ERROR,
              message: "服务暂时不可用",
            });
          }
          endSse(reply);
          return;
        }
        if (error instanceof ChatServiceError) {
          const status = error.code === ErrorCodes.MESSAGE_NOT_FOUND ? 404 : 400;
          return sendError(reply, request, status, error.code, error.message);
        }
        return handleRouteError(error, request, reply);
      }
    },
  );

  app.post(
    "/v1/conversations/:id/generations/:generationId/stop",
    { preHandler: deps.requireAuth },
    async (request, reply) => {
      try {
        const { id, generationId } = request.params as { id: string; generationId: string };
        const stopped = await deps.chat.requestStop(request.userId!, id, generationId);
        if (!stopped) {
          return sendError(reply, request, 404, ErrorCodes.CONVERSATION_NOT_FOUND, "生成任务不存在");
        }
        return reply.send({ ok: true });
      } catch (error) {
        if (error instanceof ChatServiceError) {
          return sendError(reply, request, 404, error.code, error.message);
        }
        return handleRouteError(error, request, reply);
      }
    },
  );
}
