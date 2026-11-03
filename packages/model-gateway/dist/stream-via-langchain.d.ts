import type { ChatChunk, ChatMessage, ChatRequest, ModelProvider } from "./types.js";
/**
 * Stream chat through LangChain message types while preserving MIRA {@link ChatChunk} events.
 */
export declare function streamChatViaLangChain(provider: ModelProvider, request: ChatRequest): AsyncIterable<ChatChunk>;
export declare function buildLangChainMessagesFromChat(messages: ChatMessage[]): import("@langchain/core/messages").BaseMessage<import("@langchain/core/messages").MessageStructure<import("@langchain/core/messages").MessageToolSet>, import("@langchain/core/messages").MessageType>[];
//# sourceMappingURL=stream-via-langchain.d.ts.map