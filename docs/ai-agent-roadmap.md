# AI Agent Roadmap

## Product Direction

SmartNotes should evolve from an AI chat attached to notes into a workspace agent that can:

1. capture free-form user thoughts;
2. structure them into high-quality notes;
3. search both lexically and semantically;
4. propose organization changes;
5. execute safe note and folder operations after confirmation.

## Thought Model

Thoughts should remain regular notes, not a separate entity.

- Use `resurfacingClass: "idea"` for thought-like notes.
- Preserve compatibility with the existing note model and search pipeline.
- Keep the data model simpler while still supporting AI-first capture flows.

## AI Capture Flow

### Goal

Allow the user to write in natural language and let the AI turn it into a structured note.

### Recommended UX

1. User sends a free-form message to AI.
2. AI identifies note-capture intent.
3. AI returns a structured draft plus a save mode.
4. UI asks how to save it:
   - `AI only`
   - `Human + AI`
5. User confirms.
6. App creates a note and optionally opens it.

### Recommended Note Formats

#### Human + AI

```md
# Short title

## Original thought
<raw user input>

---

## Structured by AI
### Summary
...
### Key ideas
- ...
- ...
### Next steps
- ...
- ...
### Tags
#idea #work #research
```

#### AI Only

```md
# Short title

## Structured by AI
### Summary
...
### Key ideas
- ...
- ...
### Next steps
- ...
- ...
### Tags
#idea #work #research
```

## Search Strategy

### Recommended UX

Use a two-stage search flow:

1. immediate lexical results while the user types;
2. semantic/vector results after a short pause.

### Why

- fast perceived performance;
- lower CPU/network cost;
- better relevance for short and long queries;
- avoids expensive vector search on every keystroke.

## Agent Execution Model

### Current Limitation

The chat currently proposes actions and executes them on the client.

### Target Model

1. AI generates a typed action plan.
2. UI shows a preview.
3. User confirms.
4. Server executes the plan.
5. UI shows progress and results.

### Why

- better safety;
- better permissions control;
- easier auditing and logging;
- easier future expansion.

## Recommended Agent Tools

### Folder tools

- `createFolder`
- `renameFolder`
- `trashFolder`
- `restoreFolder`
- `deleteFolder`
- `mergeFolders`

### Note tools

- `createNote`
- `updateNote`
- `renameNote`
- `moveNotesToFolder`
- `mergeNotes`
- `trashNotes`
- `restoreNotes`
- `deleteNotes`
- `archiveNotes`
- `unarchiveNotes`
- `addTagsToNotes`
- `removeTagsFromNotes`

### AI capture tools

- `createStructuredIdeaNote`
- `rewriteNoteAsStructured`
- `appendAiStructureToNote`

## Safety Rules

1. Require confirmation for destructive or bulk actions.
2. Validate every AI action against a strict schema.
3. Log every agent run and execution result.
4. Provide a clear preview before execution.
5. Add guard rails for merges, deletes, and overwrites.

## Delivery Order

1. search debounce and search scoring optimization;
2. command palette and AI chat performance cleanup;
3. AI capture flow for structured thought-to-note creation;
4. semantic search integration after typing pause;
5. server-side action executor;
6. expanded agent toolset;
7. advanced UX polish and workflow refinement.
