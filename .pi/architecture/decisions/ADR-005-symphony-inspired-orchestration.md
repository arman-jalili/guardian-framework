# ADR-005: Symphony-Inspired Orchestration

**Status:** Accepted
**Date:** 2026-04-25
**Deciders:** arman-jalili

## Context

The framework needs a lifecycle model for scaffold, generate, and update operations that is deterministic, retryable, and auditable. The workflow must handle transient failures (network issues, disk full), external modifications (user editing exports), and state persistence across process restarts.

## Decision

Model the orchestration lifecycle after the [OpenAI Symphony specification](https://github.com/openai/symphony), adapted for a scaffolding CLI rather than a long-running daemon.

### Symphony Concepts Adapted

| Symphony Concept | Guardian Implementation |
|------------------|------------------------|
| `WORKFLOW.md` with YAML front matter | `.pi/agent/AGENTS.md` front matter config |
| Workspace lifecycle hooks | `before_run`/`after_run`/`after_create`/`before_remove` |
| Exponential backoff retry | `retry.ts` with configurable cap |
| Reconciliation before dispatch | External modification detection before overwrite |
| `$VAR` env indirection | Template `$VAR_NAME` resolution from `process.env` |
| Path safety invariants | Workspace root containment + identifier sanitization |

### Lifecycle States (Generate Command)

```
START → reconciliationCheck → beforeRunHook → generateExports → afterRunHook → DONE
                                                         │
                                                    (retry on failure)
                                ┌──────────────────────┘
                                ▼
                         SCHEDULE_RETRY → (next run) → rescheduleCheck → beforeRunHook → ...
```

### Retry Policy

| Attempt | Delay | When |
|---------|-------|------|
| 1 | 0s (immediate) | First attempt |
| 2 | 10s | First retry |
| 3 | 20s | Second retry |
| n | `min(10000 × 2^(n-1), 300000)` | Subsequent |

### Hook Semantics

| Hook | Timing | Failure Behavior |
|------|--------|-----------------|
| `after_create` | Workspace first created | Fatal (abort) |
| `before_run` | Before each generate/operation | Fatal (abort) |
| `after_run` | After each generate/operation | Logged (best effort) |
| `before_remove` | Before workspace cleanup | Logged (continue) |

## Consequences

**Positive:**
- Deterministic, testable lifecycle — each state transition is explicit
- Transient failures don't lose work (retry queue persists to disk)
- Hooks allow project-specific pre/post processing without modifying framework code
- Reconciliation prevents accidental overwrites of user edits

**Negative:**
- Lifecycle adds complexity to simple operations (single file write is now a multi-step process)
- Hook execution is blocking — slow hooks delay the entire generate pipeline
- Retry semantics add state that must be managed (retry queue file)

**Mitigation:**
- Hooks have configurable timeouts and stall detection (SIGTERM after 60s no output)
- Retry queue is a simple JSON file with atomic writes
- `--dryRun` flag skips all hooks and writes

