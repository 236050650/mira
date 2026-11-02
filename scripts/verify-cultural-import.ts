import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";

// Explicit live smoke test: uses a separate labelled QA account, never a user's
// conversation. No credentials are written to the report or command output.
const root=resolve(import.meta.dirname,"..");
const data=JSON.parse(await readFile(resolve(root,"apps/api/src/db/data/global-cultural-personas.json"),"utf8"));
const base="http://127.0.0.1:4000";
let token="";
async function request(path:string,body?:unknown){
  const r=await fetch(base+path,{method:body?"POST":"GET",headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
  assert(r.ok,`${path}: HTTP ${r.status}`);return r.json();
}
const health=await request("/health");assert.equal(health.ok,true);
const auth=await request("/v1/auth/register",{email:`cultural-qa-${randomUUID()}@example.com`,password:randomUUID()+"Aa1!",nickname:"人物导入验收"});token=auth.accessToken;
const all:any[]=[];
for(;;){const page=await request(`/v1/personas?limit=100&offset=${all.length}`);all.push(...page.items);if(!page.hasMore){assert.equal(all.length,page.total);break;}}
assert.equal(new Set(all.map(p=>p.id)).size,all.length);
const report:any={checkedAt:new Date().toISOString(),health,visibleCount:all.length,samples:[]};
for(const name of ["Mencius","William Shakespeare","Chinua Achebe","Emily Dickinson","Katherine Mansfield"]){
  const candidate=data.find((p:any)=>p.originalName===name);assert(candidate,name);
  const found=await request("/v1/personas?query="+encodeURIComponent(name));
  const person=found.items.find((p:any)=>p.slug===candidate.seed.id);assert(person,name);
  const conversation=(await request("/v1/conversations",{personaId:person.id})).conversation;
  const question=candidate.seed.version.suggestedReplies[0]+"请用三句话回答，并结合与你有关的思想或作品。";
  const started=Date.now();
  const stream=await fetch(`${base}/v1/conversations/${conversation.id}/messages/stream`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({content:question,clientMessageId:randomUUID()}),signal:AbortSignal.timeout(90000)});
  const sse=await stream.text();assert(stream.ok);assert(!sse.includes("event: message.failed"),sse.slice(-400));
  const saved=await request(`/v1/conversations/${conversation.id}/messages`);
  const answer=saved.items.findLast((m:any)=>m.role==="assistant");assert(answer?.content?.length>10,name);assert.equal(answer.status,"completed");
  report.samples.push({name:person.name,catalogId:candidate.catalogId,region:candidate.seed.version.sourceNotes.region,personaId:person.id,conversationId:conversation.id,question,answer:answer.content,provider:answer.provider,model:answer.model,elapsedMs:Date.now()-started});
  await writeFile(resolve(root,"reports/cultural-persona-live-check.json"),JSON.stringify(report,null,2)+"\n");
  console.log(`${person.name}: ${answer.status}, ${answer.provider}/${answer.model}, ${answer.content.length} chars`);
}
console.log(`PASS: ${all.length} visible personas; five regional real-model conversations completed and persisted.`);
