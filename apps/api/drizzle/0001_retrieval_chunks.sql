CREATE TABLE IF NOT EXISTS "retrieval_chunks" (
  "id" uuid PRIMARY KEY NOT NULL,
  "scope" text NOT NULL,
  "persona_id" uuid NOT NULL REFERENCES "personas"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
  "conversation_id" uuid REFERENCES "conversations"("id") ON DELETE CASCADE,
  "source_id" text NOT NULL,
  "content" text NOT NULL,
  "embedding" jsonb NOT NULL,
  "embedding_model" text NOT NULL,
  "content_hash" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "retrieval_chunks_scope_source_uidx" ON "retrieval_chunks" USING btree ("scope", "source_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "retrieval_chunks_persona_scope_idx" ON "retrieval_chunks" USING btree ("persona_id", "scope");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "retrieval_chunks_conversation_idx" ON "retrieval_chunks" USING btree ("conversation_id");
