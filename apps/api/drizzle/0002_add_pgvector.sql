-- Enable pgvector extension (for postgres; PGlite loads it via client)
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
-- Add vector column to retrieval_chunks
ALTER TABLE "retrieval_chunks" ADD COLUMN "embedding_vector" vector(1024);
--> statement-breakpoint
-- Create HNSW index for efficient vector similarity search
-- m=16 efConstruction=64 are balanced defaults for cosine distance
CREATE INDEX IF NOT EXISTS "retrieval_chunks_embedding_vector_idx" 
ON "retrieval_chunks" USING hnsw ("embedding_vector" vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);
