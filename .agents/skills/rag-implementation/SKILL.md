---
name: rag-implementation
description: Implement robust Retrieval-Augmented Generation for ChromaDB and Postgres.
---

# RAG Implementation Guidelines

## Hybrid Search Strategy
- Pure vector search fails on precise terminology (e.g., specific steel grades or project IDs).
- **Mandatory Mix**: Always combine Dense Vector Search (ChromaDB) with Sparse Keyword Search (PostgreSQL + pg_trgm / BM25).

## Context Window Optimization
- **Chunking**: Break documents down by semantic boundaries (headers, paragraphs), not arbitrary character limits.
- **Reranking**: Use a lightweight Cross-Encoder model locally or via API to rerank the top 20 retrieved chunks down to the top 5 most relevant before feeding to the Agent prompt.
- **Metadata Filtering**: Always use structured filters (Date >= X, Source = Y) before performing exact k-NN vector distance matches to drastically improve speed.
