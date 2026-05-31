---
# Guardian Workflow Configuration
# YAML front matter = runtime settings. Body = agent prompt.
# Changes to this file are detected and re-applied without restart.

workspace:
  root: ".pi/workspaces"
  hooks:
    timeout_ms: 60000

agent:
  max_turns: 20
  max_retry_backoff_ms: 300000
  stall_timeout_ms: 300000

system_prompt_tier: full

generate:
  on_conflict: warn
  atomic_writes: true

validate:
  fail_fast: false
  timeout_ms: 300000

goal:
  enabled: true
  max_turns: 20
  judge_validator: true

kanban:
  enabled: true
  auto_create_tasks: true

hooks:
  pre_tool_call: []
  post_tool_call: []
  pre_llm_call: []
  post_llm_call: []
  on_session_start: []
  on_session_end: []
  subagent_stop: []

curator:
  enabled: true
  stale_after_days: 30
  archive_after_days: 90
  auto_review: true

delegation:
  max_spawn_depth: 1
  max_concurrent_children: 3
  max_iterations: 50
  child_timeout_ms: 600000
---

# Project Context

> **Purpose:** Single source of truth for project-specific knowledge. All agents load this ONCE.
> **Customize:** Fill in the sections below for your project. The YAML front matter above already has working defaults.

## Project Overview

- **Name:** guardian-framework
- **Version:** 0.1.0
- **Language:** [TypeScript / Python / Rust / Go]
- **Type:** [CLI / Web App / Library]
- **Repository:** [owner/repo]

## Core Principles

> These are loaded into EVERY agent's context. Keep to 5-8 items.

1. **Read before edit** — Always read a file before modifying it. Never mutate blindly.
2. **Validate early** — Run `bash .pi/scripts/ci/run_preflight.sh` before committing.
3. **Architecture traceability** — Every implementation file must reference its architecture source in `.pi/architecture/modules/`.
4. **DRY context** — Shared knowledge lives in `.pi/context/`, not scattered across agent files.
5. **Shift-left validation** — Plans are validated before code is written.

## Commands

> Essential commands agents need to run. Update these for your project.

| Command | Purpose |
|---------|---------|
| `bun build ./src/index.ts --outdir ./dist` | Build project |
| `bun test` | Run tests |
| `biome check .` | Lint check |
| `bash .pi/scripts/ci/run_preflight.sh` | Run local preflight checks |
| `bash .pi/scripts/validate-*.sh` | Run specific validator |

## Architecture

### Structure

```
[project]/
├── src/              # Source code
├── tests/            # Test files
├── docs/             # Documentation
└── [other dirs]
```

### Key Files

> Files every agent should know about. Keep under 10.

| File | Purpose |
|------|---------|
| `.pi/architecture/modules/` | Canonical architecture modules |
| `.pi/agent/AGENTS.md` | This file — project context + runtime config |
| `.pi/scripts/` | Validation scripts |
| `.pi/extensions/` | Pi extensions (tools, commands, hooks) |

## Quality Gates

### Before Commit

```bash
bash .pi/scripts/ci/run_preflight.sh
bun build ./src/index.ts --outdir ./dist
```

### Before Push

```bash
bun test
biome check .
```

## Subagent Delegation

| Task | Subagent | Tools |
|------|----------|-------|
| Explore codebase | `explore` | read-only (read, grep, glob) |
| Code review | `code-review` | read-only (read, grep, glob) |
| Security audit | `security-review` | read-only (read, grep, glob) |

Subagents have **restricted tool access** and **fresh context**. Include all relevant context in the spawn prompt.

## Snippets

Available `#handle` tokens for quick instruction injection:

| Handle | Purpose |
|--------|---------|
| `#security-review` | Security audit instructions |
| `#no-comments` | Suppress comments unless WHY is non-obvious |
| `#test-first` | TDD workflow instructions |

## Environment

> Variables agents may reference. Use `$VAR_NAME` in scripts.

| Variable | Purpose |
|----------|---------|
| `$GITHUB_TOKEN` | GitHub API authentication |
| `$CI` | CI environment indicator |

## Security Guards

Path safety guards are enforced by extensions (`.pi/extensions/bash-guard.ts`):

- **Read blocklist:** `.env*`, `*.pem`, `*.key`, `.ssh/*`, `.aws/*`, `.git/*`
- **Write blocklist:** Inherits read restrictions + `/etc/`, `/System/`, `/private/`
- **Command deny-list:** `rm -rf /`, `mkfs`, `dd of=/dev/*`, `terraform destroy`, `kubectl delete`
---
# Guardian Workflow Configuration
# YAML front matter = runtime settings. Body = agent prompt.
# Changes to this file are detected and re-applied without restart.

workspace:
  root: ".pi/workspaces"
  hooks:
    timeout_ms: 60000

agent:
  max_turns: 20
  max_retry_backoff_ms: 300000
  stall_timeout_ms: 300000

system_prompt_tier: full

generate:
  on_conflict: warn
  atomic_writes: true

validate:
  fail_fast: false
  timeout_ms: 300000

goal:
  enabled: true
  max_turns: 20
  judge_validator: true

kanban:
  enabled: true
  auto_create_tasks: true

hooks:
  pre_tool_call: []
  post_tool_call: []
  pre_llm_call: []
  post_llm_call: []
  on_session_start: []
  on_session_end: []
  subagent_stop: []

curator:
  enabled: true
  stale_after_days: 30
  archive_after_days: 90
  auto_review: true

delegation:
  max_spawn_depth: 1
  max_concurrent_children: 3
  max_iterations: 50
  child_timeout_ms: 600000
---

# Project Context

> **Source of truth:** `.pi/` is the version-controlled source. All other formats are generated exports.

## Project Overview

- **Name:** guardian-framework
- **Version:** 0.1.0
- **Language:** TypeScript (Bun runtime)
- **Type:** CLI — token-optimized agentic framework scaffolder
- **Repository:** arman-jalili/guardian-framework
- **Package:** guardian-framework (npm)

## Core Principles

1. **Architecture-first** — Every implementation file traces back to canonical architecture via canonical references. No orphaned code.
2. **Pi-first** — `.pi/` is the single source of truth; `.claude/`, `.opencode/`, `.agents/`, `.github/` are generated exports.
3. **Shift-left validation** — Validate plans before code, not after. Architecture conformance checked at plan time.
4. **Token efficiency** — DRY context, snippet expansion, validation scripts, tiered prompts, context compaction. Target: 50-70% reduction vs traditional multi-agent.
5. **Deterministic validation** — Shell scripts decide readiness, not LLMs. Automated validators replace mechanical LLM checks.
6. **Read before edit** — Always read a file before modifying. Never mutate blindly.
7. **Smart merge, never clobber** — User edits to `.pi/` survive template updates via front-matter merge and hash comparison.

## Commands

| Command | Purpose |
|---------|---------|
| `bun build ./src/index.ts --outdir ./dist` | Build project for npm distribution (Bun target) |
| `bun test` | Run all tests (Bun test runner) |
| `biome check .` | Lint check (Biome) |
| `biome check . --write` | Format + lint fix |
| `bun run src/index.ts init` | Run CLI locally (dev) |
| `bash .pi/scripts/ci/run_preflight.sh` | Run local preflight checks |
| `bash .pi/scripts/validate-architecture.sh` | Architecture conformance check |
| `bash .pi/scripts/validate-canonical.sh` | Canonical reference integrity check |

## Architecture

### Project Structure

```
guardian-framework/
├── src/                          # CLI source code (TypeScript)
│   ├── index.ts                  # Entry point, arg parsing, dispatch
│   ├── commands/                 # Command handlers
│   │   ├── init.ts               # Scaffold .pi/ + exports
│   │   ├── generate.ts           # Regenerate exports from .pi/
│   │   ├── update.ts             # Smart merge update
│   │   ├── upgrade.ts            # Schema version migration
│   │   ├── uninstall.ts          # Managed file removal
│   │   ├── info.ts               # Status + token stats
│   │   └── stats.ts              # Economic analytics
│   └── lib/                      # Core libraries
│       ├── templates.ts          # Template loading + rendering
│       ├── manifest.ts           # State tracking + hashing
│       ├── workflow-config.ts    # YAML front matter parsing
│       ├── export-mappings.ts    # Pi → tool export definitions
│       ├── workspace-hooks.ts    # Lifecycle hook execution
│       ├── retry.ts              # Exponential backoff
│       ├── retry-queue.ts        # Persistent retry state
│       ├── integrity.ts          # File integrity verification
│       ├── tracking.ts           # Token accounting
│       ├── code-filter.ts        # Language-aware code filtering
│       ├── toml-filter.ts        # TOML output compression
│       ├── trust.ts              # Trust-gated config
│       ├── logger.ts             # Structured JSON logging
│       ├── prompts.ts            # Interactive prompts
│       └── result.ts             # Result<T,E> type
├── templates/                    # Template source (shipped with package)
│   ├── pi/                       # Pi-first source templates
│   │   ├── agent/                # AGENTS.md + system prompt
│   │   ├── architecture/         # Module docs, ADRs, diagrams
│   │   ├── context/              # Shared knowledge
│   │   ├── extensions/           # Pi TypeScript extensions
│   │   ├── skills/               # Agent + validator skill definitions
│   │   ├── prompts/              # Workflow prompt templates
│   │   ├── scripts/              # Validator shell scripts
│   │   └── github/               # GitHub Copilot export templates
│   └── languages/                # Language-specific patterns
├── tests/                        # Test files
├── docs/                         # User-facing documentation
├── .pi/                          # THIS directory — Guardian's own framework
└── guardian-manifest.json        # Framework state tracking
```

## Architecture Modules (in .pi/architecture/modules/)

| Module | Purpose |
|--------|---------|
| `cli-entry-point` | Argument parsing, command dispatch |
| `init-command` | Scaffold .pi/ + exports interactively |
| `generate-command` | Regenerate exports from .pi/ |
| `update-command` | Smart merge updates preserving edits |
| `template-system` | Load + render templates with language context |
| `manifest-system` | State tracking with hash verification |
| `core-libraries` | Retry, hooks, logger, integrity, tracking |

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | CLI entry point — argument parsing and dispatch |
| `src/commands/init.ts` | Scaffold command |
| `src/commands/generate.ts` | Export regeneration |
| `src/commands/update.ts` | Smart merge |
| `src/lib/templates.ts` | Template loading and rendering |
| `src/lib/manifest.ts` | Manifest read/write/hash operations |
| `src/lib/workflow-config.ts` | YAML front matter parsing |
| `.pi/architecture/modules/*.md` | Architecture module docs |
| `.pi/architecture/decisions/*.md` | ADRs |

## Quality Gates

### Before Commit

```bash
bash .pi/scripts/ci/run_preflight.sh
bun build ./src/index.ts --outdir ./dist
```

### Before Push

```bash
bun test
biome check .
```

### Architecture Conformance

Every implementation file MUST carry a canonical reference header pointing to its architecture module. The architecture validator checks this.

## Environment

| Variable | Purpose |
|----------|---------|
| `$GITHUB_TOKEN` | GitHub API authentication for issue/PR ops |
| `$CI` | CI environment indicator |
