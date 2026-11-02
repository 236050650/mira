import { createHash } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { PersonaSeed } from "@mira/prompts";
import data from "./data/global-cultural-personas.json" with { type: "json" };
import type { Db } from "./client.js";
import { personas, personaVersions } from "./schema.js";

export type CulturalPackage = { catalogId: string; originalName: string; status: string; seed: PersonaSeed };
export const culturalPackages = data as CulturalPackage[];
// Explicit identity aliases, not fuzzy-name matching. Existing crafted versions
// and publication decisions remain owned by their original seed files.
const curated: Record<string, string> = {
  Confucius: "confucius", "Sun Tzu": "sunwu",
  "Wang Yangming": "wang-yangming", "Vincent van Gogh": "vangogh",
};

export async function importCulturalPersonas(db: Db, packages = culturalPackages) {
  if (new Set(packages.map(p => p.catalogId)).size !== packages.length) throw Error("Duplicate catalogue identity");
  return db.transaction(async tx => {
    const result = { created: 0, updated: 0, unchanged: 0, linked: 0, items: [] as Array<{ catalogId: string; personaId: string; slug: string; status: string; action: string }> };
    for (const item of packages) {
      const { seed } = item;
      const notes = seed.version.sourceNotes;
      if (!["published", "draft"].includes(item.status)) throw Error(`Invalid status: ${item.catalogId}`);
      if (item.status === "published" && (notes.living || ["在世观察", "专题审查"].includes(String(notes.eligibility)))) throw Error(`Unsafe publication: ${item.catalogId}`);
      if (!/^Q\d+$/.test(item.catalogId) || notes.catalogId !== item.catalogId) throw Error(`Invalid identity: ${item.catalogId}`);
      for (const key of ["identity", "voice", "behavior", "worldview", "knowledge", "goals", "systemPrompt", "greeting"] as const) {
        if (!seed.version[key]?.trim()) throw Error(`Missing ${key}: ${item.catalogId}`);
      }
      const slug = curated[item.originalName] ?? seed.id;
      let existing = await tx.query.personas.findFirst({ where: eq(personas.slug, slug) });
      if (existing && curated[item.originalName]) {
        if (!existing.isBuiltin) throw Error(`Identity collision: ${slug}`);
        result.linked++;
        result.items.push({ catalogId: item.catalogId, personaId: existing.id, slug, status: existing.status, action: "linked-existing-curated" });
        continue;
      }
      const current = existing?.currentVersionId
        ? await tx.query.personaVersions.findFirst({ where: eq(personaVersions.id, existing.currentVersionId) }) : undefined;
      if (existing && (!existing.isBuiltin || current?.sourceNotes && (current.sourceNotes as Record<string, unknown>).catalogId !== item.catalogId)) {
        throw Error(`Identity collision: ${slug}`);
      }
      const hash = createHash("sha256").update(JSON.stringify(item)).digest("hex");
      if (current && (current.sourceNotes as Record<string, unknown>).importHash === hash && existing?.status === item.status) {
        result.unchanged++;
        result.items.push({ catalogId: item.catalogId, personaId: existing.id, slug, status: existing.status, action: "unchanged" });
        continue;
      }
      const values = { name: seed.name, subtitle: seed.subtitle, category: seed.category, bio: seed.bio, tags: seed.tags, status: item.status, isBuiltin: true, online: item.status === "published", accent: seed.accent ?? null };
      const isNew = !existing;
      if (!existing) [existing] = await tx.insert(personas).values({ ...values, slug }).returning();
      if (!existing) throw Error(`Insert failed: ${slug}`);
      const latest = await tx.query.personaVersions.findFirst({ where: eq(personaVersions.personaId, existing.id), orderBy: [desc(personaVersions.version)] });
      const [version] = await tx.insert(personaVersions).values({
        ...seed.version, personaId: existing.id, version: (latest?.version ?? 0) + 1,
        sourceNotes: { ...notes, importHash: hash }, publishedAt: item.status === "published" ? new Date() : null,
      }).returning();
      if (!version) throw Error(`Version failed: ${slug}`);
      await tx.update(personas).set({ ...values, currentVersionId: version.id, updatedAt: new Date() }).where(eq(personas.id, existing.id));
      if (isNew) result.created++; else result.updated++;
      result.items.push({ catalogId: item.catalogId, personaId: existing.id, slug, status: item.status, action: isNew ? "created" : "new-version" });
    }
    return result;
  });
}
