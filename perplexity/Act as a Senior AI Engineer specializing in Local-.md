<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Act as a Senior AI Engineer specializing in Local-First applications. I am building a PWA with local-first vector embeddings (using Transformers.js + pgvector). I need a blueprint for an 'Intelligent RAG System' that runs entirely in the browser/client.

How to implement 'Hybrid Search' (combining semantic vector similarity with BM25/FTS) to ensure high-recall search results?
How to architect a 'Context Window Manager' for the LLM that dynamically truncates/summarizes notes so I don't hit token limits while maintaining context accuracy?
Provide a strategy for 'Re-ranking' results locally after vector search to filter out noise. Give me a detailed architectural flow: from indexing a note to feeding it into the LLM prompt

Here’s a browser-first blueprint for an **intelligent local RAG** pipeline that fits your SmartNotes architecture: notes are already queued for AI analysis, embeddings are stored for future hybrid search, and the system is designed around local persistence and sequential processing. The core idea is to run retrieval in three layers—BM25/FTS for exact recall, vector search for semantic recall, and local reranking for precision—then feed only the smallest high-value context into the LLM.[^1][^2]

## Target architecture

1. **Ingest + normalize note text.**
When a note is saved, generate a clean retrieval text from title, body, tags, and metadata, then chunk it into stable segments for indexing. Your existing analysis pipeline already extracts tags, summaries, and embeddings, so this step can hook into that same background queue.[^2][^1]
2. **Create dual indexes.**
Store each note chunk in pgvector for semantic similarity and also in an FTS/BM25 index for lexical recall. If you want this fully browser-first, keep a local FTS index in IndexedDB or a WASM search engine, and sync the same rows to pgvector when connected.[^1][^2]
3. **Query both indexes in parallel.**
On search, run a lexical query and an embedding query at the same time, then merge results by note/chunk ID. This gives you high recall because exact terms, abbreviations, entities, and paraphrases are all covered.[^2]
4. **Re-rank locally.**
After unioning candidates, compute a lightweight final score using vector similarity, BM25 score, title/tag boosts, recency, and duplicate penalties. Then pass only the top N chunks into the context builder.[^2]

## Hybrid search design

Use hybrid search as a two-stage recall system, not a single blended score. BM25/FTS should catch literal matches like names, error codes, and quoted phrases, while embeddings should catch concept matches like “onboarding issues” vs “first-run friction”.[^2]

A practical local scoring formula is:

$$
score = 0.45 \cdot semantic + 0.35 \cdot lexical + 0.10 \cdot metadata + 0.10 \cdot freshness
$$

Where:

- **semantic** = cosine similarity from embeddings.
- **lexical** = normalized BM25/FTS score.
- **metadata** = title matches, tag overlap, folder relevance, pinned/favorite status.
- **freshness** = mild recency boost for recently edited notes.

For implementation, do not rely on one score source to dominate. A common failure mode is vector search returning “conceptually similar but wrong” notes, which BM25 can suppress, while BM25 alone misses paraphrases and thematic links.[^2]

### Candidate merge strategy

- Take top 50 from FTS.
- Take top 50 from vector search.
- Union them by chunk ID.
- Deduplicate at note level if you only need one representative chunk per note.
- Preserve per-source scores so reranking can use both signals later.

This is especially useful in note apps because many user queries are short, ambiguous, or typo-prone, and your existing search model already uses weighted scoring over title, tags, and content.[^2]

## Local reranking

After retrieval, rerank with a fast local model or heuristic layer before sending anything to the LLM. The goal is to filter noise, not to do expensive reasoning.

Good reranking signals:

- Exact title match.
- Tag overlap.
- Query term coverage across chunk text.
- Section position, with title/summary chunks weighted higher.
- Redundancy penalty if two chunks are near-duplicates.
- Context fit, meaning the chunk answers the query intent rather than only sharing vocabulary.

A strong browser-friendly approach is a **two-pass reranker**:

- **Pass 1:** heuristic rerank using BM25 + semantic + metadata.
- **Pass 2:** optional cross-encoder reranker for the top 10–20 candidates if performance allows.

If you want fully client-side and fast, keep pass 2 lightweight and only invoke it when the query is complex or the first pass has low confidence.

## Context window manager

Your context manager should behave like a budget allocator, not a dumb truncation function. It should decide what to keep, summarize, compress, or drop based on query relevance and token budget.

### Inputs to the manager

- User query.
- Top reranked notes/chunks.
- Conversation state if applicable.
- Token budget for the target LLM.
- Output style requirements, like “answer briefly” or “show citations”.


### Output structure

- System prompt.
- Task instructions.
- Compact user query rewrite.
- Top-ranked evidence snippets.
- Optional compressed note summaries.
- Any persisted memory or project constraints.


### Budget policy

Use a tiered policy:

- **Tier A:** exact query matches and note titles.
- **Tier B:** top evidence chunks.
- **Tier C:** compressed summaries of lower-ranked but still relevant notes.
- **Tier D:** drop everything else.

A practical rule:

- Reserve 20–30% of the token budget for generation.
- Allocate 50–60% to retrieved context.
- Keep 10–20% as safety headroom for unexpected prompt growth.


### Truncation strategy

For each note:

1. Keep title, tags, and one-sentence summary.
2. Keep the best chunk(s), not the whole note.
3. If a note is still too large, compress it into a “retrieval summary” cached locally.
4. If multiple chunks from the same note repeat information, merge them into one distilled evidence block.

### Summarization strategy

Use incremental summarization, not repeated full-note summarization.

- **On note save:** create a compact summary and bullet facts.
- **On retrieval:** if the note is too long, use the stored summary first.
- **On budget pressure:** summarize only the marginal chunks that don’t fit.

This keeps the system stable because the LLM sees a consistent compressed representation of each note instead of an arbitrary truncation that may cut away key dependencies.

## End-to-end flow

### 1. Indexing a note

- User saves or edits a note.
- The note is normalized into retrieval text.
- The system chunks the note and extracts metadata.
- An embedding is generated client-side or in your AI pipeline.
- The chunk text is inserted into pgvector and into the local lexical index.
- A compact summary is generated and cached.
- The note is marked ready for retrieval.[^1][^2]


### 2. Query time

- User enters a query.
- The app rewrites it into a retrieval-friendly form.
- FTS/BM25 search runs locally.
- Vector search runs against pgvector or a local vector cache.
- Results are merged and deduplicated.
- Local reranking scores and filters them.
- The context manager builds the final prompt.


### 3. Prompt assembly

- System instructions go first.
- Add the user query.
- Add the top evidence blocks with source IDs.
- Add summaries for borderline candidates.
- Add any memory/state constraints.
- Enforce token budget.
- Send to the LLM.


## Recommended data model

A useful schema is:


| Entity | Purpose |
| :-- | :-- |
| `note` | Canonical note metadata, title, tags, timestamps [^2][^1]. |
| `note_chunk` | Chunked retrieval units with offsets and local text. |
| `note_embedding` | Vector representation for each chunk. |
| `note_fts` | Lexical representation for BM25/FTS. |
| `note_summary` | Compact cached summary for context compression. |
| `retrieval_log` | Debugging, confidence, and ranking traces. |

This structure makes it easy to support exact retrieval, semantic retrieval, and prompt compression independently.

## Practical implementation choices

If you want this to feel truly local-first:

- Keep the lexical index and summaries in IndexedDB for offline use.
- Use pgvector as the synced remote store for durable semantic retrieval.
- Cache the top N query results locally for repeated queries.
- Store per-note summaries so you never have to summarize the same note from scratch every time.

If you want the best quality with minimal complexity:

- Use BM25/FTS + vector search.
- Add heuristic reranking first.
- Add a small cross-encoder reranker later.
- Make the context manager summary-aware from day one.


## Prompt shaping

A good prompt should include only what the LLM needs:

- The query intent.
- The top 3–8 evidence chunks.
- Condensed note summaries for surrounding context.
- A hard instruction to answer only from provided context when appropriate.

That usually gives better answer quality than dumping too many raw notes, because RAG fails more often from noisy context than from missing context.

Would you like me to turn this into a concrete client-side module design with TypeScript interfaces and a step-by-step retrieval pipeline?
<span style="display:none">[^3][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: note-lifecycle.md

[^2]: architecture.md

[^3]: ai-copilot.md

[^4]: structure.md

[^5]: provider.md

[^6]: implementation-status.md

[^7]: features.md

[^8]: environment.md

[^9]: readme.md

