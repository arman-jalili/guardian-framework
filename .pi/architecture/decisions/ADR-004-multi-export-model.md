# ADR-004: Multi-Export Model

**Status:** Accepted
**Date:** 2026-04-25
**Deciders:** arman-jalili

## Context

Users work with different AI-assisted development tools (Claude Code, OpenCode, Antigravity, GitHub Copilot). Each tool has its own expected directory structure, file format, and configuration conventions. Supporting each tool natively means maintaining redundant structures. Supporting only one tool limits adoption.

## Decision

Use a **pi-first, multi-export model**: one source format (`.pi/`) generates tool-specific exports via declarative mappings.

### Export Mappings

Each tool has a mapping file (`src/lib/export-mappings.ts`) that defines how pi source files map to tool-specific destinations:

| Source (`.pi/`) | Claude | OpenCode | Agents | GitHub |
|-----------------|--------|----------|--------|--------|
| `agent/AGENTS.md` | `context/project.md` | `context/project.md` | `context/project.md` | `copilot-instructions.md` |
| `skills/agents/*.md` | `agents/{role}/*.md` | `prompts/*.txt` | `agents/*.md` | `agents/*.agent.md` |
| `prompts/*.md` | `workflows/*.md` | `workflows/*.md` | `workflows/*.md` | — |
| `scripts/*.sh` | `scripts/*.sh` | `scripts/*.sh` | `scripts/*.sh` | — |
| `context/*.md` | `context/*.md` | `context/*.md` | `context/*.md` | — |

### Transformations

- **Claude** — preserves Markdown, nests agents into role directories (orchestrators/, validators/, implementers/)
- **OpenCode** — converts `.md` to `.txt` prompts, flat structure
- **Antigravity (.agents/)** — flat agent files with canonical reference headers
- **GitHub Copilot** — adds YAML front matter for `.agent.md` format, separate instructions directory
- **Pi Skills** — wraps skill definitions as `SKILL.md` packages for Codex

### What is NOT exported

- Pi extensions (`.ts` files) — only runnable inside pi
- `types.ts` — pi internal type definitions
- Architecture docs (module docs, ADRs) — only referenceable from `.pi/`

## Consequences

**Positive:**
- Add a new tool target by writing one mapping file — no changes to source templates
- Canonical references in exports trace back to `.pi/` source, so users always know where the content came from
- Conflict detection works across all exports because source + hash is universal

**Negative:**
- Export transformation step adds complexity (front-matter stripping, nesting, format conversion)
- Not all features translate across tools (extensions are pi-only)
- Export regeneration is an extra step after editing `.pi/`

**Mitigation:**
- Export mappings are type-safe (TypeScript with validated schemas)
- `generate` command auto-discovers what needs updating
- CI pipeline validates export integrity

