import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { allPersonaSeeds } from "@mira/prompts";
import type { Db } from "./client.js";
import { personaVersions, personas } from "./schema.js";

export async function seedPersonas(db: Db) {
  for (const seed of allPersonaSeeds) {
    const existing = await db.query.personas.findFirst({
      where: eq(personas.slug, seed.id),
    });

    const versionPayload = {
      greeting: seed.version.greeting,
      suggestedReplies: seed.version.suggestedReplies,
      systemPrompt: seed.version.systemPrompt,
      speakingStyle: seed.version.speakingStyle as Record<string, unknown>,
      knowledgeBoundary: seed.version.knowledgeBoundary as Record<string, unknown>,
      relationshipPreset: seed.version.relationshipPreset as Record<string, unknown>,
      memoryPolicy: seed.version.memoryPolicy as Record<string, unknown>,
      sourceNotes: seed.version.sourceNotes as Record<string, unknown>,
      identity: seed.version.identity,
      goals: seed.version.goals,
      voice: seed.version.voice,
      behavior: seed.version.behavior,
      worldview: seed.version.worldview,
      knowledge: seed.version.knowledge,
      examples: seed.version.examples,
      forbiddenExpressions: seed.version.forbiddenExpressions,
      publishedAt: new Date(),
    };

    if (existing) {
      const current = existing.currentVersionId
        ? await db.query.personaVersions.findFirst({
            where: eq(personaVersions.id, existing.currentVersionId),
          })
        : null;
      if (current) {
        await db
          .update(personaVersions)
          .set({ ...versionPayload, updatedAt: new Date() })
          .where(eq(personaVersions.id, current.id));
      }
      await db
        .update(personas)
        .set({
          name: seed.name,
          category: seed.category,
          subtitle: seed.subtitle,
          bio: seed.bio,
          tags: seed.tags,
          avatarUrl: seed.avatarUrl ?? null,
          coverUrl: seed.coverUrl ?? null,
          accent: seed.accent ?? null,
          panel: seed.panel ?? null,
          atlas: seed.atlas ?? null,
          image: seed.image ?? null,
          artTone: seed.artTone ?? null,
          online: seed.online,
          conversationsLabel: seed.conversations,
          updatedAt: new Date(),
        })
        .where(eq(personas.id, existing.id));
      continue;
    }

    const [persona] = await db
      .insert(personas)
      .values({
        id: randomUUID(),
        slug: seed.id,
        name: seed.name,
        category: seed.category,
        subtitle: seed.subtitle,
        bio: seed.bio,
        tags: seed.tags,
        avatarUrl: seed.avatarUrl ?? null,
        coverUrl: seed.coverUrl ?? null,
        status: "published",
        isBuiltin: true,
        accent: seed.accent ?? null,
        panel: seed.panel ?? null,
        atlas: seed.atlas ?? null,
        image: seed.image ?? null,
        artTone: seed.artTone ?? null,
        online: seed.online,
        conversationsLabel: seed.conversations,
      })
      .returning();

    if (!persona) throw new Error(`Failed to insert persona ${seed.id}`);

    const [version] = await db
      .insert(personaVersions)
      .values({
        id: randomUUID(),
        personaId: persona.id,
        version: 1,
        ...versionPayload,
      })
      .returning();

    if (!version) throw new Error(`Failed to insert version for ${seed.id}`);

    await db
      .update(personas)
      .set({ currentVersionId: version.id, updatedAt: new Date() })
      .where(eq(personas.id, persona.id));
  }

  return allPersonaSeeds.length;
}
