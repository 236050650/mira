import { loadAndSplitText } from "./loaders.js";

export type KnowledgePiece = {
  sourceId: string;
  content: string;
  kind: "knowledge" | "boundary";
};

function formatBoundary(boundary: Record<string, unknown>): string {
  return Object.entries(boundary)
    .map(([key, value]) => {
      if (Array.isArray(value)) return `${key}：${value.join("；")}`;
      if (typeof value === "object" && value !== null) return `${key}：${JSON.stringify(value)}`;
      return `${key}：${String(value)}`;
    })
    .join("\n");
}

export async function splitPersonaKnowledge(input: {
  versionId: string;
  knowledge: string;
  knowledgeBoundary: Record<string, unknown>;
}): Promise<KnowledgePiece[]> {
  const pieces: KnowledgePiece[] = [];
  const knowledge = input.knowledge.trim();
  if (knowledge) {
    const docs = await loadAndSplitText(knowledge, { versionId: input.versionId, kind: "knowledge" });
    docs.forEach((doc, index) => {
      const content = doc.pageContent.trim();
      if (!content) return;
      pieces.push({
        sourceId: `${input.versionId}#k${index}`,
        content,
        kind: "knowledge",
      });
    });
  }

  const boundary = formatBoundary(input.knowledgeBoundary).trim();
  if (boundary) {
    pieces.push({
      sourceId: `${input.versionId}#boundary`,
      content: boundary,
      kind: "boundary",
    });
  }
  return pieces;
}
