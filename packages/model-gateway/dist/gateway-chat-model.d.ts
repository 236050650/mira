import { type BaseMessage } from "@langchain/core/messages";
import { BaseChatModel, type BaseChatModelCallOptions, type BaseChatModelParams } from "@langchain/core/language_models/chat_models";
import { ChatGenerationChunk, type ChatResult } from "@langchain/core/outputs";
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import type { ModelProvider } from "./types.js";
export type GatewayChatModelCallOptions = BaseChatModelCallOptions & {
    requestId?: string;
    maxOutputTokens?: number;
    thinking?: "disabled" | "enabled";
};
export type GatewayChatModelFields = BaseChatModelParams & {
    provider: ModelProvider;
    model: string;
    maxOutputTokens?: number;
    thinking?: "disabled" | "enabled";
};
export declare class GatewayChatModel extends BaseChatModel<GatewayChatModelCallOptions> {
    private readonly provider;
    private readonly boundModel;
    private readonly defaultMaxOutputTokens;
    private readonly defaultThinking;
    constructor(fields: GatewayChatModelFields);
    _llmType(): string;
    _generate(messages: BaseMessage[], options: this["ParsedCallOptions"], runManager?: CallbackManagerForLLMRun): Promise<ChatResult>;
    _streamResponseChunks(messages: BaseMessage[], options: this["ParsedCallOptions"], runManager?: CallbackManagerForLLMRun): AsyncGenerator<ChatGenerationChunk>;
    streamMiraChatChunks(messages: BaseMessage[], options: this["ParsedCallOptions"]): AsyncGenerator<ChatGenerationChunk>;
}
export declare function createGatewayChatModel(provider: ModelProvider, params: {
    model: string;
    maxOutputTokens?: number;
    thinking?: "disabled" | "enabled";
}): GatewayChatModel;
//# sourceMappingURL=gateway-chat-model.d.ts.map