# ADR-001: Pi-First Architecture

**Status:** Accepted
**Date:** 2026-04-25
**Deciders:** arman-jalili

## Context

The framework needs a single source of truth for project context, agent definitions, and workflow prompts. Multiple AI tools (Claude Code, OpenCode, Antigravity/GitHub Copilot) each have their own directory and format conventions, but maintaining them in parallel creates drift, duplication, and versioning headaches.

## Decision

Use **`.pi/` as the single version-controlled source of truth**. All other tool formats (`.claude/`, `.opencode/`, `.agents/`, `.github/`) are generated exports derived from the pi source via the `generate` command.

### Key Properties

- **Pi owns the canonical format** — YAML-front-matter Markdown files with structured metadata
- **Exports are read-only** — never edit `.claude/` directly; changes must flow through `.pi/`
- **Canonical references** — every generated export file carries a header pointing back to its pi source
- **Atomic writes** — exports are written via temp file + rename to prevent partial writes
- **Reconciliation** — before overwriting, Guardian checks if exports were modified externally (hash comparison)

### What lives in `.pi/`

| Directory | Contents | Editable? |
|-----------|----------|-----------|
| `agent/` | AGENTS.md (project context + YAML config), SYSTEM.md | Yes (user) |
| `architecture/` | Module docs, ADRs, CHANGELOG, diagrams | Yes (user) |
| `context/` | Shared knowledge, patterns, checklists | Yes (user) |
| `extensions/` | Pi TypeScript plugins | Framework-managed |
| `skills/` | Agent definitions + validator skills | Framework-managed |
| `prompts/` | Workflow prompt templates | Framework-managed |
| `scripts/` | Validator shell scripts | Framework-managed |
| `github/` | GitHub Copilot export templates | Framework-managed |

### What is NOT in `.pi/`

Generated exports (`.claude/`, `.opencode/`, `.agents/`, `.github/`, `.agents/skills/`) are outside `.pi/` and regenerated on demand.

## Consequences

**Positive:**
- Single place to version, review, and update framework content
- Tool-agnostic format — new tool targets can be added by writing a new export mapper
- Smart merge works because there's one canonical format (no multi-format drift)
- Token-optimized by design — context is loaded once from pi, not duplicated per export

**Negative:**
- Requires running `generate` after editing `.pi/` to refresh exports (automated in CI)
- Users must learn the pi structure if they want full features (extensions, skills)

**Neutral:**
- The CLI itself is built with the same tools it scaffolds (dogfooding)

