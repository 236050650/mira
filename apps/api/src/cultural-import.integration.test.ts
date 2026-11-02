import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buildApp, type BuiltApp } from "./main.js";
import { culturalPackages, importCulturalPersonas } from "./db/import-cultural-lib.js";
import { personas, personaVersions } from "./db/schema.js";

let built: BuiltApp;
let headers: { authorization: string };
beforeAll(async () => {
  built = await buildApp({ env: { ...process.env, USE_PGLITE: "true", DATABASE_URL: "", MODEL_MODE: "mock" } });
  const reg = await built.app.inject({ method: "POST", url: "/v1/auth/register", payload: {
    email: `catalog-${randomUUID()}@example.com`, nickname: "目录验收", password: "Passw0rd1",
  } });
  expect(reg.statusCode).toBe(201);
  headers = { authorization: `Bearer ${reg.json().accessToken}` };
});
afterAll(async () => { await built?.app.close(); });

it("imports 300 identities atomically, preserves existing versions, and is repeatable", async () => {
  expect(culturalPackages).toHaveLength(300);
  expect(new Set(culturalPackages.map(p=>p.seed.name)).size).toBe(300);
  expect(culturalPackages.filter(p=>p.seed.version.sourceNotes.living)).toHaveLength(20);
  for (const p of culturalPackages) {
    expect(p.seed.version.examples).toHaveLength(4);
    expect(p.seed.version.suggestedReplies).toHaveLength(3);
    const sources = p.seed.version.sourceNotes.sources as string[];
    expect(sources.length).toBeGreaterThanOrEqual(2);
    expect(sources.every(s => new URL(s).protocol === "https:")).toBe(true);
    expect(sources.some(s => s.endsWith(p.catalogId))).toBe(true);
    if(p.seed.version.sourceNotes.living)expect(p.status).toBe("draft");
  }
  const original = await built.handle.db.query.personas.findFirst({ where: eq(personas.slug,"confucius") });
  const result = await importCulturalPersonas(built.handle.db);
  expect(result.created).toBe(296); expect(result.linked).toBe(4);
  expect(new Set(result.items.map(p=>p.personaId)).size).toBe(300);
  expect(result.items.filter(p=>p.status==="draft")).toHaveLength(118);
  const retained = await built.handle.db.query.personas.findFirst({ where: eq(personas.slug,"confucius") });
  expect(retained?.currentVersionId).toBe(original?.currentVersionId);
  const again = await importCulturalPersonas(built.handle.db);
  expect(again.created).toBe(0); expect(again.updated).toBe(0); expect(again.unchanged).toBe(296);

  const changed = structuredClone(culturalPackages.find(p=>p.status==="published" && p.originalName==="Mencius")!);
  const previous = await built.handle.db.query.personas.findFirst({where:eq(personas.slug,changed.seed.id)});
  changed.seed.version.greeting += "（修订）";
  const revised = await importCulturalPersonas(built.handle.db,[changed]);
  expect(revised.updated).toBe(1);
  const next = await built.handle.db.query.personas.findFirst({where:eq(personas.slug,changed.seed.id)});
  expect(next?.currentVersionId).not.toBe(previous?.currentVersionId);
  expect(await built.handle.db.query.personaVersions.findFirst({where:eq(personaVersions.id,previous!.currentVersionId!)})).toBeTruthy();

  const bad = structuredClone(culturalPackages.find(p=>p.seed.version.sourceNotes.living)!);
  bad.status="published";
  await expect(importCulturalPersonas(built.handle.db,[bad])).rejects.toThrow("Unsafe publication");
  // A later invalid package must roll back earlier inserts from the same batch.
  const fresh = structuredClone(changed);
  fresh.catalogId="Q999999999"; fresh.seed.id="culture-rollback-probe";
  fresh.seed.version.sourceNotes.catalogId=fresh.catalogId;
  await expect(importCulturalPersonas(built.handle.db,[fresh,bad])).rejects.toThrow("Unsafe publication");
  expect(await built.handle.db.query.personas.findFirst({where:eq(personas.slug,fresh.seed.id)})).toBeUndefined();
});

it("serves all pages, searches beyond 200 rows, and blocks drafts from conversations", async () => {
  await built.handle.db.insert(personas).values(Array.from({length:30},(_,i)=>({
    slug:`paging-probe-${i}`,name:`分页样本${i}`,category:"测试",subtitle:"分页",bio:"仅测试",status:"published",
  })));
  const ids: string[]=[];
  let offset=0;
  for (;;) {
    const response=await built.app.inject({url:`/v1/personas?limit=100&offset=${offset}`,headers});
    expect(response.statusCode).toBe(200);
    const body=response.json(); ids.push(...body.items.map((p:any)=>p.id));
    if(!body.hasMore){expect(ids).toHaveLength(body.total);break;} offset=ids.length;
  }
  expect(ids.length).toBeGreaterThan(200); expect(new Set(ids).size).toBe(ids.length);
  const search=await built.app.inject({url:"/v1/personas?query="+encodeURIComponent("霍去病"),headers});
  expect(search.json().items.some((p:any)=>p.slug==="huo-qubing")).toBe(true);
  const draft=await built.handle.db.query.personas.findFirst({where:eq(personas.status,"draft")});
  expect(ids).not.toContain(draft!.id);
  const detail=await built.app.inject({url:`/v1/personas/${draft!.id}`,headers});
  expect(detail.statusCode).toBe(404);
  const blocked=await built.app.inject({method:"POST",url:"/v1/conversations",headers,payload:{personaId:draft!.id}});
  expect(blocked.statusCode).toBe(404);
  const selectable=culturalPackages.find(p=>p.originalName==="Mencius")!;
  const person=await built.handle.db.query.personas.findFirst({where:eq(personas.slug,selectable.seed.id)});
  const conversation=await built.app.inject({method:"POST",url:"/v1/conversations",headers,payload:{personaId:person!.id}});
  expect(conversation.statusCode).toBe(201);
  expect(conversation.json().conversation.personaVersionId).toBe(person!.currentVersionId);
  const invalid=await built.app.inject({url:"/v1/personas?offset=-1",headers});
  expect(invalid.statusCode).toBe(400);
});
