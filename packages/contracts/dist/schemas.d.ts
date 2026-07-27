import { z } from "zod";
export declare const PersonaCategorySchema: z.ZodEnum<["中国历史", "思想家", "军事家", "动漫角色", "原创角色", "历史人物"]>;
export declare const ModelProfileIdSchema: z.ZodEnum<["auto", "deepseek-flash", "deepseek-pro", "ollama-local"]>;
export declare const ThemeSchema: z.ZodEnum<["light", "dark", "system"]>;
export declare const RegisterRequestSchema: z.ZodObject<{
    email: z.ZodString;
    nickname: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    nickname: string;
    password: string;
}, {
    email: string;
    nickname: string;
    password: string;
}>;
export declare const LoginRequestSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const RefreshRequestSchema: z.ZodObject<{
    refreshToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    refreshToken: string;
}, {
    refreshToken: string;
}>;
export declare const OnboardingInterestsSchema: z.ZodObject<{
    interests: z.ZodOptional<z.ZodArray<z.ZodEnum<["中国历史", "军事谋略", "思想对谈", "动漫伙伴", "原创角色", "剧情冒险"]>, "many">>;
    skipped: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    interests?: ("中国历史" | "原创角色" | "军事谋略" | "思想对谈" | "动漫伙伴" | "剧情冒险")[] | undefined;
    skipped?: boolean | undefined;
}, {
    interests?: ("中国历史" | "原创角色" | "军事谋略" | "思想对谈" | "动漫伙伴" | "剧情冒险")[] | undefined;
    skipped?: boolean | undefined;
}>;
export declare const CreateConversationSchema: z.ZodObject<{
    personaId: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    modelProfileId: z.ZodOptional<z.ZodEnum<["auto", "deepseek-flash", "deepseek-pro", "ollama-local"]>>;
}, "strip", z.ZodTypeAny, {
    personaId: string;
    title?: string | undefined;
    modelProfileId?: "auto" | "deepseek-flash" | "deepseek-pro" | "ollama-local" | undefined;
}, {
    personaId: string;
    title?: string | undefined;
    modelProfileId?: "auto" | "deepseek-flash" | "deepseek-pro" | "ollama-local" | undefined;
}>;
export declare const StreamMessageSchema: z.ZodObject<{
    clientMessageId: z.ZodString;
    content: z.ZodString;
    modelProfileId: z.ZodOptional<z.ZodEnum<["auto", "deepseek-flash", "deepseek-pro", "ollama-local"]>>;
}, "strip", z.ZodTypeAny, {
    clientMessageId: string;
    content: string;
    modelProfileId?: "auto" | "deepseek-flash" | "deepseek-pro" | "ollama-local" | undefined;
}, {
    clientMessageId: string;
    content: string;
    modelProfileId?: "auto" | "deepseek-flash" | "deepseek-pro" | "ollama-local" | undefined;
}>;
export declare const CreatePersonaSchema: z.ZodObject<{
    name: z.ZodString;
    subtitle: z.ZodString;
    bio: z.ZodString;
    tags: z.ZodArray<z.ZodString, "many">;
    greeting: z.ZodString;
    suggestedReplies: z.ZodArray<z.ZodString, "many">;
    speakingStyle: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    knowledgeBoundary: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    relationshipPreset: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    memoryPolicy: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    systemPrompt: z.ZodString;
    avatarUrl: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    coverUrl: z.ZodOptional<z.ZodString>;
    category: z.ZodDefault<z.ZodLiteral<"原创角色">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    subtitle: string;
    bio: string;
    tags: string[];
    greeting: string;
    suggestedReplies: string[];
    systemPrompt: string;
    category: "原创角色";
    speakingStyle?: Record<string, unknown> | undefined;
    knowledgeBoundary?: Record<string, unknown> | undefined;
    relationshipPreset?: Record<string, unknown> | undefined;
    memoryPolicy?: Record<string, unknown> | undefined;
    avatarUrl?: string | undefined;
    coverUrl?: string | undefined;
}, {
    name: string;
    subtitle: string;
    bio: string;
    tags: string[];
    greeting: string;
    suggestedReplies: string[];
    systemPrompt: string;
    speakingStyle?: Record<string, unknown> | undefined;
    knowledgeBoundary?: Record<string, unknown> | undefined;
    relationshipPreset?: Record<string, unknown> | undefined;
    memoryPolicy?: Record<string, unknown> | undefined;
    avatarUrl?: string | undefined;
    coverUrl?: string | undefined;
    category?: "原创角色" | undefined;
}>;
export declare const UpdateMemorySchema: z.ZodObject<{
    content: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    content?: string | undefined;
    category?: string | undefined;
}, {
    content?: string | undefined;
    category?: string | undefined;
}>;
export declare const UpdatePreferencesSchema: z.ZodObject<{
    theme: z.ZodOptional<z.ZodEnum<["light", "dark", "system"]>>;
    interests: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    defaultModelProfileId: z.ZodOptional<z.ZodEnum<["auto", "deepseek-flash", "deepseek-pro", "ollama-local"]>>;
    nickname: z.ZodOptional<z.ZodString>;
    bio: z.ZodOptional<z.ZodString>;
    avatarUrl: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    nickname?: string | undefined;
    interests?: string[] | undefined;
    bio?: string | undefined;
    avatarUrl?: string | null | undefined;
    theme?: "light" | "dark" | "system" | undefined;
    defaultModelProfileId?: "auto" | "deepseek-flash" | "deepseek-pro" | "ollama-local" | undefined;
}, {
    nickname?: string | undefined;
    interests?: string[] | undefined;
    bio?: string | undefined;
    avatarUrl?: string | null | undefined;
    theme?: "light" | "dark" | "system" | undefined;
    defaultModelProfileId?: "auto" | "deepseek-flash" | "deepseek-pro" | "ollama-local" | undefined;
}>;
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type StreamMessageRequest = z.infer<typeof StreamMessageSchema>;
export type ModelProfileId = z.infer<typeof ModelProfileIdSchema>;
//# sourceMappingURL=schemas.d.ts.map