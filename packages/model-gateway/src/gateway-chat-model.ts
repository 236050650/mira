import { randomUUID } from "node:crypto";
import {
  AIMessage,
  AIMessageChunk,
  type BaseMessage,
} from "@langchain/core/messages";
import {
  BaseChatModel,
  type BaseChatModelCallOptions,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import { ChatGenerationChunk, type ChatResult } from "@langchain/core/outputs";
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import type { ModelProvider } from "./types.js";
import { langChainToChatMessages } from "./messages.js";

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

export class GatewayChatModel extends BaseChatModel<GatewayChatModelCallOptions> {
  private readonly provider: ModelProvider;
  private readonly boundModel: string;
  private readonly defaultMaxOutputTokens: number;
  private readonly defaultThinking: "disabled" | "enabled";

  constructor(fields: GatewayChatModelFields) {
    super(fields);
    this.provider = fields.provider;
    this.boundModel = fields.model;
    this.defaultMaxOutputTokens = fields.maxOutputTokens ?? 2048;
    this.defaultThinking = fields.thinking ?? "disabled";
  }

  override _llmType(): string {
    return "mira-gateway";
  }

  override async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    let text = "";
    let finishReason = "stop";
    let usage:
      | { inputTokens: number; outputTokens: number; totalTokens: number }
      | undefined;

    for await (const chunk of this._streamResponseChunks(messages, options, runManager)) {
      text += chunk.text ?? "";
      const meta = chunk.message.response_metadata as { finishReason?: string; usage?: typeof usage };
      if (meta.finishReason) finishReason = meta.finishReason;
      if (meta.usage) usage = meta.usage;
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

  override async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun,
  ): AsyncGenerator<ChatGenerationChunk> {
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
        (error as Error & { code?: string }).code = chunk.error.code;
        throw error;
      }
    }
  }

  async *streamMiraChatChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
  ): AsyncGenerator<ChatGenerationChunk> {
    yield* this._streamResponseChunks(messages, options);
  }
}

export function createGatewayChatModel(
  provider: ModelProvider,
  params: {
    model: string;
    maxOutputTokens?: number;
    thinking?: "disabled" | "enabled";
  },
): GatewayChatModel {
  return new GatewayChatModel({
    provider,
    model: params.model,
    maxOutputTokens: params.maxOutputTokens,
    thinking: params.thinking,
  });
}
