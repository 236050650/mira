import { describe, expect, it } from "vitest";
import { allocateContextBudget, estimateTokens, extractMemoryCandidates, selectRecentMessages, shouldSummarize, } from "../src/context.js";
describe("context helpers", () => {
    it("allocates budget proportions", () => {
        const budget = allocateContextBudget(1000);
        expect(budget.platformAndPersona).toBe(250);
        expect(budget.recentMessages).toBe(400);
    });
    it("selects recent messages under budget", () => {
        const messages = Array.from({ length: 30 }, (_, i) => ({
            role: i % 2 === 0 ? "user" : "assistant",
            content: `消息${i}`.repeat(20),
        }));
        const selected = selectRecentMessages(messages, 200, 4);
        expect(selected.length).toBeGreaterThan(0);
        expect(selected.length).toBeLessThan(30);
        expect(estimateTokens(selected.map((m) => m.content).join(""))).toBeLessThan(800);
    });
    it("triggers summarize after threshold", () => {
        expect(shouldSummarize(13)).toBe(true);
        expect(shouldSummarize(5)).toBe(false);
    });
    it("extracts preference memories", () => {
        expect(extractMemoryCandidates("请记住我不喝咖啡，更喜欢乌龙茶。")).toHaveLength(1);
        expect(extractMemoryCandidates("今天天气还行。")).toHaveLength(0);
    });
});
//# sourceMappingURL=context.test.js.map