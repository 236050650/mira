import { type BaseMessage } from "@langchain/core/messages";
import type { ChatMessage } from "./types.js";
export declare function chatMessageToLangChain(message: ChatMessage): BaseMessage;
export declare function chatMessagesToLangChain(messages: ChatMessage[]): BaseMessage[];
export declare function langChainToChatMessages(messages: BaseMessage[]): ChatMessage[];
//# sourceMappingURL=messages.d.ts.map