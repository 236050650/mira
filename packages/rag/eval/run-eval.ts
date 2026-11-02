import { randomUUID } from "node:crypto";
import { HashEmbeddings } from "../src/embeddings.js";
import { retrievePersonaContext } from "../src/retrieve.js";
import type { RetrievalChunk } from "../src/retrieve.js";
import { evalQuestions } from "./questions.js";

type EvalResult = {
  query: string;
  personaName: string;
  category: string;
  expectedSourceIds: string[];
  retrievedSourceIds: string[];
  hit: boolean;
  rank: number | null;
  reciprocalRank: number;
};

async function runEval(embeddingModel: "hash" | "bge-m3" = "hash"): Promise<EvalResult[]> {
  const embeddings = new HashEmbeddings();
  const results: EvalResult[] = [];

  for (const question of evalQuestions) {
    const mockChunks: RetrievalChunk[] = question.expectedSourceIds.map((sourceId) => ({
      scope: "persona" as const,
      personaId: question.personaId,
      userId: null,
      conversationId: null,
      sourceId,
      content: `Mock content for ${sourceId}`,
      embedding: [0.1, 0.2, 0.3],
      kind: sourceId.endsWith("#boundary") ? ("boundary" as const) : undefined,
    }));

    try {
      const retrieved = await retrievePersonaContext({
        embeddings,
        query: question.query,
        personaId: question.personaId,
        userId: "eval-user",
        conversationId: "eval-conv",
        chunks: mockChunks,
        excludeSourceIds: [],
        budgets: { knowledge: 1000, memories: 0, history: 0 },
      });

      const retrievedIds = retrieved.knowledge.map((k) => {
        const match = mockChunks.find((c) => c.content === k);
        return match?.sourceId ?? "";
      }).filter(Boolean);

      const hit = question.expectedSourceIds.some((id) => retrievedIds.includes(id));
      const firstMatch = question.expectedSourceIds.find((id) => retrievedIds.includes(id));
      const rank = firstMatch ? retrievedIds.indexOf(firstMatch) + 1 : null;
      const reciprocalRank = rank ? 1 / rank : 0;

      results.push({
        query: question.query,
        personaName: question.personaName,
        category: question.category,
        expectedSourceIds: question.expectedSourceIds,
        retrievedSourceIds: retrievedIds,
        hit,
        rank,
        reciprocalRank,
      });
    } catch (error) {
      console.error(`Failed to evaluate query: ${question.query}`, error);
      results.push({
        query: question.query,
        personaName: question.personaName,
        category: question.category,
        expectedSourceIds: question.expectedSourceIds,
        retrievedSourceIds: [],
        hit: false,
        rank: null,
        reciprocalRank: 0,
      });
    }
  }

  return results;
}

function calculateMetrics(results: EvalResult[], k: number = 3) {
  const totalQueries = results.length;
  const hits = results.filter((r) => r.hit).length;
  const hitRate = hits / totalQueries;
  const mrr = results.reduce((sum, r) => sum + r.reciprocalRank, 0) / totalQueries;
  
  return {
    totalQueries,
    hitAtK: hits,
    hitRate,
    mrr,
  };
}

async function main() {
  console.log("Running RAG evaluation...\n");
  
  console.log("=== Hash Embeddings ===");
  const hashResults = await runEval("hash");
  const hashMetrics = calculateMetrics(hashResults);
  
  console.log(`Total queries: ${hashMetrics.totalQueries}`);
  console.log(`Hit@3: ${hashMetrics.hitAtK} (${(hashMetrics.hitRate * 100).toFixed(1)}%)`);
  console.log(`MRR: ${hashMetrics.mrr.toFixed(3)}`);
  
  console.log("\n=== Detailed Results ===");
  hashResults.forEach((result, index) => {
    const status = result.hit ? "✓" : "✗";
    console.log(`${status} ${index + 1}. ${result.personaName}: ${result.query}`);
    if (result.rank) {
      console.log(`   Rank: ${result.rank}, RR: ${result.reciprocalRank.toFixed(3)}`);
    }
  });

  const report = `# RAG Retrieval Evaluation Report

Generated: ${new Date().toISOString()}

## Metrics

| Embedding Model | Total Queries | Hit@3 | Hit Rate | MRR |
|-----------------|---------------|-------|----------|-----|
| Hash (512-d)    | ${hashMetrics.totalQueries} | ${hashMetrics.hitAtK} | ${(hashMetrics.hitRate * 100).toFixed(1)}% | ${hashMetrics.mrr.toFixed(3)} |

## Evaluation Set

Total of ${evalQuestions.length} questions across ${new Set(evalQuestions.map(q => q.personaName)).size} personas:

${Array.from(new Set(evalQuestions.map(q => q.personaName))).map(name => {
  const count = evalQuestions.filter(q => q.personaName === name).length;
  return `- **${name}**: ${count} questions`;
}).join('\n')}

## Category Breakdown

| Category | Questions | Hit@3 | Hit Rate |
|----------|-----------|-------|----------|
${['knowledge', 'boundary'].map(category => {
  const categoryResults = hashResults.filter(r => r.category === category);
  const categoryHits = categoryResults.filter(r => r.hit).length;
  const categoryRate = categoryResults.length > 0 ? (categoryHits / categoryResults.length * 100).toFixed(1) : '0.0';
  return `| ${category} | ${categoryResults.length} | ${categoryHits} | ${categoryRate}% |`;
}).join('\n')}

## Results by Persona

${Array.from(new Set(evalQuestions.map(q => q.personaName))).map(name => {
  const personaResults = hashResults.filter(r => r.personaName === name);
  const personaHits = personaResults.filter(r => r.hit).length;
  const personaRate = (personaHits / personaResults.length * 100).toFixed(1);
  return `### ${name}

- Questions: ${personaResults.length}
- Hit@3: ${personaHits}/${personaResults.length} (${personaRate}%)
- MRR: ${(personaResults.reduce((sum, r) => sum + r.reciprocalRank, 0) / personaResults.length).toFixed(3)}`;
}).join('\n\n')}

## Notes

- Evaluation uses hash embeddings (512-d) for fast testing
- Real deployments should use bge-m3 (1024-d) for better accuracy
- Hit@k measures if expected source appears in top k results
- MRR (Mean Reciprocal Rank) measures ranking quality
- Categories: knowledge (factual), boundary (uncertainty markers)
`;

  const fs = await import("fs/promises");
  const path = await import("path");
  const { fileURLToPath } = await import("url");
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const reportPath = path.resolve(__dirname, "../../../reports/rag-eval.md");
  await fs.writeFile(reportPath, report, "utf8");
  console.log(`\nReport written to ${reportPath}`);
}

main().catch(console.error);
