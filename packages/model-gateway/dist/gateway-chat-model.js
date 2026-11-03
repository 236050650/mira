import { randomUUID } from "node:crypto";
import { AIMessage, AIMessageChunk, } from "@langchain/core/messages";
import { BaseChatModel, } from "@langchain/core/language_models/chat_models";
import { ChatGenerationChunk } from "@langchain/core/outputs";
import { langChainToChatMessages } from "./messages.js";
export class GatewayChatModel extends BaseChatModel {
    provider;
    boundModel;
    defaultMaxOutputTokens;
    defaultThinking;
    constructor(fields) {
        super(fields);
        this.provider = fields.provider;
        this.boundModel = fields.model;
        this.defaultMaxOutputTokens = fields.maxOutputTokens ?? 2048;
        this.defaultThinking = fields.thinking ?? "disabled";
    }
    _llmType() {
        return "mira-gateway";
    }
    async _generate(messages, options, runManager) {
        let text = "";
        let finishReason = "stop";
        let usage;
        for await (const chunk of this._streamResponseChunks(messages, options, runManager)) {
            text += chunk.text ?? "";
            const meta = chunk.message.response_metadata;
            if (meta.finishReason)
                finishReason = meta.finishReason;
            if (meta.usage)
                usage = meta.usage;
        }
        return {
            generations: [
                {
                    text,
                    message: new AIMessage({
                        content: text,
                        response_metadata: { finishReason, usage },
                    }),
                },
            ],
            llmOutput: { finishReason, usage },
        };
    }
    async *_streamResponseChunks(messages, options, runManager) {
        const request = {
            requestId: options.requestId ?? randomUUID(),
            model: this.boundModel,
            messages: langChainToChatMessages(messages),
            maxOutputTokens: options.maxOutputTokens ?? this.defaultMaxOutputTokens,
            thinking: options.thinking ?? this.defaultThinking,
            signal: options.signal,
        };
        for await (const chunk of this.provider.streamChat(request)) {
            if (chunk.type === "content" && chunk.delta) {
                await runManager?.handleLLMNewToken(chunk.delta);
                yield new ChatGenerationChunk({
                    text: chunk.delta,
                    message: new AIMessageChunk({ content: chunk.delta }),
                });
            }
            if (chunk.type === "usage" && chunk.usage) {
                yield new ChatGenerationChunk({
                    text: "",
                    message: new AIMessageChunk({
                        content: "",
                        response_metadata: { usage: chunk.usage },
                    }),
                });
            }
            if (chunk.type === "done") {
                yield new ChatGenerationChunk({
                    text: "",
                    message: new AIMessageChunk({
                        content: "",
                        response_metadata: { finishReason: chunk.finishReason ?? "stop" },
                    }),
                });
            }
            if (chunk.type === "error" && chunk.error) {
                const error = new Error(chunk.error.message);
                error.name = "GatewayChatModelError";
                error.code = chunk.error.code;
                throw error;
            }
        }
    }
    async *streamMiraChatChunks(messages, options) {
        yield* this._streamResponseChunks(messages, options);
    }
}
export function createGatewayChatModel(provider, params) {
    return new GatewayChatModel({
        provider,
        model: params.model,
        maxOutputTokens: params.maxOutputTokens,
        thinking: params.thinking,
    });
}
//# sourceMappingURL=gateway-chat-model.js.map