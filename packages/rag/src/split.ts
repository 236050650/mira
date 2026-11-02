import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const CHINESE_SEPARATORS = ["\n\n", "\n", "。", "！", "？", "；", "，", "、", " ", ""];

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
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 400,
    chunkOverlap: 40,
    separators: CHINESE_SEPARATORS,
  });
  const pieces: KnowledgePiece[] = [];
  const knowledge = input.knowledge.trim();
  if (knowledge) {
    const parts = await splitter.splitText(knowledge);
    parts.forEach((part, index) => {
      const content = part.trim();
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
