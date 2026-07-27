import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the MIRA persona demo", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>MIRA 镜语 — 历史与动漫人格模拟器<\/title>/i);
  assert.match(html, /WELCOME TO MIRA/);
  assert.match(html, /欢迎回来/);
  assert.match(html, /直接体验 Demo/);
  assert.match(html, /切换到深色模式/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("removes the disposable starter and keeps product metadata", async () => {
  const [page, appHook, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/use-mira-app.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  await assert.rejects(
    access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)),
  );
  await assert.rejects(
    access(new URL("../app/_sites-preview/preview.css", import.meta.url)),
  );
  assert.match(page, /function ChatView/);
  assert.match(page, /function DiscoverView/);
  assert.match(page, /function CreateView/);
  assert.match(page, /创建并开始对话/);
  assert.match(appHook, /游客最多体验一个角色会话/);
  assert.match(layout, /MIRA 镜语 — 历史与动漫人格模拟器/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

test("ships an implementation-ready requirements and acceptance baseline", async () => {
  const [requirements, technical, acceptance, envExample, gitignore] =
    await Promise.all([
      readFile(new URL("../../../docs/01-产品需求规格书.md", import.meta.url), "utf8"),
      readFile(new URL("../../../docs/02-技术设计文档.md", import.meta.url), "utf8"),
      readFile(new URL("../../../docs/03-最终验收方案.md", import.meta.url), "utf8"),
      readFile(new URL("../../../.env.example", import.meta.url), "utf8"),
      readFile(new URL("../../../.gitignore", import.meta.url), "utf8"),
    ]);

  assert.match(requirements, /CHAT-05 模型切换/);
  assert.match(requirements, /第一版完成定义/);
  assert.match(technical, /deepseek-v4-flash/);
  assert.match(technical, /qwen3\.5:latest/);
  assert.match(technical, /ModelProvider/);
  assert.match(acceptance, /P0 用例 100% 通过/);
  assert.match(acceptance, /AC-MODEL-003 Ollama 对话/);
  assert.match(envExample, /DEEPSEEK_API_KEY=\s*\n/);
  assert.match(envExample, /OLLAMA_BASE_URL=http:\/\/127\.0\.0\.1:11434\/v1/);
  assert.match(gitignore, /\.env\*/);
  assert.match(gitignore, /!\.env\.example/);
});
