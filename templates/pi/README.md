# Guardian Framework Agent Framework

**Version:** 1.0.0
**Status:** Template
**Architecture:** Pi-first

A modular, DRY, tool-agnostic agentic workflow for AI-assisted development. Uses `.pi/` as source of truth with generated exports for multiple tools.

---

## Why This Exists

Multi-agent workflows produce excellent results but burn tokens quadratically. This framework solves that through:

1. **DRY context** — shared templates, not duplicated per agent
2. **Shift-left validation** — validate plans once, not plans AND code
3. **Automated validators** — scripts replace LLMs for mechanical checks
4. **Validation caching** — retries only re-check failed items
5. **Compressed agents** — 20-30 lines each instead of 120-176
6. **Pi-first architecture** — single source of truth, multiple export formats

---

## Architecture

```
.pi/                           # Source of truth
├── agent/
│   └── AGENTS.md              # Project instructions (template)
│
├── context/                   # Shared knowledge (loaded ONCE)
│   ├── project.md             # Project-specific facts
│   ├── patterns.md            # Code templates
│   ├── checklists.md          # Validation checklists
│   └── output-formats.md      # Report templates
│
├── skills/
│   ├── agents/                # Compressed agent definitions
│   └── validators/            # Validator skills
│
├── prompts/                   # Workflow templates
│
├── scripts/                   # Automated validators
│   ├── validate-ci.sh
│   ├── validate-tests.sh
│   ├── validate-operations.sh
│   ├── validate-security.sh
│   └── validation-cache.sh
│
└── extensions/                # Pi extensions
    ├── validation-runner.ts
    └── coordinator.ts
```

Generated exports (created by `guardian generate`):
- `.claude/` — Claude Code format
- `.opencode/` — OpenCode format
- `.agents/` — Antigravity format

---

## Quick Start

### 1. Initialize Project

```bash
npx guardian-framework init
```

Interactive prompts will:
- Select target tools (Claude Code, OpenCode, Antigravity, pi)
- Select language (Rust, TypeScript, Python, Go)
- Fill project placeholders

### 2. Configure Scripts

Replace placeholder commands in `.pi/scripts/*.sh`:
- `[build command]` → `cargo build` / `npm run build` / etc.
- `[test command]` → `cargo test --all` / `npm test` / etc.
- `[lint command]` → `cargo clippy -- -D warnings` / `npm run lint` / etc.

### 3. Generate Exports

```bash
npx guardian-framework generate
```

Creates `.claude/`, `.opencode/`, `.agents/` from `.pi/` templates.

### 4. Test

```bash
chmod +x .pi/scripts/*.sh
bash .pi/scripts/validate-ci.sh
bash .pi/scripts/validate-tests.sh
```

---

## How It Works

### Pi-First Architecture

`.pi/` is the single source of truth. All other formats are generated:

| Source | Export | Transformation |
|--------|--------|----------------|
| `AGENTS.md` | `CLAUDE.md` | Direct copy |
| `skills/agents/*.md` | `.claude/agents/*.md` | Direct copy |
| `prompts/*.md` | `.opencode/workflows/*.md` | Nest under workflows/ |
| `scripts/*.sh` | All formats | Direct copy |

### Shift-Left Validation

Most validation happens at plan time. Once validated:

| Check | Plan Time (LLM) | Post-Code (Automated) |
|-------|-----------------|----------------------|
| Patterns followed | ✅ Reviewed | Inherited from plan |
| Callers exist | ❌ Can't check | ✅ `grep` for callers |
| Build passes | ❌ Can't check | ✅ Build command |
| Tests pass | ❌ Can't check | ✅ Test command |

### Validation Caching

When validators reject and require changes:

```
Iteration 1: Check all 15 items → 3 fail
Iteration 2: Re-check ONLY 3 failed items → 1 still fails
Iteration 3: Re-check ONLY 1 failed item → all pass

Token savings: 58% reduction
```

---

## Scope Classification

| Scope | Files | Lines | Validators | LLM Calls | Automated |
|-------|-------|-------|-----------|-----------|-----------|
| **Simple** | 1 | < 50 | ci-mr | 0 | validate-ci.sh |
| **Moderate** | 2-5 | 50-200 | arch (plan) + wiring | 2 | validate-ci.sh, validate-tests.sh |
| **Complex** | 5-15 | 200-500 | arch + sec (plan) + wiring | 4 | All 4 scripts |
| **Critical** | 15+ or core | 500+ | All + human | 6+ | All 4 scripts + human |

---

## Agent Reference

| Agent | Role | When |
|-------|------|------|
| `architecture-coordinator` | Classifies scope, spawns validators, makes decisions | All tasks |
| `architecture-validator` | Architecture compliance | Moderate+ scope |
| `security-validator` | Security review | Complex+ scope |
| `operations-validator` | Production readiness | Plan review |
| `test-validator` | Test quality | Post-code |
| `integration-validator` | Component integration | Complex+ scope |
| `ci-validator` | CI/merge readiness | All PRs |
| `code-developer` | Implementation | All code tasks |
| `issue-creator` | GitHub issues | All tasks |
| `documentation-maintainer` | Doc sync | API changes |

---

## Language Patterns

Language-specific patterns are provided:
- `templates/languages/rust-patterns.md`
- `templates/languages/typescript-patterns.md`
- `templates/languages/python-patterns.md`
- `templates/languages/go-patterns.md`

Selected during `guardian init` based on project language.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-04-25 | Initial Guardian template with pi-first architecture |