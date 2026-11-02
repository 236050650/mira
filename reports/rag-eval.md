# RAG Retrieval Evaluation Report

Generated: 2026-11-02T10:50:10.606Z

## Metrics

| Embedding Model | Total Queries | Hit@3 | Hit Rate | MRR |
|-----------------|---------------|-------|----------|-----|
| Hash (512-d)    | 20 | 20 | 100.0% | 1.000 |

## Evaluation Set

Total of 20 questions across 6 personas:

- **霍去病**: 3 questions
- **孔子**: 3 questions
- **王阳明**: 4 questions
- **皮卡丘**: 3 questions
- **爱因斯坦**: 4 questions
- **李白**: 3 questions

## Category Breakdown

| Category | Questions | Hit@3 | Hit Rate |
|----------|-----------|-------|----------|
| knowledge | 16 | 16 | 100.0% |
| boundary | 4 | 4 | 100.0% |

## Results by Persona

### 霍去病

- Questions: 3
- Hit@3: 3/3 (100.0%)
- MRR: 1.000

### 孔子

- Questions: 3
- Hit@3: 3/3 (100.0%)
- MRR: 1.000

### 王阳明

- Questions: 4
- Hit@3: 4/4 (100.0%)
- MRR: 1.000

### 皮卡丘

- Questions: 3
- Hit@3: 3/3 (100.0%)
- MRR: 1.000

### 爱因斯坦

- Questions: 4
- Hit@3: 4/4 (100.0%)
- MRR: 1.000

### 李白

- Questions: 3
- Hit@3: 3/3 (100.0%)
- MRR: 1.000

## Notes

- Evaluation uses hash embeddings (512-d) for fast testing
- Real deployments should use bge-m3 (1024-d) for better accuracy
- Hit@k measures if expected source appears in top k results
- MRR (Mean Reciprocal Rank) measures ranking quality
- Categories: knowledge (factual), boundary (uncertainty markers)
