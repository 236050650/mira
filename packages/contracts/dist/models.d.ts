export type ProviderId = "deepseek" | "ollama" | "mock";
export type ModelProfile = {
    id: "auto" | "deepseek-flash" | "deepseek-pro" | "ollama-local";
    provider: ProviderId;
    model: string;
    thinking: "disabled" | "enabled";
    maxOutputTokens: number;
    displayName: string;
};
export declare const MODEL_PROFILES: Record<Exclude<ModelProfile["id"], "auto">, Omit<ModelProfile, "id"> & {
    id: Exclude<ModelProfile["id"], "auto">;
}>;
export declare function resolveModelProfile(profileId: ModelProfile["id"] | undefined, envDefaultModel?: string): Omit<ModelProfile, "id"> & {
    id: Exclude<ModelProfile["id"], "auto">;
};
//# sourceMappingURL=models.d.ts.map