CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "password_hash" text NOT NULL,
  "nickname" text NOT NULL,
  "avatar_url" text,
  "bio" text,
  "status" text DEFAULT 'active' NOT NULL,
  "email_verified_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_uidx" ON "users" USING btree ("email");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "device_name" text,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_preferences" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "theme" text DEFAULT 'light' NOT NULL,
  "interests" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "default_model_profile_id" text DEFAULT 'deepseek-flash' NOT NULL,
  "locale" text DEFAULT 'zh-CN' NOT NULL,
  "onboarding_completed" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "personas" (
  "id" uuid PRIMARY KEY NOT NULL,
  "slug" text NOT NULL,
  "owner_user_id" uuid,
  "name" text NOT NULL,
  "category" text NOT NULL,
  "subtitle" text NOT NULL,
  "bio" text NOT NULL,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "avatar_url" text,
  "cover_url" text,
  "status" text DEFAULT 'published' NOT NULL,
  "is_builtin" boolean DEFAULT false NOT NULL,
  "current_version_id" uuid,
  "accent" text,
  "panel" integer,
  "atlas" text,
  "image" text,
  "art_tone" text,
  "online" boolean DEFAULT true NOT NULL,
  "conversations_label" text DEFAULT '0' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "personas_slug_uidx" ON "personas" USING btree ("slug");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "persona_versions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "persona_id" uuid NOT NULL,
  "version" integer NOT NULL,
  "greeting" text NOT NULL,
  "suggested_replies" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "system_prompt" text NOT NULL,
  "speaking_style" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "knowledge_boundary" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "relationship_preset" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "memory_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "source_notes" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "identity" text DEFAULT '' NOT NULL,
  "goals" text DEFAULT '' NOT NULL,
  "voice" text DEFAULT '' NOT NULL,
  "behavior" text DEFAULT '' NOT NULL,
  "worldview" text DEFAULT '' NOT NULL,
  "knowledge" text DEFAULT '' NOT NULL,
  "examples" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "forbidden_expressions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "persona_versions_persona_version_uidx" ON "persona_versions" USING btree ("persona_id","version");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "persona_versions_persona_idx" ON "persona_versions" USING btree ("persona_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "persona_favorites" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "persona_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "persona_favorites_user_persona_uidx" ON "persona_favorites" USING btree ("user_id","persona_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversations" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "persona_id" uuid NOT NULL,
  "persona_version_id" uuid NOT NULL,
  "title" text DEFAULT '' NOT NULL,
  "preferred_model_profile_id" text DEFAULT 'deepseek-flash' NOT NULL,
  "relationship_level" integer DEFAULT 0 NOT NULL,
  "relationship_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "summary" text,
  "summary_through_message_id" uuid,
  "last_message_at" timestamp with time zone,
  "unread_count" integer DEFAULT 0 NOT NULL,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_user_last_message_idx" ON "conversations" USING btree ("user_id","last_message_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
  "id" uuid PRIMARY KEY NOT NULL,
  "conversation_id" uuid NOT NULL,
  "client_message_id" text,
  "parent_message_id" uuid,
  "role" text NOT NULL,
  "content" text DEFAULT '' NOT NULL,
  "status" text DEFAULT 'completed' NOT NULL,
  "provider" text,
  "model" text,
  "model_profile_id" text,
  "input_tokens" integer,
  "output_tokens" integer,
  "finish_reason" text,
  "generation_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_conversation_created_idx" ON "messages" USING btree ("conversation_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "messages_conversation_client_message_uidx" ON "messages" USING btree ("conversation_id","client_message_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "message_favorites" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "message_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "message_favorites_user_message_uidx" ON "message_favorites" USING btree ("user_id","message_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memories" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "persona_id" uuid NOT NULL,
  "conversation_id" uuid,
  "source_message_id" uuid,
  "category" text NOT NULL,
  "content" text NOT NULL,
  "confidence" real DEFAULT 0.5 NOT NULL,
  "embedding_key" text,
  "last_used_at" timestamp with time zone,
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memories_user_persona_deleted_idx" ON "memories" USING btree ("user_id","persona_id","deleted_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "model_usage" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid,
  "conversation_id" uuid,
  "message_id" uuid,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "input_tokens" integer DEFAULT 0 NOT NULL,
  "output_tokens" integer DEFAULT 0 NOT NULL,
  "estimated_cost" numeric(12, 6) DEFAULT '0' NOT NULL,
  "latency_ms" integer,
  "first_token_ms" integer,
  "status" text DEFAULT 'ok' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "model_usage_created_provider_idx" ON "model_usage" USING btree ("created_at","provider");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "generations" (
  "id" uuid PRIMARY KEY NOT NULL,
  "conversation_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "assistant_message_id" uuid,
  "status" text DEFAULT 'running' NOT NULL,
  "stop_requested" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
