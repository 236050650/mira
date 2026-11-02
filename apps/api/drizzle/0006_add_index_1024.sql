CREATE INDEX IF NOT EXISTS idx_retrieval_chunks_vector_1024_cosine ON retrieval_chunks USING hnsw (embedding_vector_1024 vector_cosine_ops) WHERE embedding_vector_1024 IS NOT NULL;
