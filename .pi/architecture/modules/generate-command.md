# Generate Command

## Component: export-mappings
status: implemented
description: Defines how `.pi/` source files map to each tool's export destinations. Per-tool mapping arrays with optional transform functions.
depends: none

## Component: reconciliation
status: implemented
description: Before overwriting exports, detects externally modified files via hash comparison. Configurable behavior: warn, skip, or overwrite.
depends: none

## Component: export-generation
status: implemented
description: Creates export directories, copies files from `.pi/`, applies transformations, adds canonical reference headers. Retries with exponential backoff on failure.
depends: export-mappings, reconciliation

## Component: workspace-hooks
status: implemented
description: Runs lifecycle hooks around export generation. Configurable timeout and stall detection.
depends: none

## Component: retry-queue
status: implemented
description: Persists failed generation attempts to `.pi/.guardian-retry-state.json`. Survives process restarts. Exponential backoff.
depends: none

## Key Files

- `src/commands/generate.ts` — Generate command handler
- `src/lib/export-mappings.ts` — Export mapping definitions
- `src/lib/workspace-hooks.ts` — Lifecycle hook execution
- `src/lib/retry.ts` — Backoff retry
- `src/lib/retry-queue.ts` — Persistent retry state

## ADRs

- ADR-001: Pi-First Architecture
- ADR-004: Multi-Export Model
- ADR-005: Symphony-Inspired Orchestration

## Module Status

**Status:** Implemented
**Last reviewed:** 2026-05-31
