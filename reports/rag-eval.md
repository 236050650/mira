# RAG Retrieval Evaluation Report

Generated: 2026-11-02T11:47:26.862Z

## Metrics (Hash Embeddings, 512-d)

| Metric | Value |
|--------|-------|
| Total Queries | 16 |
| Queries with Expected Answers | 13 |
| Hit@3 | 7/13 |
| Hit Rate | 53.8% |
| MRR | 0.500 |

## Category Breakdown

| Category | Queries | Hit@3 | Hit Rate |
|----------|---------|-------|----------|
| knowledge | 10 | 4 | 40.0% |
| boundary | 3 | 3 | 100.0% |
| hard | 0 | 0 | N/A% |

## Evaluation Design

- **Total questions**: 16 across 4 personas (霍去病, 孔子, 王阳明, 李白)
- **Query style**: Paraphrased questions that don't match source text verbatim
- **Categories**:
  - **knowledge**: Questions answerable from persona knowledge chunks
  - **boundary**: Questions about uncertainty/limitations marked in knowledgeBoundary
  - **hard**: Distractor questions outside persona scope (no expected answer)
- **Ranking**: Retrieval uses Top-3 candidates, scored by cosine similarity

## Results by Persona

### 霍去病

- Questions: 4 (3 with expected answers)
- Hit@3: 2/3 (66.7%)
- MRR: 0.500

### 孔子

- Questions: 4 (3 with expected answers)
- Hit@3: 2/3 (66.7%)
- MRR: 0.667

### 王阳明

- Questions: 4 (4 with expected answers)
- Hit@3: 2/4 (50.0%)
- MRR: 0.500

### 李白

- Questions: 4 (3 with expected answers)
- Hit@3: 1/3 (33.3%)
- MRR: 0.333

## Notes

- Evaluation uses **hash embeddings (512-d)** for deterministic testing
- **bge-m3 (1024-d)** eval requires running Ollama locally (not automated)
- Queries are **paraphrased** to test semantic understanding, not keyword matching
- **Hard/distractor questions** test boundary detection (should return no results)
- Hit@k: Measures if expected source appears in top-k results
- MRR (Mean Reciprocal Rank): Measures ranking quality (1.0 = always rank 1)
