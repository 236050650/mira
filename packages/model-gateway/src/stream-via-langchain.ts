import type { ChatChunk, ChatMessage, ChatRequest, ModelProvider } from "./types.js";
import { chatMessagesToLangChain } from "./messages.js";
import { createGatewayChatModel } from "./gateway-chat-model.js";

function isGatewayError(error: unknown): error is Error & { code?: string } {
  return error instanceof Error && error.name === "GatewayChatModelError";
}

/**
 * Stream chat through LangChain message types while preserving MIRA {@link ChatChunk} events.
 */
export async function* streamChatViaLangChain(
  provider: ModelProvider,
  request: ChatRequest,
): AsyncIterable<ChatChunk> {
  const chatModel = createGatewayChatModel(provider, {
    model: request.model,
    maxOutputTokens: request.maxOutputTokens,
    thinking: request.thinking,
  });

  try {
    const stream = chatModel.streamMiraChatChunks(chatMessagesToLangChain(request.messages), {
      requestId: request.requestId,
      maxOutputTokens: request.maxOutputTokens,
      thinking: request.thinking,
      signal: request.signal,
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        yield { type: "content", delta: chunk.text };
      }

      const metadata = chunk.message.response_metadata as {
        usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
        finishReason?: string;
      };
      const usage = metadata.usage;
      if (usage?.totalTokens) {
        yield { type: "usage", usage };
      }

      const finishReason = metadata.finishReason;
      if (finishReason) {
        yield { type: "done", finishReason };
      }
    }
  } catch (error) {
    if (isGatewayError(error)) {
      yield {
        type: "error",
        error: { code: error.code ?? "MODEL_UNAVAILABLE", message: error.message },
      };
      return;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }
    yield {
      type: "error",
      error: {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "模型请求失败",
      },
    };
  }
}

export function buildLangChainMessagesFromChat(messages: ChatMessage[]) {
  return chatMessagesToLangChain(messages);
}
