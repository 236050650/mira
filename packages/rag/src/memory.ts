import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { RunnableLambda, type Runnable } from "@langchain/core/runnables";

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

export const SUMMARY_COMPRESSION_THRESHOLD = 12;

export class MiraConversationMemory {
  readonly history = new InMemoryChatMessageHistory();

  constructor(private readonly summaryTurnThreshold = SUMMARY_COMPRESSION_THRESHOLD) {}

  get summaryThreshold(): number {
    return this.summaryTurnThreshold;
  }

  async seedRecentTurns(turns: ConversationTurn[]): Promise<void> {
    await this.history.clear();
    for (const turn of turns) {
      await this.history.addMessage(
        turn.role === "user" ? new HumanMessage(turn.content) : new AIMessage(turn.content),
      );
    }
  }

  async toChatMessages(state: MiraMemoryState): Promise<BaseMessage[]> {
    const messages: BaseMessage[] = [new SystemMessage(state.systemPrompt)];
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

export function createMemoryMessageRunnable(
  memory: MiraConversationMemory,
): Runnable<MiraMemoryState, BaseMessage[]> {
  const runnable = RunnableLambda.from((state: MiraMemoryState) => memory.toChatMessages(state));
  return runnable.withConfig({ runName: "mira_memory_to_messages" }) as Runnable<
    MiraMemoryState,
    BaseMessage[]
  >;
}
