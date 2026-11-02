import { randomUUID } from "node:crypto";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const vector = customType<{ data: number[]; driverData: string }>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 512})`;
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
  fromDriver(value: string): number[] {
    if (typeof value === "string") {
      return JSON.parse(value);
    }
    return value as unknown as number[];
  },
});

const id = () => uuid("id").primaryKey().$defaultFn(() => randomUUID());

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  nickname: text("nickname").notNull(),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  status: text("status").notNull().default("active"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex("users_email_uidx").on(t.email),
]);

export const refreshTokens = pgTable("refresh_tokens", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  deviceName: text("device_name"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  ...timestamps,
}, (t) => [
  index("refresh_tokens_user_idx").on(t.userId),
]);

export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  theme: text("theme").notNull().default("light"),
  interests: jsonb("interests").$type<string[]>().notNull().default([]),
  defaultModelProfileId: text("default_model_profile_id").notNull().default("deepseek-flash"),
  locale: text("locale").notNull().default("zh-CN"),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  ...timestamps,
});

export const personas = pgTable("personas", {
  id: id(),
  slug: text("slug").notNull(),
  ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  subtitle: text("subtitle").notNull(),
  bio: text("bio").notNull(),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  avatarUrl: text("avatar_url"),
  coverUrl: text("cover_url"),
  status: text("status").notNull().default("published"),
  isBuiltin: boolean("is_builtin").notNull().default(false),
  currentVersionId: uuid("current_version_id"),
  accent: text("accent"),
  panel: integer("panel"),
  atlas: text("atlas"),
  image: text("image"),
  artTone: text("art_tone"),
  online: boolean("online").notNull().default(true),
  conversationsLabel: text("conversations_label").notNull().default("0"),
  ...timestamps,
}, (t) => [
  uniqueIndex("personas_slug_uidx").on(t.slug),
]);

export const personaVersions = pgTable("persona_versions", {
  id: id(),
  personaId: uuid("persona_id").notNull().references(() => personas.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  greeting: text("greeting").notNull(),
  suggestedReplies: jsonb("suggested_replies").$type<string[]>().notNull().default([]),
  systemPrompt: text("system_prompt").notNull(),
  speakingStyle: jsonb("speaking_style").$type<Record<string, unknown>>().notNull().default({}),
  knowledgeBoundary: jsonb("knowledge_boundary").$type<Record<string, unknown>>().notNull().default({}),
  relationshipPreset: jsonb("relationship_preset").$type<Record<string, unknown>>().notNull().default({}),
  memoryPolicy: jsonb("memory_policy").$type<Record<string, unknown>>().notNull().default({}),
  sourceNotes: jsonb("source_notes").$type<Record<string, unknown> | unknown[]>().notNull().default({}),
  identity: text("identity").notNull().default(""),
  goals: text("goals").notNull().default(""),
  voice: text("voice").notNull().default(""),
  behavior: text("behavior").notNull().default(""),
  worldview: text("worldview").notNull().default(""),
  knowledge: text("knowledge").notNull().default(""),
  examples: jsonb("examples").$type<unknown[]>().notNull().default([]),
  forbiddenExpressions: jsonb("forbidden_expressions").$type<string[]>().notNull().default([]),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex("persona_versions_persona_version_uidx").on(t.personaId, t.version),
  index("persona_versions_persona_idx").on(t.personaId),
]);

export const personaFavorites = pgTable("persona_favorites", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  personaId: uuid("persona_id").notNull().references(() => personas.id, { onDelete: "cascade" }),
  ...timestamps,
}, (t) => [
  uniqueIndex("persona_favorites_user_persona_uidx").on(t.userId, t.personaId),
]);

export const conversations = pgTable("conversations", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  personaId: uuid("persona_id").notNull().references(() => personas.id),
  personaVersionId: uuid("persona_version_id").notNull().references(() => personaVersions.id),
  title: text("title").notNull().default(""),
  preferredModelProfileId: text("preferred_model_profile_id").notNull().default("deepseek-flash"),
  relationshipLevel: integer("relationship_level").notNull().default(0),
  relationshipState: jsonb("relationship_state").$type<Record<string, unknown>>().notNull().default({}),
  summary: text("summary"),
  summaryThroughMessageId: uuid("summary_through_message_id"),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  unreadCount: integer("unread_count").notNull().default(0),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps,
}, (t) => [
  index("conversations_user_last_message_idx").on(t.userId, t.lastMessageAt),
]);

export const messages = pgTable("messages", {
  id: id(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  clientMessageId: text("client_message_id"),
  parentMessageId: uuid("parent_message_id"),
  role: text("role").notNull(),
  content: text("content").notNull().default(""),
  status: text("status").notNull().default("completed"),
  provider: text("provider"),
  model: text("model"),
  modelProfileId: text("model_profile_id"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  finishReason: text("finish_reason"),
  generationId: uuid("generation_id"),
  ...timestamps,
}, (t) => [
  index("messages_conversation_created_idx").on(t.conversationId, t.createdAt),
  uniqueIndex("messages_conversation_client_message_uidx").on(t.conversationId, t.clientMessageId),
]);

export const messageFavorites = pgTable("message_favorites", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  messageId: uuid("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  ...timestamps,
}, (t) => [
  uniqueIndex("message_favorites_user_message_uidx").on(t.userId, t.messageId),
]);

export const memories = pgTable("memories", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  personaId: uuid("persona_id").notNull().references(() => personas.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  sourceMessageId: uuid("source_message_id").references(() => messages.id, { onDelete: "set null" }),
  category: text("category").notNull(),
  content: text("content").notNull(),
  confidence: real("confidence").notNull().default(0.5),
  embeddingKey: text("embedding_key"),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps,
}, (t) => [
  index("memories_user_persona_deleted_idx").on(t.userId, t.personaId, t.deletedAt),
]);

export const modelUsage = pgTable("model_usage", {
  id: id(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  messageId: uuid("message_id").references(() => messages.id, { onDelete: "set null" }),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  estimatedCost: numeric("estimated_cost", { precision: 12, scale: 6 }).notNull().default("0"),
  latencyMs: integer("latency_ms"),
  firstTokenMs: integer("first_token_ms"),
  status: text("status").notNull().default("ok"),
  ...timestamps,
}, (t) => [
  index("model_usage_created_provider_idx").on(t.createdAt, t.provider),
]);

export const retrievalChunks = pgTable("retrieval_chunks", {
  id: id(),
  scope: text("scope").notNull(),
  personaId: uuid("persona_id").notNull().references(() => personas.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "cascade" }),
  sourceId: text("source_id").notNull(),
  content: text("content").notNull(),
  embedding: jsonb("embedding").$type<number[]>().notNull(),
  embeddingVector: vector("embedding_vector", { dimensions: 1024 }),
  embeddingModel: text("embedding_model").notNull(),
  contentHash: text("content_hash").notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex("retrieval_chunks_scope_source_uidx").on(t.scope, t.sourceId),
  index("retrieval_chunks_persona_scope_idx").on(t.personaId, t.scope),
  index("retrieval_chunks_conversation_idx").on(t.conversationId),
]);

export const generations = pgTable("generations", {
  id: id(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assistantMessageId: uuid("assistant_message_id").references(() => messages.id, { onDelete: "set null" }),
  status: text("status").notNull().default("running"),
  stopRequested: boolean("stop_requested").notNull().default(false),
  ...timestamps,
});

export type User = typeof users.$inferSelect;
export type Persona = typeof personas.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
