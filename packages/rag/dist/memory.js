import { AIMessage, HumanMessage, SystemMessage, } from "@langchain/core/messages";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { RunnableLambda } from "@langchain/core/runnables";
export const SUMMARY_COMPRESSION_THRESHOLD = 12;
export class MiraConversationMemory {
    summaryTurnThreshold;
    history = new InMemoryChatMessageHistory();
    constructor(summaryTurnThreshold = SUMMARY_COMPRESSION_THRESHOLD) {
        this.summaryTurnThreshold = summaryTurnThreshold;
    }
    get summaryThreshold() {
        return this.summaryTurnThreshold;
    }
    async seedRecentTurns(turns) {
        await this.history.clear();
        for (const turn of turns) {
            await this.history.addMessage(turn.role === "user" ? new HumanMessage(turn.content) : new AIMessage(turn.content));
        }
    }
    async toChatMessages(state) {
        const messages = [new SystemMessage(state.systemPrompt)];
        if (state.summary?.trim()) {
            messages.push(new SystemMessage(`会话摘要：\n${state.summary.trim()}`));
        }
        const stored = await this.history.getMessages();
        messages.push(...stored);
        if (state.currentUserMessage?.trim()) {
            messages.push(new HumanMessage(state.currentUserMessage.trim()));
        }
        return messages;
    }
}
export function createMemoryMessageRunnable(memory) {
    const runnable = RunnableLambda.from((state) => memory.toChatMessages(state));
    return runnable.withConfig({ runName: "mira_memory_to_messages" });
}
//# sourceMappingURL=memory.js.map