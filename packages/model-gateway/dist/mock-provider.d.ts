import type { ChatChunk, ChatRequest, HealthResult, ModelDescriptor, ModelProvider } from "./types.js";
export type MockScenario = "ok" | "slow-first-token" | "mid-stream-error" | "rate-limited" | "balance-insufficient" | "timeout" | "empty" | "content-filter";
export type MockProviderOptions = {
    scenario?: MockScenario;
    chunks?: string[];
    firstTokenDelayMs?: number;
    chunkDelayMs?: number;
};
export declare class MockProvider implements ModelProvider {
    readonly id: "mock";
    private scenario;
    private chunks;
    private firstTokenDelayMs;
    private chunkDelayMs;
    constructor(options?: MockProviderOptions);
    setScenario(scenario: MockScenario): void;
    healthCheck(): Promise<HealthResult>;
    listModels(): Promise<ModelDescriptor[]>;
    streamChat(request: ChatRequest): AsyncIterable<ChatChunk>;
}
//# sourceMappingURL=mock-provider.d.ts.map