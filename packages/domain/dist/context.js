export function allocateContextBudget(totalTokens = 8000) {
    return {
        totalTokens,
        platformAndPersona: Math.floor(totalTokens * 0.25),
        memories: Math.floor(totalTokens * 0.15),
        summary: Math.floor(totalTokens * 0.15),
        recentMessages: Math.floor(totalTokens * 0.4),
        currentAndSafety: Math.max(Math.floor(totalTokens * 0.05), 200),
    };
}
/** Rough CJK-aware token estimate. */
export function estimateTokens(text) {
    if (!text)
        return 0;
    const cjk = text.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
    const rest = text.length - cjk;
    return Math.ceil(cjk * 1.2 + rest / 4);
}
export function selectRecentMessages(messages, tokenBudget, keepMinTurns = 6) {
    const selected = [];
    let used = 0;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        const msg = messages[i];
        if (!msg)
            continue;
        const cost = estimateTokens(msg.content) + 4;
        if (selected.length >= keepMinTurns && used + cost > tokenBudget)
            break;
        selected.push(msg);
        used += cost;
    }
    return selected.reverse();
}
export function shouldSummarize(turnCount, threshold = 12) {
    return turnCount > threshold;
}
const PREFERENCE_PATTERNS = [
    /请记住(.{2,80})/,
    /记住我(.{2,80})/,
    /我(不)?喜欢(.{2,40})/,
    /我(不)?喝(.{2,20})/,
    /我更喜欢(.{2,40})/,
];
const LOW_VALUE = [/天气/, /哈哈/, /嗯+/, /今天还行/];
export function extractMemoryCandidates(userText) {
    const text = userText.trim();
    if (!text || LOW_VALUE.some((re) => re.test(text) && text.length < 20)) {
        return [];
    }
    for (const re of PREFERENCE_PATTERNS) {
        const match = text.match(re);
        if (match) {
            return [
                {
                    category: "preference",
                    content: text.slice(0, 200),
                    confidence: 0.82,
                },
            ];
        }
    }
    return [];
}
export const RELATIONSHIP_LEVELS = ["初见", "熟悉", "信赖", "默契"];
export function trimToTokenBudget(text, tokenBudget) {
    if (estimateTokens(text) <= tokenBudget)
        return text;
    let end = text.length;
    while (end > 20 && estimateTokens(text.slice(0, end)) > tokenBudget) {
        end = Math.floor(end * 0.85);
    }
    return text.slice(0, end).trim();
}
export function messagesOutsideRecentTurns(messages, keepUserTurns = 8) {
    const userIds = messages.filter((message) => message.role === "user").map((message) => message.id);
    const recentUserIds = new Set(userIds.slice(-keepUserTurns));
    const firstRecent = messages.find((message) => recentUserIds.has(message.id));
    if (!firstRecent)
        return [];
    const start = messages.indexOf(firstRecent);
    const recentIds = new Set(messages.slice(start).map((message) => message.id));
    return messages.filter((message) => !recentIds.has(message.id));
}
export function buildRuleSummary(turns, tokenBudget) {
    const userLines = turns
        .filter((turn) => turn.role === "user")
        .map((turn) => turn.content.trim())
        .filter(Boolean);
    const preferences = userLines.filter((line) => extractMemoryCandidates(line).length > 0);
    const questions = userLines.filter((line) => line.includes("？") || line.includes("?"));
    const facts = userLines.filter((line) => !preferences.includes(line)).slice(0, 4);
    const summary = [
        `事实：${facts.map((line) => line.slice(0, 80)).join("；") || "（无）"}`,
        `关系：已记录 ${userLines.length} 轮用户发言`,
        `未完成话题：${questions.at(-1)?.slice(0, 80) || "（无）"}`,
        `偏好：${preferences.map((line) => line.slice(0, 80)).join("；") || "（无）"}`,
    ].join("\n");
    return trimToTokenBudget(summary, tokenBudget);
}
export function advanceRelationship(level, events) {
    if (events.messageCount >= 40)
        return Math.min(level, 3) === 3 ? 3 : Math.max(level, 3);
    if (events.messageCount >= 20)
        return Math.max(level, 2);
    if (events.messageCount >= 8)
        return Math.max(level, 1);
    return Math.max(level, 0);
}
//# sourceMappingURL=context.js.map