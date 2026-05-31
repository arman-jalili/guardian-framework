# Update Command

## Component: change-analysis
status: implemented
description: Compares current manifest file hashes against new template versions. Classifies each file: add, update, merge-front-matter, preserve, orphan, or regenerate.
depends: none

## Component: front-matter-merge
status: implemented
description: For files with YAML front matter, preserves user's configuration keys and replaces the body with the new template version.
depends: change-analysis

## Component: dry-run
status: implemented
description: Shows planned changes without applying them. `--dryRun` flag.
depends: change-analysis

## Component: live-update-and-regenerate
status: implemented
description: Applies classified changes to filesystem, optionally regenerates all exports with `--regenerate` flag.
depends: front-matter-merge, dry-run

## Key Files

- `src/commands/update.ts` — Update command handler

## ADRs

- ADR-003: Template-Based Generation (smart merge)

## Module Status

**Status:** Implemented
**Last reviewed:** 2026-05-31
