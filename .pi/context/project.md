# Project Knowledge

> **Purpose:** Single source of truth for Guardian-framework project-specific knowledge. All agents load this ONCE.

## Project Overview

- **Name:** guardian-framework
- **Version:** 0.1.0
- **Language:** TypeScript (Bun runtime)
- **Type:** CLI — token-optimized agentic framework scaffolder
- **Repository:** arman-jalili/guardian-framework
- **Package:** guardian-framework (npm)

## Core Principles

1. **Architecture-first** — Every implementation file traces back to canonical architecture. No orphaned code.
2. **Pi-first** — `.pi/` is the single source of truth; other tool formats are generated exports.
3. **Shift-left validation** — Validate plans before code, not after.
4. **Token efficiency** — DRY context, snippet expansion, validation scripts, tiered prompts, context compaction.
5. **Deterministic validation** — Shell scripts decide readiness, not LLMs.
6. **Read before edit** — Always read a file before modifying it.
7. **Smart merge, never clobber** — User edits to `.pi/` survive template updates.

## Commands

| Command | Purpose |
|---------|---------|
| `bun build ./src/index.ts --outdir ./dist` | Build for npm distribution |
| `bun test` | Run tests (Bun test runner) |
| `biome check .` | Lint check |
| `biome check . --write` | Format + lint fix |
| `bun run src/index.ts init` | Run CLI locally (dev) |
| `bash .pi/scripts/ci/run_preflight.sh` | Run local preflight checks |
| `bash .pi/scripts/validate-architecture.sh` | Architecture conformance check |
| `bash .pi/scripts/validate-canonical.sh` | Canonical reference integrity check |

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | CLI entry point — argument parsing and dispatch |
| `src/commands/init.ts` | Scaffold `.pi/` + exports interactively |
| `src/commands/generate.ts` | Regenerate exports from `.pi/` source |
| `src/commands/update.ts` | Smart merge update preserving user edits |
| `src/lib/templates.ts` | Template loading and rendering |
| `src/lib/manifest.ts` | Manifest read/write/hash operations |
| `src/lib/workflow-config.ts` | YAML front matter parsing |
| `src/lib/workspace-hooks.ts` | Lifecycle hook execution |
| `src/lib/retry.ts` | Exponential backoff retry |
| `src/lib/export-mappings.ts` | Pi to tool export definitions |
| `src/lib/logger.ts` | Structured JSON logging |
| `src/lib/result.ts` | Result type |
| `templates/pi/` | Template source files (shipped with package) |
| `.pi/architecture/modules/*.md` | Architecture module docs |
| `.pi/architecture/decisions/*.md` | ADRs |

## Architecture

### Source Code Structure

```
src/
  index.ts               CLI entry point
  commands/              Command handlers
    init.ts              Scaffold .pi/ + exports
    generate.ts          Regenerate exports
    update.ts            Smart merge update
    upgrade.ts           Schema version migration
    uninstall.ts         Managed file removal
    info.ts              Status + token stats
    stats.ts             Economic analytics
  lib/                   Core libraries
    templates.ts         Template loading + rendering
    manifest.ts          State tracking + hashing
    workflow-config.ts   YAML front matter parsing
    export-mappings.ts   Pi to tool export definitions
    workspace-hooks.ts   Lifecycle hook execution
    retry.ts             Exponential backoff
    retry-queue.ts       Persistent retry state
    integrity.ts         File integrity verification
    tracking.ts          Token accounting
    code-filter.ts       Language-aware code filtering
    toml-filter.ts       TOML output compression
    trust.ts             Trust-gated config
    logger.ts            Structured JSON logging
    prompts.ts           Interactive prompts
    result.ts            Result<T,E> type
```

## Validators

| Validator | Checks | When |
|-----------|--------|------|
| CI | Build, lint, format, audit | All tasks |
| Test | Unit, integration, coverage | Moderate+ scope |
| Security | Secrets, injection, path traversal | Complex+ scope |
| Operations | Tracing, cancellation, atomic writes | Plan review |
| Architecture | Layer structure, ADR compliance, module boundaries | Moderate+ scope |
| Canonical | Reference integrity, coverage, ADR cross-references | All tasks |

## Quality Gates

### Before Commit
```
bash .pi/scripts/ci/run_preflight.sh
bun build ./src/index.ts --outdir ./dist
```

### Before Push
```
bun test
biome check .
```
