# Core Libraries

## Component: logger
status: implemented
description: Structured JSON logging to stderr. Levels: info, warn, error, debug.
depends: none

## Component: workflow-config
status: implemented
description: Parses YAML front matter from AGENTS.md using `yaml` package. Deep-merges with DEFAULTS.
depends: none

## Component: result-type
status: implemented
description: `Result<T, E>` type — library functions return Result instead of throwing.
depends: none

## Component: integrity
status: implemented
description: File integrity verification. Detects tampering/drift.
depends: none

## Component: tracking
status: implemented
description: Token accounting with per-validator tracking.
depends: none

## Component: code-filter
status: implemented
description: Language-aware code filtering with 3 levels. Supports 11 languages.
depends: none

## Component: toml-filter
status: implemented
description: 8-stage declarative output compression pipeline.
depends: none

## Component: trust
status: implemented
description: SHA-256 hash verification before enabling project config.
depends: none

## Component: prompts
status: implemented
description: Interactive prompt helpers using `@clack/prompts`.
depends: none

## Key Files

- `src/lib/logger.ts`, `src/lib/workflow-config.ts`, `src/lib/result.ts`
- `src/lib/integrity.ts`, `src/lib/tracking.ts`, `src/lib/code-filter.ts`
- `src/lib/toml-filter.ts`, `src/lib/trust.ts`, `src/lib/prompts.ts`

## ADRs

- ADR-006: Token Optimization Strategy

## Module Status

**Status:** Implemented
**Last reviewed:** 2026-05-31
