import { CreatePersonaSchema } from "@mira/contracts";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { Db } from "../db/client.js";
import { personaFavorites, personaVersions, personas } from "../db/schema.js";
import { ErrorCodes, handleRouteError, sendError } from "../http/errors.js";

function mapPersona(
  persona: typeof personas.$inferSelect,
  version?: typeof personaVersions.$inferSelect | null,
  favorited = false,
) {
  return {
    id: persona.id,
    slug: persona.slug,
    name: persona.name,
    category: persona.category,
    subtitle: persona.subtitle,
    bio: persona.bio,
    tags: persona.tags,
    avatarUrl: persona.avatarUrl,
    coverUrl: persona.coverUrl,
    status: persona.status,
    isBuiltin: persona.isBuiltin,
    accent: persona.accent,
    panel: persona.panel,
    atlas: persona.atlas,
    image: persona.image,
    artTone: persona.artTone,
    online: persona.online,
    conversations: persona.conversationsLabel,
    favorited,
    version: version
      ? {
          id: version.id,
          version: version.version,
          greeting: version.greeting,
          suggestedReplies: version.suggestedReplies,
          speakingStyle: version.speakingStyle,
          knowledgeBoundary: version.knowledgeBoundary,
          relationshipPreset: version.relationshipPreset,
          memoryPolicy: version.memoryPolicy,
          voice: version.voice,
        }
      : null,
  };
}

export function registerPersonaRoutes(
  app: FastifyInstance,
  deps: { db: Db; requireAuth: (req: any, reply: any) => Promise<void> },
) {
  app.get("/v1/personas", { preHandler: deps.requireAuth }, async (request, reply) => {
    try {
      const query = z.object({
        category: z.string().optional(), query: z.string().optional(), favorite: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      }).parse(request.query);
      const { limit, offset } = query;
      const userId = request.userId!;

      let rows = await deps.db.query.personas.findMany({
        where: eq(personas.status, "published"),
        orderBy: [desc(personas.createdAt), personas.id],
      });

      if (query.category && query.category !== "为你推荐") {
        if (query.category === "中国历史") {
          rows = rows.filter((p) =>
            ["中国历史", "思想家", "军事家", "历史人物"].includes(p.category),
          );
        } else {
          rows = rows.filter((p) => p.category === query.category);
        }
      }

      if (query.query) {
        const q = query.query.toLowerCase();
        rows = rows.filter((p) => {
          const hay = `${p.name} ${p.subtitle} ${p.bio} ${p.tags.join(" ")}`.toLowerCase();
          return hay.includes(q);
        });
      }

      const favorites = await deps.db.query.personaFavorites.findMany({
        where: eq(personaFavorites.userId, userId),
      });
      const favSet = new Set(favorites.map((f) => f.personaId));

      if (query.favorite === "true") {
        rows = rows.filter((p) => favSet.has(p.id));
      }

      const page = rows.slice(offset, offset + limit);
      const versionIds = page.flatMap(p => p.currentVersionId ? [p.currentVersionId] : []);
      const versions = versionIds.length ? await deps.db.query.personaVersions.findMany({
        where: inArray(personaVersions.id, versionIds),
      }) : [];
      const versionMap = new Map(versions.map((v) => [v.id, v]));

      const items = page.map((p) =>
        mapPersona(p, p.currentVersionId ? versionMap.get(p.currentVersionId) : null, favSet.has(p.id)),
      );
      return reply.send({ items, total: rows.length, hasMore: offset + items.length < rows.length });
    } catch (error) {
      return handleRouteError(error, request, reply);
    }
  });

  app.get("/v1/personas/:id", { preHandler: deps.requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const persona =
        (await deps.db.query.personas.findFirst({ where: eq(personas.id, id) })) ||
        (await deps.db.query.personas.findFirst({ where: eq(personas.slug, id) }));
      if (!persona || persona.status !== "published") {
        return sendError(reply, request, 404, ErrorCodes.PERSONA_NOT_FOUND, "角色不存在");
      }
      const version = persona.currentVersionId
        ? await deps.db.query.personaVersions.findFirst({
            where: eq(personaVersions.id, persona.currentVersionId),
          })
        : null;
      const fav = await deps.db.query.personaFavorites.findFirst({
        where: and(
          eq(personaFavorites.userId, request.userId!),
          eq(personaFavorites.personaId, persona.id),
        ),
      });
      return reply.send({ persona: mapPersona(persona, version, Boolean(fav)) });
    } catch (error) {
      return handleRouteError(error, request, reply);
    }
  });

  app.post("/v1/personas/:id/favorite", { preHandler: deps.requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const persona = await deps.db.query.personas.findFirst({ where: eq(personas.id, id) });
      if (!persona) {
        return sendError(reply, request, 404, ErrorCodes.PERSONA_NOT_FOUND, "角色不存在");
      }
      await deps.db
        .insert(personaFavorites)
        .values({ userId: request.userId!, personaId: id })
        .onConflictDoNothing();
      return reply.send({ favorited: true });
    } catch (error) {
      return handleRouteError(error, request, reply);
    }
  });

  app.delete("/v1/personas/:id/favorite", { preHandler: deps.requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await deps.db
        .delete(personaFavorites)
        .where(
          and(eq(personaFavorites.userId, request.userId!), eq(personaFavorites.personaId, id)),
        );
      return reply.send({ favorited: false });
    } catch (error) {
      return handleRouteError(error, request, reply);
    }
  });

  app.post("/v1/personas", { preHandler: deps.requireAuth }, async (request, reply) => {
    try {
      const body = CreatePersonaSchema.parse(request.body);
      const slug = `custom-${Date.now()}`;
      const [persona] = await deps.db
        .insert(personas)
        .values({
          slug,
          ownerUserId: request.userId!,
          name: body.name,
          category: "原创角色",
          subtitle: body.subtitle,
          bio: body.bio,
          tags: body.tags,
          avatarUrl: body.avatarUrl ?? null,
          coverUrl: body.coverUrl ?? null,
          status: "draft",
          isBuiltin: false,
        })
        .returning();
      if (!persona) throw new Error("create persona failed");
      const [version] = await deps.db
        .insert(personaVersions)
        .values({
          personaId: persona.id,
          version: 1,
          greeting: body.greeting,
          suggestedReplies: body.suggestedReplies,
          systemPrompt: body.systemPrompt,
          speakingStyle: body.speakingStyle ?? {},
          knowledgeBoundary: body.knowledgeBoundary ?? {},
          relationshipPreset: body.relationshipPreset ?? {},
          memoryPolicy: body.memoryPolicy ?? {},
          publishedAt: null,
        })
        .returning();
      if (!version) throw new Error("create version failed");
      await deps.db
        .update(personas)
        .set({ currentVersionId: version.id, updatedAt: new Date() })
        .where(eq(personas.id, persona.id));
      return reply.status(201).send({ persona: mapPersona({ ...persona, currentVersionId: version.id }, version) });
    } catch (error) {
      return handleRouteError(error, request, reply);
    }
  });

  app.post("/v1/personas/:id/publish", { preHandler: deps.requireAuth }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const persona = await deps.db.query.personas.findFirst({ where: eq(personas.id, id) });
      if (!persona || persona.ownerUserId !== request.userId!) {
        return sendError(reply, request, 404, ErrorCodes.PERSONA_NOT_FOUND, "角色不存在");
      }
      if (persona.isBuiltin) {
        return sendError(reply, request, 403, ErrorCodes.FORBIDDEN, "内置角色不可修改");
      }
      await deps.db
        .update(personas)
        .set({ status: "published", updatedAt: new Date() })
        .where(eq(personas.id, id));
      if (persona.currentVersionId) {
        await deps.db
          .update(personaVersions)
          .set({ publishedAt: new Date(), updatedAt: new Date() })
          .where(eq(personaVersions.id, persona.currentVersionId));
      }
      return reply.send({ ok: true });
    } catch (error) {
      return handleRouteError(error, request, reply);
    }
  });
}
