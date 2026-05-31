# Manifest System

## Component: manifest-read-write
status: implemented
description: Reads `guardian-manifest.json` from project root. Writes via atomic temp file + rename. Returns null if missing.
depends: none

## Component: hash-verification
status: implemented
description: Computes SHA-256 hash of file content. Used for change detection, integrity checks, and smart merge classification.
depends: none

## Component: file-categorization
status: implemented
description: Tracks files with categories: `user`, `framework`, `generated`.
depends: manifest-read-write

## Component: export-tracking
status: implemented
description: Per-tool export records with path, generatedAt timestamp, sourceHash.
depends: manifest-read-write

## Component: token-accounting
status: implemented
description: Estimates token count per file, per category, and total.
depends: manifest-read-write

## Key Files

- `src/lib/manifest.ts` — Core manifest operations
- `guardian-manifest.json` — Manifest file

## ADRs

- ADR-003: Template-Based Generation (hash tracking)
- ADR-005: Symphony-Inspired Orchestration (reconciliation)

## Module Status

**Status:** Implemented
**Last reviewed:** 2026-05-31
