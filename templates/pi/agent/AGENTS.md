---
# Guardian Workflow Configuration
# This front matter defines runtime settings. The body below is the agent prompt.
# Changes to this file are detected and re-applied without restart.

# Workspace settings
workspace:
  root: ".pi/workspaces"  # Workspace root for isolated agent runs
  hooks:
    timeout_ms: 60000     # Default hook timeout

# Retry and backoff
agent:
  max_turns: 20
  max_retry_backoff_ms: 300000  # 5 minutes
  stall_timeout_ms: 300000      # 5 minutes no activity = stall

# System prompt tier: "full" (default) or "lite" for fast/cheap models
# Use "lite" for: GPT-4o-mini, Claude Haiku, Gemini Flash, Cerebras, Groq
system_prompt_tier: full

# Generation settings
generate:
  on_conflict: warn       # "overwrite" | "warn" | "skip" — what to do when exports modified externally
  atomic_writes: true     # Use temp file + rename for all generated files

# Validation settings
validate:
  fail_fast: false        # Stop on first validator failure vs run all
  timeout_ms: 300000      # Per-validator timeout (5 min)

# Environment variable references
# Use $VAR_NAME syntax in any template value. Resolved from process.env at runtime.
---

# Project Context

> **Purpose:** Single source of truth for project-specific knowledge. All agents load this ONCE, not scattered across individual agent files.
> **Generic:** Replace bracketed placeholders with your project's values.

## Project Overview

- **Name:** [Project Name]
- **Version:** [0.1.0]
- **Language:** [Rust / TypeScript / Python / etc.]
- **Type:** [CLI / Web App / Library / etc.]
- **Repository:** [owner/repo]

## Core Principles

> Keep to 5-8 bullet points. These are loaded into EVERY agent's context.

1. **[Principle 1]** - [One-line description]
2. **[Principle 2]** - [One-line description]
3. **[Principle 3]** - [One-line description]
4. **[Principle 4]** - [One-line description]
5. **[Principle 5]** - [One-line description]

## Architecture

### Structure

```
[project]/
├── src/              # Source code
├── tests/            # Test files
├── docs/             # Documentation
└── [other dirs]
```

### Key Patterns

> List the 3-5 patterns every agent must follow. No code examples here — those go in `patterns.md`.

- **[Pattern 1]:** [Description]
- **[Pattern 2]:** [Description]
- **[Pattern 3]:** [Description]

## Quality Gates

### Before Commit

```bash
[build command]
[format command]
```

### Before Push

```bash
[test command]
[lint command]
```

### Before Merge

```bash
[full test suite]
[lint check]
[security audit]
```

## Scope Classification

| Scope | Files | Lines | Required Validators |
|-------|-------|-------|---------------------|
| Simple | 1 | < 50 | ci-mr-validator |
| Moderate | 2-5 | 50-200 | architecture-validator, ci-mr-validator |
| Complex | 5-15 | 200-500 | All validators |
| Critical | 15+ or core | 500+ | All validators + human approval |

## Subagent Delegation

| Task | Subagent | Tools |
|------|----------|-------|
| Explore codebase | `explore` | read-only (read, grep, glob) |
| Code review | `code-review` | read-only (read, grep, glob) |
| Security audit | `security-review` | read-only (read, grep, glob) |
| Multi-file research | `general-research` | read-only (read, grep, glob) |

Subagents have **restricted tool access** and **fresh context**. Include all relevant context in the spawn prompt. They cannot spawn other subagents (no recursion).

## Key Files

> Files every agent should know about. Keep under 10.

| File | Purpose |
|------|---------|
| [docs/ARCHITECTURE.md] | [Complete specification] |
| [src/orchestrator.rs] | [Main coordinator] |
| [src/error.rs] | [Error types] |

## Commands

> Essential commands agents need to run.

| Command | Purpose |
|---------|---------|
| `[build]` | [Build project] |
| `[test]` | [Run tests] |
| `[lint]` | [Lint check] |
| `[audit]` | [Security audit] |

## Snippets

Available `#handle` tokens for quick instruction injection:

| Handle | Purpose |
|--------|---------|
| `#security-review` | Security audit instructions |
| `#no-comments` | Suppress comments unless WHY is non-obvious |
| `#test-first` | TDD workflow instructions |

See `.pi/skills/agents/snippets.md` for full snippet management.

## Environment

> Variables agents may reference. Use `$VAR_NAME` in scripts — do NOT embed secrets in templates.

| Variable | Purpose |
|----------|---------|
| `$GITHUB_TOKEN` | GitHub API authentication |
| `$CI` | CI environment indicator |
| `$BUILD_NUMBER` | Build identifier |

## Security Guards

Path safety guards are enforced at the extension level (`.pi/extensions/bash-guard.ts`):

- **Read blocklist:** `.env*`, `*.pem`, `*.key`, `.ssh/*`, `.aws/*`, `.git/*`
- **Write blocklist:** Inherits read restrictions + `/etc/`, `/System/`, `/private/`
- **Command deny-list:** `rm -rf /`, `mkfs`, `dd of=/dev/*`, `terraform destroy`, `kubectl delete`

See `.pi/skills/validators/security-guards.md` for the full policy.
