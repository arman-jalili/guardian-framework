# Template System

## Component: template-loading
status: implemented
description: Locates template directory (shipped with package via dist/, linked bin, or cwd). Walks `templates/pi/` recursively.
depends: none

## Component: placeholder-substitution
status: implemented
description: Replaces placeholders in template content with project context values. Supports `{{UPPERCASE}}`, `[Title Case]`, `[lowercase]`, and `$VAR_NAME` formats.
depends: template-loading

## Component: language-patterns
status: implemented
description: Selects and applies language-specific patterns from `templates/languages/`. Merges base + language + validator patterns.
depends: placeholder-substitution

## Key Files

- `src/lib/templates.ts` — Template loading and rendering

## ADRs

- ADR-003: Template-Based Generation

## Module Status

**Status:** Implemented
**Last reviewed:** 2026-05-31
