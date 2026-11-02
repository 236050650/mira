import { HashEmbeddings, splitPersonaKnowledge } from "../src/index.js";
import { evalQuestions } from "./questions.js";

const MOCK_PERSONAS = {
  "huo-qubing": {
    knowledge: "河西之战采用快速骑兵突袭战术，深入敌后切断补给。\n\n不建府邸是因为匈奴未灭何以家为，国事为重。",
    boundary: { 不确定: "匈奴未灭何以家为这句话的史料来源存在争议，传世文献中记载不一" },
  },
  "confucius": {
    knowledge: "仁的核心是爱人，推己及人，恕道贯穿始终。\n\n周游列国十四年，传播礼乐仁政理念，虽未被重用but初心不改。",
    boundary: { 不确定: "弟子三千贤人七十二是概数，具体名单和生平细节史料不全" },
  },
  "wang-yangming": {
    knowledge: "心即理，心外无物，良知即天理。\n\n龙场悟道源于困境中的内省，顿悟圣人之道吾性自足。\n\n平叛宁王之乱展现出奇制胜的军事才能。",
    boundary: { 不确定: "与朱熹理学的分歧涉及复杂哲学论辩，简化解释可能失真" },
  },
  "li-bai": {
    knowledge: "最爱蜀道、庐山、黄鹤楼等壮丽山川，寄情山水以遣怀。\n\n与杜甫结为至交，惺惺相惜，有诗歌唱和。\n\n诗仙之名源于才华横溢，浪漫主义风格独步天下。",
    boundary: { 不确定: "对现代诗歌形式的评价属于假设性问题，超出历史人物知识范围" },
  },
};

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

  const personaChunks = new Map<string, Array<{ sourceId: string; content: string; embedding: number[] }>>();

  for (const [personaId, data] of Object.entries(MOCK_PERSONAS)) {
    const pieces = await splitPersonaKnowledge({
      versionId: `${personaId}-v1`,
      knowledge: data.knowledge,
      knowledgeBoundary: data.boundary,
    });

    const vectors = await embeddings.embedDocuments(pieces.map((p) => p.content));
    const chunks = pieces.map((piece, idx) => ({
      sourceId: piece.sourceId,
      content: piece.content,
      embedding: vectors[idx] ?? [],
    }));

    personaChunks.set(personaId, chunks);
  }

  for (const question of evalQuestions) {
    const chunks = personaChunks.get(question.personaId) ?? [];
    const [queryVec] = await embeddings.embedDocuments([question.query]);

    if (!queryVec) {
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
      continue;
    }

    const scored = chunks.map((chunk) => {
      const score = cosineSimilarity(queryVec, chunk.embedding);
      return { sourceId: chunk.sourceId, score };
    }).sort((a, b) => b.score - a.score);

    const topK = scored.slice(0, 3).map((s) => s.sourceId);

    const hit = question.expectedSourceIds.length > 0 && question.expectedSourceIds.some((id) => topK.includes(id));
    const firstMatch = question.expectedSourceIds.find((id) => topK.includes(id));
    const rank = firstMatch ? topK.indexOf(firstMatch) + 1 : null;
    const reciprocalRank = rank ? 1 / rank : 0;

    results.push({
      query: question.query,
      personaName: question.personaName,
      category: question.category,
      expectedSourceIds: question.expectedSourceIds,
      retrievedSourceIds: topK,
      hit,
      rank,
      reciprocalRank,
    });
  }

  return results;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  return normA === 0 || normB === 0 ? 0 : dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function calculateMetrics(results: EvalResult[]) {
  const withExpected = results.filter((r) => r.expectedSourceIds.length > 0);
  const hits = withExpected.filter((r) => r.hit).length;
  const hitRate = withExpected.length > 0 ? hits / withExpected.length : 0;
  const mrr = withExpected.length > 0
    ? withExpected.reduce((sum, r) => sum + r.reciprocalRank, 0) / withExpected.length
    : 0;

  return {
    totalQueries: results.length,
    queriesWithExpected: withExpected.length,
    hitAtK: hits,
    hitRate,
    mrr,
  };
}

async function main() {
  console.log("Running RAG evaluation with realistic paraphrased queries...\n");

  const hashResults = await runEval("hash");
  const hashMetrics = calculateMetrics(hashResults);

  console.log("=== Hash Embeddings (512-d) ===");
  console.log(`Total queries: ${hashMetrics.totalQueries}`);
  console.log(`Queries with expected answers: ${hashMetrics.queriesWithExpected}`);
  console.log(`Hit@3: ${hashMetrics.hitAtK}/${hashMetrics.queriesWithExpected} (${(hashMetrics.hitRate * 100).toFixed(1)}%)`);
  console.log(`MRR: ${hashMetrics.mrr.toFixed(3)}`);

  console.log("\n=== Per-Category Breakdown ===");
  for (const category of ["knowledge", "boundary", "hard"]) {
    const categoryResults = hashResults.filter((r) => r.category === category);
    const categoryWithExpected = categoryResults.filter((r) => r.expectedSourceIds.length > 0);
    const categoryHits = categoryWithExpected.filter((r) => r.hit).length;
    const categoryRate = categoryWithExpected.length > 0
      ? (categoryHits / categoryWithExpected.length * 100).toFixed(1)
      : "N/A";
    console.log(`${category}: ${categoryHits}/${categoryWithExpected.length} (${categoryRate}%)`);
  }

  console.log("\n=== Detailed Results ===");
  hashResults.forEach((result, index) => {
    const status = result.hit ? "✓" : result.expectedSourceIds.length === 0 ? "○" : "✗";
    const score = result.rank ? `@${result.rank}` : result.expectedSourceIds.length === 0 ? "distractor" : "miss";
    console.log(`${status} ${index + 1}. [${result.category}] ${result.personaName}: ${result.query} (${score})`);
  });

  const report = `# RAG Retrieval Evaluation Report

Generated: ${new Date().toISOString()}

## Metrics (Hash Embeddings, 512-d)

| Metric | Value |
|--------|-------|
| Total Queries | ${hashMetrics.totalQueries} |
| Queries with Expected Answers | ${hashMetrics.queriesWithExpected} |
| Hit@3 | ${hashMetrics.hitAtK}/${hashMetrics.queriesWithExpected} |
| Hit Rate | ${(hashMetrics.hitRate * 100).toFixed(1)}% |
| MRR | ${hashMetrics.mrr.toFixed(3)} |

## Category Breakdown

| Category | Queries | Hit@3 | Hit Rate |
|----------|---------|-------|----------|
${["knowledge", "boundary", "hard"].map((category) => {
  const categoryResults = hashResults.filter((r) => r.category === category);
  const categoryWithExpected = categoryResults.filter((r) => r.expectedSourceIds.length > 0);
  const categoryHits = categoryWithExpected.filter((r) => r.hit).length;
  const categoryRate = categoryWithExpected.length > 0
    ? (categoryHits / categoryWithExpected.length * 100).toFixed(1)
    : "N/A";
  return `| ${category} | ${categoryWithExpected.length} | ${categoryHits} | ${categoryRate}% |`;
}).join("\n")}

## Evaluation Design

- **Total questions**: ${evalQuestions.length} across 4 personas (霍去病, 孔子, 王阳明, 李白)
- **Query style**: Paraphrased questions that don't match source text verbatim
- **Categories**:
  - **knowledge**: Questions answerable from persona knowledge chunks
  - **boundary**: Questions about uncertainty/limitations marked in knowledgeBoundary
  - **hard**: Distractor questions outside persona scope (no expected answer)
- **Ranking**: Retrieval uses Top-3 candidates, scored by cosine similarity

## Results by Persona

${Array.from(new Set(hashResults.map((r) => r.personaName))).map((name) => {
  const personaResults = hashResults.filter((r) => r.personaName === name);
  const personaWithExpected = personaResults.filter((r) => r.expectedSourceIds.length > 0);
  const personaHits = personaWithExpected.filter((r) => r.hit).length;
  const personaRate = personaWithExpected.length > 0
    ? (personaHits / personaWithExpected.length * 100).toFixed(1)
    : "N/A";
  const personaMRR = personaWithExpected.length > 0
    ? (personaWithExpected.reduce((sum, r) => sum + r.reciprocalRank, 0) / personaWithExpected.length).toFixed(3)
    : "N/A";
  return `### ${name}

- Questions: ${personaResults.length} (${personaWithExpected.length} with expected answers)
- Hit@3: ${personaHits}/${personaWithExpected.length} (${personaRate}%)
- MRR: ${personaMRR}`;
}).join("\n\n")}

## Notes

- Evaluation uses **hash embeddings (512-d)** for deterministic testing
- **bge-m3 (1024-d)** eval requires running Ollama locally (not automated)
- Queries are **paraphrased** to test semantic understanding, not keyword matching
- **Hard/distractor questions** test boundary detection (should return no results)
- Hit@k: Measures if expected source appears in top-k results
- MRR (Mean Reciprocal Rank): Measures ranking quality (1.0 = always rank 1)
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
