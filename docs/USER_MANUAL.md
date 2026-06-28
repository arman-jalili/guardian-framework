# Guardian — User Manual

How to use every Guardian feature, from domain exploration to merge.

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Domain Exploration](#2-domain-exploration)
3. [Architecture (Modules & ADRs)](#3-architecture-modules--adrs)
4. [Project Scaffolding](#4-project-scaffolding)
5. [The Architect (Epics & Issues)](#5-the-architect-epics--issues)
6. [Local Developer Workflow](#6-local-developer-workflow)
7. [Pipeline Engine](#7-pipeline-engine)
8. [Goal Loop](#8-goal-loop)
9. [Custom Validators](#9-custom-validators)
10. [Smart Updates & Migration](#10-smart-updates--migration)

---

## 1. Quick Start

### Install & Scaffold

```bash
npx guardian-framework init
```

Follow the interactive prompts — project name, language, AI tools, validators, workflows.

This creates:
- `.pi/` — your source of truth (agent instructions, architecture, skills, extensions, prompts)
- Exports for selected tools — `.claude/`, `.opencode/`, `.agents/`, `.github/`

The default generates everything you need. You can also use `--nonInteractive` flags:

```bash
npx guardian-framework init \
  --projectName my-app \
  --language typescript \
  --tools pi,claude \
  --validators ci,tests,security
```

### Available Flags

| Flag | Description |
|------|-------------|
| `--projectName` | Project name |
| `--version` | Project version |
| `--repository` | GitHub repo (owner/repo) |
| `--language` | typescript, python, java, rust, go |
| `--tools` | Comma-separated: pi, claude, opencode, agents, github |
| `--validators` | Comma-separated: ci, tests, operations, security, integration, architecture, canonical |
| `--nonInteractive` | Skip prompts (requires all flags) |
| `--force` | Overwrite existing framework without confirmation |

---

## 2. Domain Exploration

Use domain-driven design to explore a business domain and produce structured knowledge.

```bash
guardian domain --explore
# or via slash command inside pi:
#   /domain --explore
```

This starts an LLM-powered exploration session. You describe a business domain and Guardian produces:

- **Bounded contexts** — distinct areas of the domain with clear boundaries
- **Entities & value objects** — key domain concepts with attributes and behaviors
- **Ubiquitous language** — shared terminology glossary
- **Domain events** — significant occurrences in the domain
- **Aggregates** — clusters of entities with transactional boundaries

### Options

| Flag | Description |
|------|-------------|
| `--context` | Initial context to seed exploration |
| `--session` | Session ID for saving/loading |
| `--dryRun` | Simulate without writing files |

### Output

Results are saved to `.pi/domain/`:
- `exploration.md` — full exploration document
- `ubiquitous-language.md` — shared glossary

The exploration can be iterative — run multiple sessions building on previous results.

---

## 3. Architecture (Modules & ADRs)

After domain exploration, define your architecture.

### Architecture Modules

Create a module document in `.pi/architecture/modules/` describing a bounded context or subsystem:

```markdown
# Auth System — Architecture Module

## Responsibilities
- User authentication and session management
- OAuth integration (GitHub, Google)

## Interfaces
- POST /api/auth/login → returns JWT token
- POST /api/auth/refresh → rotates token

## Dependencies
- User Repository (core domain)

## Implementation Constraints
- Tokens must expire after 1 hour
- All password operations via bcrypt
```

### Architecture Decision Records (ADRs)

Document important decisions in `.pi/architecture/decisions/`:

```markdown
# ADR-001: Authentication Strategy

## Status
Accepted

## Context
Need stateless auth that works across services.

## Decision
Use JWT with 1-hour expiry, stored in HTTP-only cookies.

## Consequences
- Token refresh required every hour
- No server-side session storage needed
```

### Module Template

Use the scaffolded template at `.pi/architecture/modules/module-template.md`:

```
# [Module Name] — Architecture Module

## Responsibilities

## Interfaces
- Inputs:
- Outputs:

## Dependencies

## Implementation Constraints
```

---

## 4. Project Scaffolding

Generate source code from your architecture modules.

```bash
guardian project create --lang java --buildTool maven --groupId com.mycompany
```

### Options

| Flag | Description |
|------|-------------|
| `--lang` | Language: java, typescript |
| `--buildTool` | maven, gradle, bun (depends on language) |
| `--groupId` | Maven group ID |
| `--validators` | Comma-separated validator categories |
| `--dryRun` | Preview without writing |
| `--force` | Overwrite existing project |

### Structure Generated

```
src/main/java/com/mycompany/
  Application.java
  config/
  controller/
  service/
  repository/
  model/
```

Architecture modules are mapped to package structure with canonical reference headers linking each file back to its source.

---

## 5. The Architect (Epics & Issues)

The Architect orchestrates the work pipeline — from epics to implementation.

### Create an Epic

Using the `/architect` extension inside pi:

```
/epic create "Add payment processing"
```

This creates an epic overview with scope, modules affected, and expected outcomes.

### Slice into Issues

```
/epic slice "Add payment processing"
```

The Architect analyzes your architecture modules and slices the epic into tracked issues:

```
TK-0001: Payment model (entities, value objects, repository interface)
TK-0002: Payment gateway integration (Stripe adapter, webhooks)
TK-0003: Payment API endpoints (REST controller, validation, error handling)
TK-0004: Payment reconciliation (scheduled batch, reporting)
```

### Implementation Flow

1. **Plan** — Architect produces an issue plan with modules, files, acceptance criteria
2. **Code** — Agent implements per the plan
3. **Validate** — Per-slice validators run (scope auto-selected from Simple to Critical)
4. **Close** — Issues close automatically when validators pass

### Closeout

When all issues are done:

```
/epic closeout "Add payment processing"
```

The Architect:
- Summarizes what was built
- Validates architecture conformance
- Generates closeout report

---

## 6. Local Developer Workflow

Run validation locally before pushing — catch issues early.

### Preflight

```bash
bash .pi/scripts/ci/run_preflight.sh
```

Runs the local subset of CI checks: linting, architecture conformance, security scanning.

### Specific Stages

```bash
bash .pi/scripts/ci/run_stage.sh docs_policy
bash .pi/scripts/ci/run_stage.sh architecture_conformance
bash .pi/scripts/ci/run_stage.sh security
bash .pi/scripts/ci/run_stage.sh release_readiness
```

### Validate Agent Output

```bash
bash .pi/scripts/ci/validate_agent_output.sh \
  --input=validator_output.md \
  --schema=architecture-validator
```

---

## 7. Pipeline Engine

Run a structured multi-step workflow across a list of items.

### Use Case

"Close all P1 bugs" — same process applied to 15 different bugs.

### Start a Pipeline

```
/pipeline start "Sprint-47 cleanup" \
  --items "TK-0101,TK-0102,TK-0103" \
  --steps "Plan,Implement,Validate,Merge"
```

This creates a state machine that tracks each item through each step.

### Acceptance Gates

Each step can have:
- **Shell validators** — run scripts, must pass
- **LLM judge** — agent evaluates if conditions met
- **Manual approval** — user confirms before advancing

### Track Progress

```
/pipeline status
# Shows: TK-0101 → Implement (running)
#        TK-0102 → Validate (passed)
#        TK-0103 → Merge (blocked: needs review)
```

### When to Use

| Use Case | Tool |
|----------|------|
| Single objective | `/goal` |
| Same process × many items | `/pipeline` |

---

## 8. Goal Loop

Set a persistent objective that the agent auto-iterates until done.

### Set a Goal

```
/goal Fix all TypeScript strict mode errors in src/
```

The agent works on this goal across turns until:
- All validators pass
- LLM judge confirms completion
- Turn budget exhausted (you see summary of what was done)

### Manage Goals

| Command | Description |
|---------|-------------|
| `/goal` | Set a new goal |
| `/subgoal "..."` | Decompose current goal into sub-steps |
| `/goal status` | Show progress, remaining work |
| `/goal cancel` | Abort current goal |

### How It Works

```
Turn 1: Agent reads files, identifies type errors → plans fixes
Turn 2: Fixes first batch of errors → runs tsc --noEmit
Turn 3: Fixes remaining errors → tsc passes → LLM confirms done ✓
```

### Dual Validation

Goals are evaluated by both:
- **Validators** — automated checks (tsc passes, tests pass, etc.)
- **LLM judge** — semantic check (did we actually solve the problem?)

---

## 9. Custom Validators

Guardian ships with 7 validator categories. You can add custom ones.

### Built-in Categories

| Validator | What It Checks |
|-----------|---------------|
| `ci` | CI pipeline configuration, script health |
| `tests` | Test coverage, test structure |
| `operations` | Observability, logging, error handling |
| `security` | Injection, auth bypass, secret leakage |
| `integration` | Component wiring, interface contracts |
| `architecture` | Module boundaries, dependency direction |
| `canonical` | Architecture reference headers in implementation files |

### Scope Auto-Selection

Validators auto-select based on change scope:

| Scope | Validators Run |
|-------|---------------|
| **Simple** (1-2 files) | ci, tests |
| **Moderate** (3-10 files) | ci, tests, operations |
| **Complex** (multi-module) | ci, tests, operations, security, integration, architecture |
| **Critical** (breaking) | All 7 categories |

### Custom TOML Filters

Define output compression in `.pi/validators/`:

```toml
# .pi/validators/my-filter.toml
[[filters]]
name = "log-timestamp"
match = "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}"
replace = "<iso-timestamp>"
cost = 2.0

[[filters.tests]]
input = "2026-06-27T10:30:00Z ERROR timeout"
expected = "<iso-timestamp> ERROR timeout"
```

Trust-gated: Guardian asks before enabling project-level filters.

---

## 10. Smart Updates & Migration

Update Guardian without losing your customizations.

### Dry Run First

```bash
guardian update --dryRun
# Preview: 3 files added, 2 files merged, 1 file preserved
```

### Apply Update

```bash
guardian update
```

Guardian's update algorithm preserves your edits:

- **Unchanged files** → overwrite safely
- **Your config (YAML front matter)** → merged with new template body
- **Modified files without front matter** → preserved (not overwritten)
- **New features** → added automatically
- **Deprecated files** → noted, not deleted

### Upgrade (Breaking Changes)

```bash
guardian upgrade
```

Use when updating to a new major version. Run `guardian update --dryRun` first to review.

---

## CLI Reference

### Commands

| Command | Description |
|---------|-------------|
| `guardian init` | Scaffold `.pi/` and generate exports |
| `guardian domain --explore` | DDD domain exploration |
| `guardian project create` | Generate source code from architecture |
| `guardian generate` | Regenerate exports from `.pi/` |
| `guardian update` | Smart merge template updates |
| `guardian upgrade` | Migrate to new major version |
| `guardian validate` | Run validators on current state |
| `guardian verify` | Verify file integrity |
| `guardian trust` | Manage trusted TOML configs |
| `guardian info` | Display manifest and token stats |
| `guardian stats` | Token analytics with USD estimation |
| `guardian uninstall` | Remove Guardian-managed files |

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Config error (missing manifest, invalid YAML) |
| 3 | Template error (missing template file) |
| 4 | Validation error (checks failed) |
| 5 | Hook error (before_run/after_create failed) |
