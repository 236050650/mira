import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { describe, expect, it } from "vitest";
import { GatewayChatModel } from "./gateway-chat-model.js";
import { chatMessagesToLangChain, langChainToChatMessages } from "./messages.js";
import { streamChatViaLangChain } from "./stream-via-langchain.js";
class EchoProvider {
    id = "mock";
    async healthCheck() {
        return { ok: true };
    }
    async listModels() {
        return [];
    }
    async *streamChat(request) {
        const joined = request.messages.map((m) => `${m.role}:${m.content}`).join("|");
        yield { type: "content", delta: joined };
        yield {
            type: "usage",
            usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 },
        };
        yield { type: "done", finishReason: "stop" };
    }
}
describe("GatewayChatModel", () => {
    it("round-trips LangChain and gateway chat messages", () => {
        const lc = chatMessagesToLangChain([
            { role: "system", content: "sys" },
            { role: "user", content: "hi" },
        ]);
        expect(langChainToChatMessages(lc)).toEqual([
            { role: "system", content: "sys" },
            { role: "user", content: "hi" },
        ]);
    });
    it("streams provider output through LangChain chunks", async () => {
        const model = new GatewayChatModel({ provider: new EchoProvider(), model: "mock-persona" });
        let text = "";
        for await (const chunk of await model.stream([new SystemMessage("s"), new HumanMessage("u")])) {
            if (typeof chunk.content === "string")
                text += chunk.content;
        }
        expect(text).toContain("system:s");
        expect(text).toContain("user:u");
    });
    it("maps LangChain stream back to ChatChunk for SSE", async () => {
        const chunks = [];
        for await (const chunk of streamChatViaLangChain(new EchoProvider(), {
            requestId: "r1",
            model: "mock-persona",
            messages: [{ role: "user", content: "ping" }],
            maxOutputTokens: 32,
            thinking: "disabled",
        })) {
            chunks.push(chunk);
        }
        expect(chunks.some((c) => c.type === "content")).toBe(true);
        expect(chunks.some((c) => c.type === "usage")).toBe(true);
        expect(chunks.at(-1)?.type).toBe("done");
    });
});
//# sourceMappingURL=gateway-chat-model.test.js.map