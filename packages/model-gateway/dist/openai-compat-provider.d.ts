import type { ChatChunk, ChatRequest, HealthResult, ModelDescriptor, ModelProvider } from "./types.js";
export type OpenAICompatConfig = {
    providerId: "deepseek" | "ollama";
    baseUrl: string;
    apiKey: string;
    defaultModel: string;
    timeoutMs: number;
    displayName: string;
};
export declare class OpenAICompatProvider implements ModelProvider {
    readonly id: "deepseek" | "ollama";
    private readonly config;
    constructor(config: OpenAICompatConfig);
    healthCheck(): Promise<HealthResult>;
    listModels(): Promise<ModelDescriptor[]>;
    streamChat(request: ChatRequest): AsyncIterable<ChatChunk>;
}
export declare function createDeepSeekProvider(env: {
    apiKey: string;
    baseUrl: string;
    defaultModel: string;
    timeoutMs: number;
}): OpenAICompatProvider;
//# sourceMappingURL=openai-compat-provider.d.ts.map