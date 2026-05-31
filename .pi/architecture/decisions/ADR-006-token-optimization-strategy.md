# ADR-006: Token Optimization Strategy

**Status:** Accepted
**Date:** 2026-04-25
**Deciders:** arman-jalili

## Context

Multi-agent AI workflows produce excellent results but consume tokens quadratically — each agent loads full context, each tool call adds to the history, and context windows fill up. The framework must minimize token usage while maintaining effectiveness.

## Decision

Adopt a **layered token optimization strategy** combining five mechanisms:

### 1. DRY Context (20-40% savings)

Shared knowledge (project context, patterns, checklists) lives in `.pi/context/` and is loaded once per session, not per agent. Subagents get only the context relevant to their task via explicit prompt injection.

### 2. Automated Validators (100% for mechanical checks)

Shell scripts replace LLM-based checks for mechanical tasks: CI validation, security scanning, operations checks, canonical reference integrity. These are zero-token operations that run locally.

### 3. Snippet Expansion (70-90% per skill reference)

`#handle` tokens (`.pi/skills/agents/snippets.md`) replace full skill files. When an agent references a handle, the extension expands it to the full skill content. Common handles: `#security-review`, `#no-comments`, `#test-first`.

### 4. Tiered System Prompts (~750 tokens/turn saved)

Two system prompt tiers:
- **Full** — For capable models (GPT-4, Claude 3.5+): comprehensive instructions, tool descriptions, examples
- **Lite** — For fast/cheap models: minimal instructions, assumes model competence

Model capability is determined by the model registry (`.pi/skills/validators/model-registry.md`).

### 5. Context Compaction (15-30% savings)

Budget-aware elision at 55/70/90% context thresholds:
- **55%** — Drop superseded file reads (keep only the latest read per file)
- **70%** — Drop tool results older than 50% of context depth
- **90%** — Keep only the last user message + assistant response pair

### 6. TOML Filter Pipeline (30-60% output reduction)

8-stage declarative output compression for command results: strip → replace → match → filter → truncate → head/tail → cap → empty. Defined in `.pi/validators/default.toml`.

## Consequences

**Positive:**
- Measurable token savings with clear methodology
- Each mechanism is independently testable and measurable
- Users can opt into specific mechanisms (e.g., disable compaction for debugging)
- Economic analytics in `guardian stats` command shows USD savings

**Negative:**
- Multiple moving parts (understanding all five mechanisms takes effort)
- Snippet system requires user discipline (must use `#handle` instead of typing skill names)
- Context compaction can lose nuance in complex sessions

**Mitigation:**
- `guardian info` shows per-category token stats
- Compaction is budget-aware — preserves critical context at each threshold
- Snippets are auto-discoverable via `/snippet list`

