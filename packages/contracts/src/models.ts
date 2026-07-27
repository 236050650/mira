export type ProviderId = "deepseek" | "ollama" | "mock";

export type ModelProfile = {
  id: "auto" | "deepseek-flash" | "deepseek-pro" | "ollama-local";
  provider: ProviderId;
  model: string;
  thinking: "disabled" | "enabled";
  maxOutputTokens: number;
  displayName: string;
};

export const MODEL_PROFILES: Record<Exclude<ModelProfile["id"], "auto">, Omit<ModelProfile, "id"> & { id: Exclude<ModelProfile["id"], "auto"> }> = {
  "deepseek-flash": {
    id: "deepseek-flash",
    provider: "deepseek",
    model: "deepseek-v4-flash",
    thinking: "disabled",
    maxOutputTokens: 800,
    displayName: "DeepSeek V4 Flash",
  },
  "deepseek-pro": {
    id: "deepseek-pro",
    provider: "deepseek",
    model: "deepseek-v4-pro",
    thinking: "disabled",
    maxOutputTokens: 1200,
    displayName: "DeepSeek V4 Pro",
  },
  "ollama-local": {
    id: "ollama-local",
    provider: "ollama",
    model: "qwen3.5:latest",
    thinking: "disabled",
    maxOutputTokens: 800,
    displayName: "本地 Ollama",
  },
};

export function resolveModelProfile(
  profileId: ModelProfile["id"] | undefined,
  envDefaultModel?: string,
): Omit<ModelProfile, "id"> & { id: Exclude<ModelProfile["id"], "auto"> } {
  if (!profileId || profileId === "auto") {
    return MODEL_PROFILES["deepseek-flash"];
  }
  const profile = MODEL_PROFILES[profileId];
  if (!profile) {
    throw new Error(`MODEL_PROFILE_INVALID:${profileId}`);
  }
  if (profile.id === "ollama-local" && envDefaultModel) {
    return { ...profile, model: envDefaultModel };
  }
  return profile;
}
