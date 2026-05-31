# ADR-003: Template-Based Generation

**Status:** Accepted
**Date:** 2026-04-25
**Deciders:** arman-jalili

## Context

The framework must scaffold project-specific `.pi/` directories with customized content based on the user's language, tools, validators, and workflow choices. Two approaches: (1) code that programmatically constructs each file, or (2) templates with placeholder substitution.

## Decision

Use **file-based templates with placeholder substitution** as the generation mechanism.

### How it works

1. **Template files** live in `templates/pi/` mirroring the `.pi/` directory structure
2. **Placeholders** like `{{PROJECTNAME}}`, `[Build Command]`, `$VAR_NAME` are substituted at scaffold time
3. **Language patterns** are selected during init and rendered into `.pi/context/patterns.md`
4. **Context** combines project-specific values (name, language, tools) with language defaults (build/test/lint commands)
5. **Generation** is a simple read-template + render-context + write-file pipeline — no AST manipulation, no code generation

### Placeholder Formats

| Format | Source | Example |
|--------|--------|---------|
| `{{UPPERCASE}}` | Template context | `{{PROJECTNAME}}` → `guardian-framework` |
| `[Title Case]` | camelCase in context | `[Build Command]` → `buildCommand` |
| `[lowercase]` | camelCase in context | `[build command]` → `buildCommand` |
| `$VAR_NAME` | `process.env` | `$GITHUB_TOKEN` → `ghp_xxx` |

### Why not code generation?

- Templates are **auditable** — anyone can see exactly what will be scaffolded
- Templates are **versionable** — diffs show content changes, not logic changes
- Templates are **forkable** — users can customize them without understanding the generator code
- Smart merge works naturally on templates (hash + front-matter merge)
- Adding new files means adding a template file, not writing new generation code

## Consequences

**Positive:**
- Low barrier to contribution — adding a new agent just requires writing Markdown
- Framework updates = template updates = clear, reviewable diffs
- Users can preview changes with `update --dryRun` before applying
- Language-specific patterns are additive (base + language override + validator patterns)

**Negative:**
- Template rendering is a shallow substitution — no conditional logic or loops in templates themselves
- Template authoring requires understanding the placeholder syntax
- Template validation is manual (no type checking for placeholder correctness)

**Mitigation:**
- Render logic is centralized in `src/lib/templates.ts` — one place to fix
- Tests verify placeholder rendering for all template files
- `--dryRun` flag shows rendered output before writing

