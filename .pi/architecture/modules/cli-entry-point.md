# CLI Entry Point

## Component: parseArgs
status: implemented
description: Parses command-line arguments using `parseArgs` from `node:util`. Routes commands to handlers. No state — pure routing layer.
depends: none

## Component: command-dispatch
status: implemented
description: Maps command string to handler function. All handlers receive `(targetDir, options)`. Dispatches 12 commands: `init`, `generate`, `update`, `upgrade`, `uninstall`, `info`, `stats`, `validate`, `verify`, `trust`, `domain`, `project`.
depends: parseArgs

## Component: global-options
status: implemented
description: Handles `--verbose`, `--quiet`, `--non-interactive`, `--dir`, `--dry-run`, `--force`, `--regenerate`, `--filter`, `--days`, `--history` flags.
depends: parseArgs

## Key Files

- `src/index.ts` — CLI entry point

## ADRs

- ADR-002: Bun Runtime
- ADR-005: Symphony-Inspired Orchestration

## Module Status

**Status:** Implemented
**Last reviewed:** 2026-05-31
