import { type BaseMessage } from "@langchain/core/messages";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { type Runnable } from "@langchain/core/runnables";
export type ConversationTurn = {
    role: "user" | "assistant";
    content: string;
};
export type MiraMemoryState = {
    summary?: string | null;
    recentTurns: ConversationTurn[];
    systemPrompt: string;
    currentUserMessage?: string;
};
export declare const SUMMARY_COMPRESSION_THRESHOLD = 12;
export declare class MiraConversationMemory {
    private readonly summaryTurnThreshold;
    readonly history: InMemoryChatMessageHistory;
    constructor(summaryTurnThreshold?: number);
    get summaryThreshold(): number;
    seedRecentTurns(turns: ConversationTurn[]): Promise<void>;
    toChatMessages(state: MiraMemoryState): Promise<BaseMessage[]>;
}
export declare function createMemoryMessageRunnable(memory: MiraConversationMemory): Runnable<MiraMemoryState, BaseMessage[]>;
//# sourceMappingURL=memory.d.ts.map