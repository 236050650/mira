import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
const CHINESE_SEPARATORS = ["\n\n", "\n", "。", "！", "？", "；", "，", "、", " ", ""];
function formatBoundary(boundary) {
    return Object.entries(boundary)
        .map(([key, value]) => {
        if (Array.isArray(value))
            return `${key}：${value.join("；")}`;
        if (typeof value === "object" && value !== null)
            return `${key}：${JSON.stringify(value)}`;
        return `${key}：${String(value)}`;
    })
        .join("\n");
}
export async function splitPersonaKnowledge(input) {
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 400,
        chunkOverlap: 40,
        separators: CHINESE_SEPARATORS,
    });
    const pieces = [];
    const knowledge = input.knowledge.trim();
    if (knowledge) {
        const parts = await splitter.splitText(knowledge);
        parts.forEach((part, index) => {
            const content = part.trim();
            if (!content)
                return;
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
//# sourceMappingURL=split.js.map