import { type ModelProfile, type ProviderId } from "@mira/contracts";
import { MockProvider } from "./mock-provider.js";
import type { ModelProvider } from "./types.js";
export type ModelMode = "mock" | "local" | "remote";
export declare function parseModelMode(value?: string): ModelMode;
export type GatewayEnv = {
    mode: ModelMode;
    deepseekApiKey?: string;
    deepseekBaseUrl: string;
    deepseekDefaultModel: string;
    deepseekPremiumModel?: string;
    ollamaBaseUrl: string;
    ollamaApiKey: string;
    ollamaDefaultModel: string;
    timeoutMs: number;
    dailyRemoteTokenBudget: number;
};
export declare class ModelGateway {
    private readonly env;
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
    /** Resolve the provider and model together so mode overrides cannot split them. */
    resolveProfile(profileId?: ModelProfile["id"]): ModelProfile;
    getRemoteTokensUsed(): number;
    addRemoteUsage(totalTokens: number): void;
    resetDailyBudget(): void;
    canUseRemote(estimated?: number): boolean;
}
export declare function createGatewayFromEnv(processEnv: NodeJS.ProcessEnv): ModelGateway;
//# sourceMappingURL=gateway.d.ts.map