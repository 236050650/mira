import type { ProviderId } from "@mira/contracts";
import { MockProvider } from "./mock-provider.js";
import type { ModelProvider } from "./types.js";
export type ModelMode = "mock" | "local" | "remote";
export type GatewayEnv = {
    mode: ModelMode;
    deepseekApiKey?: string;
    deepseekBaseUrl: string;
    deepseekDefaultModel: string;
    ollamaBaseUrl: string;
    ollamaApiKey: string;
    ollamaDefaultModel: string;
    timeoutMs: number;
    dailyRemoteTokenBudget: number;
};
export declare class ModelGateway {
    private readonly providers;
    readonly mode: ModelMode;
    readonly dailyRemoteTokenBudget: number;
    private remoteTokensUsed;
    constructor(env: GatewayEnv);
    getProvider(id: ProviderId): ModelProvider;
    getMock(): MockProvider;
    /** Test/dev helper to swap a provider implementation. */
    setProvider(id: ProviderId, provider: ModelProvider): void;
    resolveProviderForMode(preferred: ProviderId): ModelProvider;
    getRemoteTokensUsed(): number;
    addRemoteUsage(totalTokens: number): void;
    resetDailyBudget(): void;
    canUseRemote(estimated?: number): boolean;
}
export declare function createGatewayFromEnv(processEnv: NodeJS.ProcessEnv): ModelGateway;
//# sourceMappingURL=gateway.d.ts.map