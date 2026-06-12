# Guardian

**Architecture-First SDLC Framework**

Guardian is a complete **architecture-first software development lifecycle framework** — from domain exploration to production. It scaffolds, validates, and orchestrates AI-assisted development workflows with deterministic quality gates at every stage.

> **From domain discovery → architecture decisions → project generation → epic planning → implementation → validation → merge → closeout.**
>
> All traceable, all validated, all in one framework.

---

## Why Guardian

Most AI coding tools operate in isolation: you prompt, they generate, you pray. Guardian inverts this — **architecture first, code second, validation always**.

| Stage | What Guardian Does |
|-------|-------------------|
| **🧭 Domain Exploration** | DDD-driven exploration with LLM: discover bounded contexts, entities, ubiquitous language |
| **🏛️ Architecture Decisions** | ADR system, module docs, canonical references — everything traces back |
| **🏗️ Project Scaffolding** | `guardian project create` generates source trees, build configs, CI pipelines FROM architecture |
| **📋 Epic & Issue Planning** | Full workflow: epic overview → module slices → issues → implementation → closeout → merge |
| **✅ Multi-Stage Validation** | 7 validator categories with scope-based auto-selection (Simple → Critical) |
| **🤖 Pi Extensions** | 20 TypeScript extensions: bash-guard, kanban, pipeline, architect, goal-loop, plan-mode, curator, domain-explorer, project-scaffolder |
| **📤 Multi-Tool Export** | Single `.pi/` source → Claude Code, OpenCode, GitHub Copilot, `.agents/`, oh-my-pi |
| **🔋 Token Optimization** | DRY context, snippet expansion, context compaction, tiered prompts — 50–70% savings |

**Result:** Every line of code traces to a validated architecture decision. No orphaned code. No drift. No surprises.

---

## 🧭 The Full SDLC Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PHASE 1: DISCOVER                                                      │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────────────────┐   │
│  │ domain       │→ │ ubiquitous     │→ │ architecture modules +   │   │
│  │ explore      │  │ language       │  │ ADRs                     │   │
│  └──────────────┘  └────────────────┘  └──────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│  PHASE 2: SCAFFOLD                                                      │
│  ┌────────────────┐  ┌────────────────────┐  ┌────────────────────────┐   │
│  │ guardian init  │→ │ guardian project   │→ │ guardian generate      │   │
│  │ (framework)    │  │ create  OR         │  │ (multi-tool exports)   │   │
│  │                │  │ /project create    │  │                        │   │
│  └────────────────┘  └────────────────────┘  └────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────┤
│  PHASE 3: PLAN                                                          │
│  ┌──────────────┐  ┌────────────┐  ┌───────────────┐  ┌────────────┐  │
│  │ /epic-plan   │→ │ /issue-    │→ │ /git-issues   │→ │ implement  │  │
│  │ (overview)   │  │ draft      │  │ (create on    │  │            │  │
│  │ --module     │  │            │  │  GH/GL)       │  │            │  │
│  └──────────────┘  └────────────┘  └───────────────┘  └────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│  PHASE 4: IMPLEMENT                                                      │
│  ┌──────────────┐  ┌────────────┐  ┌───────────────┐                    │
│  │ code-develop │→ │ validate   │→ │ issue-closeout│                    │
│  │ (subagent)   │  │ (all gates)│  │ + compliance  │                    │
│  │              │  │            │  │ MR            │                    │
│  └──────────────┘  └────────────┘  └───────────────┘                    │
├─────────────────────────────────────────────────────────────────────────┤
│  PHASE 5: SHIP                                                          │
│  ┌──────────────┐  ┌────────────┐                                       │
│  │ /issue-merge │→ │ production │                                       │
│  │ (close epic) │  │            │                                       │
│  └──────────────┘  └────────────┘                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Installation

```bash
# Run directly (no installation needed)
npx guardian-framework init

# Or install globally
npm install -g guardian-framework
```

---

## Quick Start

### 1. Explore your domain

**CLI:**
```bash
# DDD-driven domain exploration with LLM
guardian domain explore --context "We build a fintech payment platform..."

# View existing sessions
guardian domain list

# Scaffold architecture from exploration
guardian domain scaffold <session-id>
```

**Or inside the pi agent (consistent with `/architect`):**
```
/domain --explore "We build a fintech payment platform..."
/domain --architect-scaffold <session-id>
/domain --validate <session-id>
```

This produces: bounded contexts, entities, value objects, ubiquitous language glossary, and domain event catalog.

### 2. Scaffold the framework

```bash
cd your-project
npx guardian-framework init
```

Interactive prompts guide you through project name, language, AI tools, group/package prefix, and an optional business domain description. All validators and workflow templates are scaffolded by default.

### 3. Scaffold a project from architecture

```bash
# Generates source tree, build config, CI pipeline FROM architecture decisions
# --groupId is optional: reads from guardian-manifest.json if not specified
guardian project create --lang java --buildTool maven --groupId com.mycompany
```

### 4. Plan and implement epics

```bash
# Cross-module epic plan (inside pi agent)
/epic-plan --overview

# Module-specific slice
/epic-plan --module auth docs/auth-architecture.md

# Single feature
/epic-plan "add OAuth login"
```

### 5. Run validators

```bash
bash .pi/scripts/validate-ci.sh
bash .pi/scripts/validate-canonical.sh
guardian validate          # TOML-based declarative validators
guardian verify            # SHA-256 integrity check
```

### 6. Update framework

```bash
npx guardian-framework update
```

Smart-merges new template versions — preserves user edits, merges YAML config.

### 7. Generate exports

```bash
npx guardian-framework generate
```

Creates `.claude/`, `.opencode/`, `.agents/`, `.github/` from `.pi/` source.

---

## CLI Commands

| Command | Purpose |
|---------|---------|
| `init` | Scaffold `.pi/` framework + exports interactively |
| `generate` | Regenerate exports from `.pi/` source |
| `update` | Smart merge new templates, preserving user edits |
| `upgrade` | Migrate to new framework version |
| `uninstall` | Remove Guardian-managed files |
| `info` | Display manifest status, token stats, coverage |
| `stats` | Token savings analytics and USD estimation |
| `validate` | Run TOML-based declarative validators |
| `verify` | SHA-256 file integrity verification |
| `trust` | Trust-gated config management |
| `domain` | **DDD Domain Exploration** — explore, scaffold, answer, list |
| `project` | **Project Scaffolding** — `project create` from architecture |

### `domain` — DDD Domain Exploration

**CLI:**
```bash
guardian domain explore --context "Describe your business domain..."
guardian domain explore --context "..." --session my-session   # Resume session
guardian domain explore --context "..." --dry-run               # Preview only
guardian domain scaffold <session-id>                           # Generate .pi/ from exploration
guardian domain answer <session-id> <response-file>             # Continue with custom response
guardian domain list                                            # List all sessions
```

**Inside pi agent (slash command):**
```
/domain --explore "Describe your business domain..."
/domain --answer <session-id> <response-file>
/domain --architect-scaffold <session-id>
/domain --validate <session-id>
```

Consistent with `/architect` — discover your domain before architecting it.

Produces:
- **Bounded contexts** with entities, value objects, domain events
- **Ubiquitous language** glossary (canonical terms + prohibited aliases)
- **Architecture prompts** for ADR and module generation
- **Exploration sessions** stored in `.pi/domain/exploration/`

### `project create` — Architecture-Driven Scaffolding

**CLI:**
```bash
guardian project create --lang java --buildTool maven --groupId com.mycompany
guardian project create --lang typescript --validators ci,tests,security --dry-run
guardian project create --lang java --buildTool gradle --force
```

`--groupId` is optional when a `guardian-manifest.json` exists (set during `init`).

**Inside pi agent (slash command):**
```
/project create --lang java --buildTool maven --groupId com.mycompany
/project create --lang typescript --validators ci,tests,security --dryRun
/project create --lang java --buildTool gradle --force
/project status
```

Consistent with `/domain` and `/architect` — this is **Epic 0**, run after domain exploration.

### `architect` — Epic Orchestration

**Inside pi agent (slash command):**
```
/architect --epic "Name" [--tracking-issue N]    Start new epic from architecture modules
/architect status                                  Show current epic state and progress
/architect next-epic                               Find next logical slice to implement
/architect abort                                   Cancel current epic
```

Starts a new epic from the architecture in `.pi/architecture/modules/`. Optionally link a GitHub/GitLab tracking issue with `--tracking-issue`.

Consistent with `/domain` and `/project` — plan epics after architecture is scaffolded, then drill into modules with `/epic-plan`.

Reads architecture modules from `.pi/architecture/modules/` and generates:
- **Source directory tree** matching module boundaries and layer decisions
- **Build configuration** (`pom.xml` / `build.gradle`) with test, coverage, lint plugins
- **CI pipeline** (`.github/workflows/ci.yml`) with Guardian's hardening stages pre-wired
- **Stage scripts** (`.pi/scripts/ci/stage_*.sh`) matching selected validators
- **Placeholder source files** with canonical reference headers

Detects existing projects and becomes a verification/no-op automatically.

### `update` — Smart Merge

```bash
guardian update --dryRun          # Preview changes (safe)
guardian update                   # Apply with confirmation
guardian update --force           # Override user-modified files
guardian update --regenerate      # Update + regenerate exports
```

**Merge strategy:**

| File State | Action |
|------------|--------|
| New template file | **Add** to project |
| Unchanged framework file | **Update** to new version |
| User file with YAML front matter | **Merge** — keep user config, replace body |
| User file without front matter | **Preserve** — keep as-is |
| Generated export | **Mark** for regeneration |
| Removed from templates | **Orphan** — noted, not deleted |

---

## 🏛️ Architecture

### Directory Structure

```
.pi/                              ← Source of truth (version-controlled)
├── agent/AGENTS.md               ← Project instructions + runtime config (YAML front matter)
├── architecture/                 ← Full architecture lifecycle
│   ├── modules/                  ← Module architecture docs (one per bounded context)
│   ├── decisions/                ← ADRs (Architecture Decision Records)
│   ├── diagrams/                 ← System overview, data flow diagrams
│   ├── CHANGELOG.md              ← Architecture change log
│   └── design-spec.md            ← Full design specification
├── context/                      ← Shared knowledge loaded once per session
│   ├── project.md                ← Project facts and commands
│   ├── patterns.md               ← Code pattern templates
│   ├── checklists.md             ← Validation checklists
│   └── output-formats.md         ← Report templates
├── domain/                       ← DDD domain exploration artifacts
│   └── exploration.md            ← Exploration sessions, ubiquitous language
├── skills/                       ← Agent definitions + codex skills
│   ├── agents/                   ← 15 agent definitions (coordinator, developer, validators...)
│   └── validators/               ← Validator skill definitions
├── prompts/                      ← 22 workflow prompt templates
│   ├── feature-development.md    ← Standard feature workflow
│   ├── epic-plan.md              ← Multi-module epic planning
│   ├── issue-draft.md            ← Issue drafting from epics
│   ├── git-issues.md             ← GitHub/GitLab issue creation
│   ├── issue-closeout.md         ← Validation + compliance MR
│   ├── issue-merge.md            ← Merge + close + track
│   ├── scope-analyzer.md         ← Auto scope classification
│   └── ... (22 total)
├── scripts/                      ← Automated validators (shell)
│   ├── validate-ci.sh            ← Build, test, lint, format, audit
│   ├── validate-tests.sh         ← Unit, integration, coverage
│   ├── validate-security.sh      ← Secrets, injection, path traversal
│   ├── validate-operations.sh    ← Tracing, cancellation, atomic writes
│   ├── validate-architecture.sh  ← Layer structure, ADR compliance
│   ├── validate-canonical.sh     ← Canonical reference integrity
│   ├── validate-integration.sh   ← Component integration checks
│   ├── validate-architecture-readiness.sh ← Architecture readiness gates
│   ├── languages/java/           ← 8 Java/Spring-specific validators
│   ├── create-mr.sh              ← MR creation with pre-validation
│   ├── merge-mr.sh               ← MR merge + cleanup
│   └── ... (20+ total)
├── validators/                   ← TOML declarative validation
│   ├── default.toml              ← Built-in validators with inline tests
│   └── spring.toml               ← Spring Boot annotation enforcement
├── extensions/                   ← 19 Pi TypeScript extensions
│   ├── architect.ts              ← Epic orchestration (discover → implement → merge)
│   ├── pipeline.ts               ← Multi-step workflow engine
│   ├── kanban.ts                 ← Durable task board
│   ├── goal-loop.ts              ← Standing goals with validator judge
│   ├── curator.ts                ← Skill lifecycle management
│   ├── coordinator.ts            ← Scope classification + validation tools
│   ├── bash-guard.ts             ← Destructive command blocking
│   ├── filechanges.ts            ← File change tracking
│   ├── plan-mode.ts              ← Queued mutations for batch review
│   ├── redaction.ts              ← Secret auto-redaction
│   └── ... (19 total)
└── github/                       ← GitHub Copilot export templates
```

---

## Validators

| Validator | Checks | When |
|-----------|--------|------|
| **CI** | Build, test, lint, format, audit | All tasks |
| **Test** | Unit, integration, coverage | Moderate+ scope |
| **Security** | Secrets, injection, path traversal | Complex+ scope |
| **Operations** | Tracing, cancellation, atomic writes | Plan review |
| **Architecture** | Layer structure, ADR compliance, module boundaries | Moderate+ scope |
| **Canonical** | Reference integrity, coverage, ADR cross-references | All tasks |
| **Integration** | Component integration contracts | Complex+ scope |

### Scope Classification

| Scope | Files | Lines | Validators |
|-------|-------|-------|------------|
| Simple | 1 | < 50 | CI + canonical |
| Moderate | 2–5 | 50–200 | CI + architecture + canonical |
| Complex | 5–15 | 200–500 | CI + architecture + security + canonical |
| Critical | 15+ | 500+ | All + human approval |

### Java/Spring Validators

For Java Spring Boot projects, additional validators enforce:

| Validator | Checks |
|-----------|--------|
| `validate-annotations.sh` | `@Transactional` usage, field injection, persistence layering |
| `validate-spring-architecture.sh` | Package ring boundaries, dependency direction |
| `validate-security.sh` | `@PreAuthorize`, CSRF, SQL injection patterns |
| `validate-architecture.sh` | Package structure, interface segregation |
| `validate-canonical.sh` | Reference integrity for Java types |
| `validate-ci.sh` | Maven/Gradle build, Checkstyle, Spotless |
| `validate-tests.sh` | JUnit, Mockito, coverage thresholds |
| `validate-integration.sh` | Spring context loading, REST contract, DB migration |

---

## Canonical Reference System

Every implementation file carries a header pointing to its architecture source:

```typescript
/**
 * Canonical Reference: .pi/architecture/modules/auth-system.md#token-validation
 * Implements: AC-1, AC-2
 * Issue: #42
 * Last Sync: 2026-06-03
 */
```

`validate-canonical.sh` enforces:
- **Reference integrity** — all references point to existing architecture sections
- **Coverage ≥ 50%** — at least half of implementation files are traced
- **ADR cross-references** — architecture decisions linked to implementations

---

## Pi Extensions

Guardian ships 19 Pi extensions that enable the full SDLC workflow inside the agent:

| Extension | Purpose |
|-----------|---------|
| **`architect.ts`** | **Epic orchestration** — end-to-end from architecture discovery to implementation, validation, MR creation, merge, and close (`/architect`) |
| **`domain-explorer.ts`** | **DDD Domain exploration** — explore, answer, scaffold architecture, validate (`/domain --explore`, `--answer`, `--architect-scaffold`, `--validate`) |
| **`project-scaffolder.ts`** | **Project scaffolding from architecture** — Epic 0 (`/project create --lang java --buildTool maven`, `/project status`) |
| **`pipeline.ts`** | **Multi-step workflow engine** with per-step acceptance gates (`/pipeline`) |
| **`kanban.ts`** | **Durable task board** with state machine, dependencies, comments, priority |
| **`goal-loop.ts`** | **Standing goals** with validator-backed judge (`/goal`, `/subgoal`). Auto-iterates until validated |
| **`coordinator.ts`** | **Scope classification** + validation orchestration (guardian_scope, guardian_validate, guardian_coordinate) |
| **`curator.ts`** | **Skill lifecycle** — usage tracking, stale detection, archival with pin/restore |
| `bash-guard.ts` | Blocks destructive commands with risk analysis TUI |
| `filechanges.ts` | Tracks all file modifications with accept/decline review |
| `read-only-mode.ts` | Safe codebase exploration (read/grep/find/ls only) |
| `ask-user-question.ts` | Structured questions: text, single-select, multi-select |
| `config-reload.ts` | Dynamic config reload on AGENTS.md change |
| `plan-mode.ts` | Queued mutations for batch review (`/plan`) |
| `slash-commands.ts` | `/init`, `/validate`, `/scope`, `/snippet` commands |
| `session-persistence.ts` | Structured session lifecycle with auto-titling |
| `snippets.ts` | `#handle` token expansion (70–90% token savings) |
| `redaction.ts` | Automatic secret redaction (API keys, tokens, JWTs) |
| `hooks.ts` | Declarative shell hooks for lifecycle events |
| `validation-runner.ts` | `/validate` command for running validator scripts |
| `domain-explorer.ts` | Domain exploration tool integration |
| `project-scaffolder.ts` | Epic 0 — scaffold project from architecture decisions (`/project create`, `/project status`) |

Zero external npm dependencies — all self-contained.

---

## Agent Skills

Guardian defines **15 agent roles** for subagent delegation:

| Role | Purpose | Delegation |
|------|---------|------------|
| **architecture-coordinator** | Master orchestrator, classifies scope, spawns validators | Primary |
| **code-developer** | Primary implementation agent | Subagent |
| **architecture-validator** | Architecture compliance, ADR alignment | Subagent |
| **security-validator** | Security review — injection, auth, secrets | Subagent |
| **test-validator** | Test coverage and quality validation | Subagent |
| **operations-validator** | Production readiness — tracing, cancellation, error handling | Subagent |
| **integration-validator** | Component integration validation | Subagent |
| **ci-mr-validator** | CI pipeline and merge readiness (automated) | Subagent |
| **issue-creator** | GitHub/GitLab issue management | Subagent |
| **documentation-maintainer** | Keeps docs in sync with code | Subagent |

### Codex Skills

| Skill | Purpose |
|-------|---------|
| `commit` | Clean, logical commits with Conventional Commits |
| `push` | Sync with remote, merge main, publish updates |
| `pull` | Sync with latest origin/main before implementation |
| `land` | PR merge loop with full validation — never `gh pr merge` directly |
| `debug` | Systematic debugging: observe → reproduce → hypothesize → verify → fix |

---

## Workflow Templates (22 total)

Guardian provides complete workflow templates for the entire SDLC:

### Implementation Workflows
| Workflow | File | Use When |
|----------|------|----------|
| Feature Development | `feature-development.md` | New features |
| Bug Fix | `bug-fix.md` | Bug fixes |
| Emergency Hotfix | `hotfix.md` | Production issues |
| Refactoring | `refactoring.md` | Code improvement |
| Issue Implementation Series | `issue-implementation-series.md` | Batch implementation |

### Epic & Issue Management
| Workflow | File | Purpose |
|----------|------|---------|
| Epic Plan (Overview) | `epic-plan.md` | Cross-module epic planning |
| Epic Plan (Module Slice) | `epic-plan.md` | Module-specific epic from architecture doc |
| Epic Plan (Free-Form) | `epic-plan.md` | Quick single-feature planning |
| Issue Draft | `issue-draft.md` | Create draft issues from approved epic |
| Git Issues | `git-issues.md` | Create epics/issues on GitHub/GitLab |
| Issue Closeout | `issue-closeout.md` | Verify AC → validators → canonical → MR |
| Issue Merge | `issue-merge.md` | Merge MR → close issue → update epic |
| Plan to Issues | `plan-to-issues.md` | Convert plans to GitHub/GitLab issues |

### Blueprint & Maintenance
| Workflow | File | Purpose |
|----------|------|---------|
| Blueprint Validate | `blueprint-validate.md` | Validate `.pi/` structure and integrity |
| Sync Check | `sync-check.md` | Verify exports match blueprint source |
| Context Refresh | `context-refresh.md` | Update context from codebase reality |
| Scope Analyzer | `scope-analyzer.md` | Auto-determine change scope + validators |
| Pattern Extract | `pattern-extract.md` | Extract patterns to `patterns.md` |
| Blueprint Update | `blueprint-update.md` | Reverse-sync implementation to blueprint |

---

## Supported Languages

| Language | Build | Test | Lint | Format | Validators |
|----------|-------|------|------|--------|------------|
| TypeScript | `bun build` | `bun test` | `biome check` | `biome format` | 7 generic |
| Rust | `cargo build` | `cargo test` | `cargo clippy` | `cargo fmt` | 7 generic |
| Python | `python -m build` | `pytest` | `ruff check` | `ruff format` | 7 generic |
| Go | `go build ./...` | `go test ./...` | `golangci-lint` | `gofmt` | 7 generic |
| Java / Spring Boot | `mvn` / `gradle` | JUnit + Mockito | Checkstyle / Spotless | Spotless | 8 language-specific |

---

## Token Optimization

While Guardian's scope has grown far beyond token optimization, it remains highly token-efficient:

| Mechanism | How It Works | Typical Savings |
|-----------|-------------|----------------|
| **DRY Context** | Shared templates loaded once per session | 20–40% |
| **Snippet Expansion** | `#handle` tokens replace full skill files | 70–90% per skill |
| **TOML Filters** | 8-stage pipeline compresses command output | 30–60% of output |
| **Validator Scripts** | Shell scripts replace LLM-based mechanical checks | 100% for checks |
| **Tiered Prompts** | Lite prompts for fast models (~750 tokens/turn) | Per-turn savings |
| **Context Compaction** | Budget-aware elision at thresholds | 15–30% of context |

---

## TOML Validator System

Declarative, testable, layered validation:

```toml
# .pi/validators/spring.toml
[[filters]]
name = "logback-pattern"
match = "\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}"
replace = "<timestamp>"
cost = 4.0

[[filters.tests]]
input = "2026-05-14 10:30:00 INFO started"
expected = "<timestamp> INFO started"
```

Three tiers: **built-in** (framework defaults) → **global** (`~/.config/guardian/filters.toml`) → **project** (`.pi/validators/*.toml`, trust-gated).

---

## Workflow Config (YAML Front Matter)

`.pi/agent/AGENTS.md` carries YAML front matter defining runtime settings:

```yaml
workspace:
  root: ".pi/workspaces"
  hooks:
    timeout_ms: 60000

agent:
  max_turns: 20
  max_retry_backoff_ms: 300000
  stall_timeout_ms: 300000

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

curator:
  enabled: true
  stale_after_days: 30
  archive_after_days: 90
  auto_review: true
```

---

## Development

```bash
bun install
bun run build        # bun build --target=bun ./src/index.ts --outdir ./dist
bun test
bun run lint         # biome check .
bun run format       # biome format . --write
bun run typecheck    # bunx tsc --noEmit
```

---

## License

MIT

## Links

- **Source:** https://github.com/arman-jalili/guardian-framework
- **Architecture:** [.pi/architecture/architecture-overview.md](.pi/architecture/architecture-overview.md)
- **Design Spec:** [.pi/architecture/design-spec.md](.pi/architecture/design-spec.md)
- **Architecture Modules:** [.pi/architecture/modules/](.pi/architecture/modules/)
- **ADRs:** [.pi/architecture/decisions/](.pi/architecture/decisions/)
- **CHANGELOG:** [.pi/architecture/CHANGELOG.md](.pi/architecture/CHANGELOG.md)
- **Pi Framework:** https://github.com/badlogic/pi-mono

---

## 🧠 How Commands Work: The sendMessage Pattern

Guardian extensions use `pi.sendMessage()` with `triggerTurn: true` to get the agent to continue working after a command, instead of returning text that the agent treats as "command complete — waiting for user."

| Command | What happens |
|---------|-------------|
| `/domain --explore` | Extension writes stub files, sends DDD prompt as new turn → agent fills in analysis |
| `/domain --architect-scaffold` | Extension generates modules/ADRs/diagrams, sends results as new turn → agent reviews |
| `/domain --validate` | Extension validates structure, sends results as new turn → agent reports |
| `/architect --epic "Name"` | Extension creates epic state, prompts agent to plan implementation across modules |
| `/architect status` | Extension returns current epic state and component progress as new turn |
| `/architect next-epic` | Extension analyzes modules to find the next unstarted slice, sends results as new turn |

This pattern works because `pi.sendMessage()` injects a message as a **user conversation turn**, not as a command response. The agent processes it naturally — calling tools, writing files, and continuing the workflow.

Without this pattern, the agent sees command output as "finished" and waits for the user.

## 📋 Full Lifecycle

```
1. guardian-framework init     → scaffold framework in project
2. /domain --explore "..."     → discover domain, fill exploration.md + glossary
3. /domain --architect-scaffold <id>  → generate modules, ADR-001, diagrams
4. guardian project create     → Epic 0: project scaffolding (greenfield)
5. /architect --epic "Name"    → start epic from architecture modules
6. /epic-plan --module <name>  → per-module planning (4-phase pipeline)
7. /implement-series           → implement issues
```

See `.pi/context/domain-workflow.md` for detailed step-by-step.
