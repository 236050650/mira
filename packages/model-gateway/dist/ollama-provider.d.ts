import type { ChatChunk, ChatRequest, HealthResult, ModelDescriptor, ModelProvider } from "./types.js";
export type OllamaConfig = {
    baseUrl: string;
    apiKey?: string;
    defaultModel: string;
    timeoutMs: number;
};
/** Prefer native Ollama API so think:false works for qwen3.5. */
export declare class OllamaProvider implements ModelProvider {
    private readonly config;
    readonly id: "ollama";
    constructor(config: OllamaConfig);
    private rootUrl;
    healthCheck(): Promise<HealthResult>;
    listModels(): Promise<ModelDescriptor[]>;
    streamChat(request: ChatRequest): AsyncIterable<ChatChunk>;
}
export declare function createOllamaProvider(env: {
    apiKey: string;
    baseUrl: string;
    defaultModel: string;
    timeoutMs: number;
}): OllamaProvider;
//# sourceMappingURL=ollama-provider.d.ts.map