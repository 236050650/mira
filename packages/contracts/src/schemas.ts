import { z } from "zod";

export const PersonaCategorySchema = z.enum([
  "中国历史",
  "思想家",
  "军事家",
  "动漫角色",
  "原创角色",
  "历史人物",
]);

export const ModelProfileIdSchema = z.enum([
  "auto",
  "deepseek-flash",
  "deepseek-pro",
  "ollama-local",
]);

export const ThemeSchema = z.enum(["light", "dark", "system"]);

export const RegisterRequestSchema = z.object({
  email: z.string().email("请输入有效邮箱"),
  nickname: z.string().min(1, "昵称不能为空").max(32, "昵称过长"),
  password: z
    .string()
    .min(8, "密码至少 8 位")
    .regex(/[A-Za-z]/, "密码必须包含字母")
    .regex(/[0-9]/, "密码必须包含数字"),
});

export const LoginRequestSchema = z.object({
  email: z.string().email("请输入有效邮箱"),
  password: z.string().min(1, "请输入密码"),
});

export const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
});

export const OnboardingInterestsSchema = z.object({
  interests: z
    .array(
      z.enum([
        "中国历史",
        "军事谋略",
        "思想对谈",
        "动漫伙伴",
        "原创角色",
        "剧情冒险",
      ]),
    )
    .min(1, "至少选择一个兴趣")
    .optional(),
  skipped: z.boolean().optional(),
});

export const CreateConversationSchema = z.object({
  personaId: z.string().uuid(),
  title: z.string().max(80).optional(),
  modelProfileId: ModelProfileIdSchema.optional(),
});

export const StreamMessageSchema = z.object({
  clientMessageId: z.string().uuid(),
  content: z.string().min(1).max(8000),
  modelProfileId: ModelProfileIdSchema.optional(),
});

export const CreatePersonaSchema = z.object({
  name: z.string().min(1).max(40),
  subtitle: z.string().min(1).max(80),
  bio: z.string().min(1).max(2000),
  tags: z.array(z.string().max(20)).max(12),
  greeting: z.string().min(1).max(500),
  suggestedReplies: z.array(z.string().max(80)).min(3).max(8),
  speakingStyle: z.record(z.unknown()).optional(),
  knowledgeBoundary: z.record(z.unknown()).optional(),
  relationshipPreset: z.record(z.unknown()).optional(),
  memoryPolicy: z.record(z.unknown()).optional(),
  systemPrompt: z.string().min(1).max(12000),
  avatarUrl: z
    .string()
    .max(2_800_000, "头像文件过大")
    .refine(
      (value) => /^https?:\/\//.test(value) || /^data:image\/(png|jpe?g|webp);base64,/.test(value),
      "头像必须是图片地址或上传的图片",
    )
    .optional(),
  coverUrl: z.string().url().optional(),
  category: z.literal("原创角色").default("原创角色"),
});

export const UpdateMemorySchema = z.object({
  content: z.string().min(1).max(2000).optional(),
  category: z.string().max(40).optional(),
});

export const UpdatePreferencesSchema = z.object({
  theme: ThemeSchema.optional(),
  interests: z.array(z.string()).optional(),
  defaultModelProfileId: ModelProfileIdSchema.optional(),
  nickname: z.string().min(1).max(32).optional(),
  bio: z.string().max(200).optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type StreamMessageRequest = z.infer<typeof StreamMessageSchema>;
export type ModelProfileId = z.infer<typeof ModelProfileIdSchema>;
