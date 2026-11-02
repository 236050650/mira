import { UpdateMemorySchema } from "@mira/contracts";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Db } from "../db/client.js";
import { memories } from "../db/schema.js";
import { ErrorCodes, handleRouteError, sendError } from "../http/errors.js";
import type { RetrievalIndex } from "../services/retrieval-index.js";

function mapMemory(row: typeof memories.$inferSelect) {
  return {
    id: row.id,
    personaId: row.personaId,
    conversationId: row.conversationId,
    sourceMessageId: row.sourceMessageId,
    category: row.category,
    content: row.content,
    confidence: row.confidence,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function registerMemoryRoutes(
  app: FastifyInstance,
  deps: { db: Db; requireAuth: (req: any, reply: any) => Promise<void>; retrieval: RetrievalIndex },
) {
  app.get("/v1/memories", { preHandler: deps.requireAuth }, async (request, reply) => {
    try {
      const query = z
        .object({ personaId: z.string().uuid() })
        .parse(request.query);
      const userId = request.userId!;

      const rows = await deps.db.query.memories.findMany({
        where: and(
          eq(memories.userId, userId),
          eq(memories.personaId, query.personaId),
          isNull(memories.deletedAt),
        ),
        orderBy: [desc(memories.updatedAt)],
      });

      return reply.send({ items: rows.map(mapMemory) });
    } catch (error) {
      return handleRouteError(error, request, reply);
    }
  });

  app.patch("/v1/memories/:id", { preHandler: deps.requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = UpdateMemorySchema.parse(request.body);
      const userId = request.userId!;

      const existing = await deps.db.query.memories.findFirst({
        where: and(eq(memories.id, id), eq(memories.userId, userId), isNull(memories.deletedAt)),
      });
      if (!existing) {
        return sendError(reply, request, 404, ErrorCodes.MEMORY_NOT_FOUND, "记忆不存在");
      }

      const [updated] = await deps.db
        .update(memories)
        .set({
          ...(body.content !== undefined ? { content: body.content } : {}),
          ...(body.category !== undefined ? { category: body.category } : {}),
          updatedAt: new Date(),
        })
        .where(eq(memories.id, id))
        .returning();
      if (!updated) throw new Error("update memory failed");
      try {
        await deps.retrieval.upsertMemory({
          id: updated.id,
          userId: updated.userId,
          personaId: updated.personaId,
          conversationId: updated.conversationId,
          category: updated.category,
          content: updated.content,
        });
      } catch (error) {
        request.log.error({ err: error }, "memory reindex failed");
      }

      return reply.send({ memory: mapMemory(updated) });
    } catch (error) {
      return handleRouteError(error, request, reply);
    }
  });

  app.delete("/v1/memories/:id", { preHandler: deps.requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const userId = request.userId!;

      const existing = await deps.db.query.memories.findFirst({
        where: and(eq(memories.id, id), eq(memories.userId, userId), isNull(memories.deletedAt)),
      });
      if (!existing) {
        return sendError(reply, request, 404, ErrorCodes.MEMORY_NOT_FOUND, "记忆不存在");
      }

      await deps.db
        .update(memories)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(memories.id, id));
      await deps.retrieval.removeSource("memory", id);

      return reply.send({ ok: true });
    } catch (error) {
      return handleRouteError(error, request, reply);
    }
  });
}
