# Init Command

## Component: interactive-prompts
status: implemented
description: Uses `@clack/prompts` to guide users through project setup: project name, language, AI tools, validators, workflows. Supports `--nonInteractive` flag for CI/automation.
depends: none

## Component: template-rendering
status: implemented
description: Loads templates from `templates/pi/`, substitutes placeholders with project context, writes to target `.pi/` directory. Delegates to `src/lib/templates.ts`.
depends: interactive-prompts

## Component: export-generation
status: implemented
description: After scaffolding `.pi/`, generates initial exports for selected tools. Delegates to `runGenerate()` from generate command for deduplication.
depends: template-rendering

## Component: manifest-creation
status: implemented
description: Creates `guardian-manifest.json` tracking all scaffolded files with hashes, categories, and timestamps. Atomic write via temp file + rename.
depends: export-generation

## Key Files

- `src/commands/init.ts` — Init command handler

## ADRs

- ADR-001: Pi-First Architecture
- ADR-003: Template-Based Generation
- ADR-004: Multi-Export Model

## Module Status

**Status:** Implemented
**Last reviewed:** 2026-05-31
