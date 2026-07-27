import type { ProviderId } from "@mira/contracts";
export type { ProviderId };
export interface ModelDescriptor {
    provider: ProviderId;
    id: string;
    displayName: string;
    supportsStreaming: boolean;
    supportsThinking: boolean;
    available: boolean;
}
export interface ChatMessage {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
}
export interface ChatRequest {
    requestId: string;
    model: string;
    messages: ChatMessage[];
    maxOutputTokens: number;
    thinking: "disabled" | "enabled";
    signal?: AbortSignal;
}
export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
}
export interface ChatChunk {
    type: "content" | "reasoning" | "usage" | "done" | "error";
    delta?: string;
    usage?: TokenUsage;
    finishReason?: string;
    error?: {
        code: string;
        message: string;
    };
}
export interface HealthResult {
    ok: boolean;
    detail?: string;
    latencyMs?: number;
}
export interface ModelProvider {
    id: ProviderId;
    healthCheck(): Promise<HealthResult>;
    listModels(): Promise<ModelDescriptor[]>;
    streamChat(request: ChatRequest): AsyncIterable<ChatChunk>;
}
//# sourceMappingURL=types.d.ts.map