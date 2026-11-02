CREATE INDEX IF NOT EXISTS idx_retrieval_chunks_vector_512_cosine ON retrieval_chunks USING hnsw (embedding_vector_512 vector_cosine_ops) WHERE embedding_vector_512 IS NOT NULL;
