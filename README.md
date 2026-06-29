<div align="center">
  <h1>Guardian</h1>
  <p><strong>Architecture Enforcement Framework for AI-Assisted Development</strong></p>

  <a href="https://www.npmjs.com/package/guardian-framework"><img src="https://img.shields.io/npm/v/guardian-framework?style=flat&colorA=222&colorB=00bcd4" alt="npm version"/></a>
  <a href="https://github.com/arman-jalili/guardian-framework/actions"><img src="https://img.shields.io/github/actions/workflow/status/arman-jalili/guardian-framework/ci.yml?style=flat&colorA=222&colorB=00bcd4" alt="CI status"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/guardian-framework?style=flat&colorA=222&colorB=00bcd4" alt="license"/></a>
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/runtime-Bun-f472b6?style=flat&colorA=222" alt="Bun"/></a>
  <br/>
  <a href="https://github.com/arman-jalili/rigorix-oss"><img src="https://img.shields.io/badge/reference_implementation-Rigorix-00bcd4?style=flat&colorA=222" alt="Rigorix reference implementation"/></a>
</div>

---

Guardian turns software architecture into executable constraints. Instead of relying on documentation, code reviews, and tribal knowledge to prevent architectural drift, Guardian continuously verifies that implementations conform to architectural decisions throughout development.

It does not analyze architecture once. It integrates with development workflows so every implementation, issue, pull request, and merge is validated against architectural constraints. Violations become CI failures rather than documentation comments.

For example, if the architecture specifies that the Payment context may not depend on Authentication, Guardian detects the dependency during CI and blocks the change before merge.

---

## How It Works

Guardian centers on a single `.pi/` directory — the architectural source of truth. From this model it generates the concrete artifacts that enforce architecture across the full development lifecycle:

| Artifact | What It Generates |
|----------|-------------------|
| Architecture specifications | Module boundaries, component breakdowns, dependency rules, interface contracts |
| Architecture Decision Records | Structured ADR documents with status tracking and cross-references |
| Implementation epics | Component-level issues sliced from architecture modules, ordered by dependency |
| CI enforcement policies | Validator scripts, hardening stages, and merge gates that block violations |
| Agent workflows | 21 prompt templates covering feature development, bug fixes, hotfixes, refactoring, and issue lifecycle |
| Tool-specific exports | `.claude/`, `.github/`, `.opencode/`, `.agents/` directories generated from the same `.pi/` source |

The `.pi/` model also supports domain modeling with concepts like bounded contexts, entities, and domain events for teams that use those techniques. For everyone else, it works directly from architecture modules and ADRs — no DDD background required.

---

## Enforcement Through CI

Guardian enforces architecture through 7 categories of validator scripts, automatically selected based on change scope:

| Scope | Files | Lines | Validators Triggered |
|-------|-------|-------|---------------------|
| Simple | 1-2 | <= 50 | CI + canonical |
| Moderate | 3-5 | 51-200 | CI + architecture + canonical |
| Complex | 6-15 | 201-500 | CI + architecture + security + tests + integration + canonical |
| Critical | 16+ | 501+ | All 7 + human approval |

Each validator runs as a shell script during CI. Failures block the merge:

| Validator | What It Checks | Runs At |
|-----------|----------------|---------|
| CI | Build, test, lint, format, audit | All changes |
| Architecture | Module boundaries, dependency direction, ADR compliance | Moderate+ |
| Canonical | Every code file references its architecture source; docs match code | All changes |
| Security | Secrets, injection, path traversal, auth bypass | Complex+ |
| Tests | Unit, integration, coverage thresholds | Complex+ |
| Integration | Component wiring, interface contracts | Complex+ |
| Operations | Tracing, cancellation, atomic writes, error handling | Critical |

The canonical validator is the linchpin: every implementation file carries a header tracing it to a specific architecture section. When code and architecture diverge, the reference breaks and CI fails.

```typescript
/**
 * Canonical Reference: .pi/architecture/modules/auth-system.md#token-validation
 * Implements: AC-1, AC-2
 * Issue: #42
 * Last Sync: 2026-06-28
 */
```

---

## Proven in Practice

Guardian was used to build **[Rigorix](https://github.com/arman-jalili/rigorix-oss)** — a deterministic coding-agent runtime comprising 146,312 lines of Rust across 30 modules, 3 crates, and 580 commits — written by a single developer over 11 active days.

During that build:

- 18 ADRs defined the architecture
- 38 module specs described component contracts
- 44 issue drafts drove implementation across 120+ feature branches
- 7 validator scripts ran on every merge
- Architecture violations were detected in CI, reducing reliance on manual code review

[Rigorix](https://github.com/arman-jalili/rigorix-oss) serves as the public reference implementation demonstrating Guardian's workflow in practice. The architecture defined in `.pi/` was continuously validated against implementation — divergence was detected automatically before it reached the main branch.

---

## Installation

```bash
npx guardian-framework init     # Scaffold in current directory
npm install -g guardian-framework
```

**Prerequisites:** [Bun](https://bun.sh) >= 1.0.0

---

## Quick Start

### 1. Scaffold the framework

```bash
cd your-project
npx guardian-framework init
```

Interactive prompts for project name, language, AI tools, validators, and workflows.

### 2. Define your architecture

Architecture modules in `.pi/architecture/modules/` define components, dependencies, and status:

```markdown
# Auth System

## JWT Token Validation
status: planned
description: Validates JWT tokens — expiry, signature, claims.
depends: none

## OAuth2 Provider Integration
status: planned
description: Google, GitHub OAuth2 for SSO.
depends: JWT Token Validation
```

### 3. Generate the project from architecture

```bash
guardian project create --lang java --buildTool maven --groupId com.mycompany
```

Generates source tree, build config, and CI pipeline with enforcement pre-wired.

### 4. Plan and implement

```
/architect --epic "Auth Module v1"    # Creates issues from architecture modules
/epic-plan --module auth docs/auth.md # Module-specific slice
```

### 5. Validate

```bash
bash .pi/scripts/validate-ci.sh
bash .pi/scripts/validate-canonical.sh
guardian validate          # TOML-based declarative validators
```

### 6. Update and export

```bash
guardian update --dryRun    # Preview framework changes
guardian generate           # Export to .claude/, .github/, .opencode/
```

---

## CLI Commands

| Command | Purpose |
|---------|---------|
| `init` | Scaffold `.pi/` framework and exports interactively |
| `generate` | Regenerate exports from `.pi/` source |
| `update` | Smart merge new templates, preserving user edits |
| `upgrade` | Migrate to new framework version |
| `uninstall` | Remove Guardian-managed files |
| `info` | Display manifest status, token stats, export sync |
| `stats` | Token savings analytics and USD estimation |
| `validate` | Run TOML-based declarative validators |
| `verify` | SHA-256 file integrity check |
| `trust` | Trust-gated config management |
| `domain` | Domain exploration — explore, scaffold, answer, list |
| `project create` | Generate source tree, build config, CI from architecture |

### `update` — Smart Merge

```bash
guardian update --dryRun       # Preview changes
guardian update                # Apply with confirmation
guardian update --force        # Override user-modified files
guardian update --regenerate   # Update and regenerate exports
```

| File State | Action |
|------------|--------|
| New template file | Add to project |
| Unchanged framework file | Update to new version |
| User file with YAML front matter | Merge — keep user config, replace body |
| User file without front matter | Preserve — keep as-is |
| Generated export | Mark for regeneration |
| Removed from templates | Orphan — noted, not deleted |

---

## Architecture

### Directory Structure

```
.pi/
  agent/AGENTS.md              Project instructions + YAML runtime config
  architecture/
    modules/                   Module architecture docs
    decisions/                 ADRs (Architecture Decision Records)
    diagrams/                  System overview, data flow diagrams
  context/                     Shared knowledge loaded once per session
  domain/                      Domain exploration artifacts
  extensions/                  20 TypeScript extensions
  prompts/                     21 workflow prompt templates
  scripts/                     74 validator and utility shell scripts
    ci/                        17 CI stage scripts
    git/                       5 Git management scripts
    languages/                 Language-specific validators (Go=7, Java=9, Python=7, Rust=7, TypeScript=7)
  skills/
    agents/                    27 agent definitions
    validators/                10 validator skill definitions
  validators/                  TOML declarative validation configs
```

### Multi-Tool Export

| Tool | Directory | Contents |
|------|-----------|----------|
| Claude Code | `.claude/` | Context, agents, workflows, scripts, architecture |
| OpenCode | `.opencode/` | Context, prompts, workflows, scripts |
| Agents (Antigravity) | `.agents/` | Agents, context, workflows, scripts |
| GitHub Copilot | `.github/` | Instructions, agents, copilot configs, workflows |
| oh-my-pi | `.omp/` | Agents, extensions |
| pi | `.pi/skills/` | SKILL.md packages |

---

## Extensions

20 TypeScript extensions for pi (`.pi/extensions/`), zero external npm dependencies:

| Extension | Purpose |
|-----------|---------|
| `architect.ts` | Epic orchestration — discover, implement, validate, merge, close |
| `pipeline.ts` | Multi-step workflow engine with per-step acceptance gates |
| `goal-loop.ts` | Standing goals with validator judge — auto-iterates until validated |
| `kanban.ts` | Durable task board with state machine, dependencies, comments |
| `domain-explorer.ts` | Domain exploration — explore, answer, scaffold, validate |
| `project-scaffolder.ts` | Project scaffolding from architecture decisions (Epic 0) |
| `coordinator.ts` | Scope classification + validation orchestration |
| `curator.ts` | Skill lifecycle — usage tracking, stale detection, archival |
| `bash-guard.ts` | Destructive command blocking with risk analysis |
| `filechanges.ts` | File change tracking with accept/decline review |
| `plan-mode.ts` | Queued edits for batch review |
| `snippets.ts` | `#handle` token expansion |
| `session-persistence.ts` | Structured session lifecycle with auto-titling |
| `redaction.ts` | Automatic secret redaction |
| `hooks.ts` | Declarative shell hooks for lifecycle events |
| `config-reload.ts` | Hot config reload |
| `read-only-mode.ts` | Safe codebase exploration |
| `ask-user-question.ts` | Structured user prompts (text, single-select, multi-select) |
| `slash-commands.ts` | `/init`, `/validate`, `/scope`, `/snippet` commands |
| `validation-runner.ts` | `/validate` command for running validators |

---

## Workflow Prompts

21 workflow prompt templates in `.pi/prompts/`:

### Implementation Workflows
| Workflow | File | Use When |
|----------|------|----------|
| Feature Development | `feature-development.md` | New features (Moderate+ scope) |
| Bug Fix | `bug-fix.md` | Bug fixes (Simple/Moderate) |
| Emergency Hotfix | `hotfix.md` | Production issues (skip planning) |
| Refactoring | `refactoring.md` | Code improvement (behavior unchanged) |
| Issue Implementation Series | `issue-implementation-series.md` | Batch implementation via pipeline |

### Epic and Issue Management
| Workflow | File | Purpose |
|----------|------|---------|
| Epic Plan | `epic-plan.md` | Cross-module, module-slice, or free-form epic planning |
| Epic Template | `epic-template.md` | Epic definition template |
| Issue Template | `issue-template.md` | Single issue template |
| Issue Template Set | `issue-template-set.md` | Full template set for all issue types |
| Issue Draft | `issue-draft.md` | Create draft issues from approved epic |
| Git Issues | `git-issues.md` | Create epics/issues on GitHub/GitLab |
| Issue Closeout | `issue-closeout.md` | Verify AC, validators, canonical, MR |
| Issue Merge | `issue-merge.md` | Merge MR, close issue, update epic |
| Plan to Issues | `plan-to-issues.md` | Convert plan documents to GitHub/GitLab issues |

### Blueprint and Maintenance
| Workflow | File | Purpose |
|----------|------|---------|
| Blueprint Validate | `blueprint-validate.md` | Validate `.pi/` structure and integrity |
| CI Blueprint | `ci-blueprint.md` | CI pipeline configuration blueprint |
| Sync Check | `sync-check.md` | Verify exports match blueprint source |
| Context Refresh | `context-refresh.md` | Update context from codebase |
| Scope Analyzer | `scope-analyzer.md` | Auto-determine change scope + validators |
| Pattern Extract | `pattern-extract.md` | Extract patterns to `patterns.md` |
| Blueprint Update | `blueprint-update.md` | Reverse-sync implementation to blueprint |

---

## Slash Commands (Inside Pi Agent)

| Command | Description |
|---------|-------------|
| `/architect --epic "Name"` | Start epic from architecture modules |
| `/architect status` | Current epic progress |
| `/architect next-epic` | Find next logical slice |
| `/architect abort` | Cancel epic |
| `/domain --explore "..."` | Start domain exploration |
| `/domain --validate <id>` | Validate against domain files |
| `/domain --architect-scaffold <id>` | Generate module docs from exploration |
| `/project create --lang java ...` | Scaffold project |
| `/project status` | Check scaffold status |
| `/pipeline "Name" --items "A,B" --steps "x,y"` | Start multi-step pipeline |
| `/pipeline status | pause | resume | abort` | Manage pipeline |
| `/goal "objective" --validators=ci,tests` | Set persistent goal |
| `/goal status | pause | resume | clear` | Manage goal |
| `/subgoal "..." | list | remove | clear` | Manage subgoals |
| `/kanban create | list | status` | Task board |
| `/curator review | pin | unpin` | Skill lifecycle |
| `/snippet list | add | remove | edit` | Token expansion snippets |
| `/plan` / `/plan-apply` | Queue edits for batch review |
| `/validate` | Run validators |

---

## Agent Tools

Tools callable programmatically by the agent during a session:

| Tool | Purpose |
|------|---------|
| `guardian_scope` | Classify change scope (Simple to Critical) |
| `guardian_validate` | Run validation scripts by category |
| `guardian_coordinate` | Orchestrate scope + validation workflow |
| `guardian_goal_evaluate` | Evaluate goal progress (validator + LLM judge) |
| `architect_status` | Show epic state |
| `architect_discover` | Find modules + next slice |
| `pipeline_status` | Pipeline progress |
| `pipeline_advance` | Mark step passed |
| `pipeline_fail` | Mark step failed |
| `pipeline_start` | Start pipeline programmatically |
| `pipeline_next_task` | Get current item + step context |
| `pipeline_run_acceptance` | Run step acceptance gates |
| `kanban_create` | Create task |
| `kanban_list` | List tasks |
| `kanban_show` | Show task details |
| `kanban_complete` | Mark done |
| `kanban_block` | Block with reason |
| `kanban_comment` | Add comment |
| `domain_explore` | Create exploration prompt |
| `domain_save_result` | Save analysis session |
| `domain_validate` | Validate against glossary |
| `curator_review` | Detect stale skills |
| `curator_pin` | Protect from archival |
| `curator_unpin` | Allow archival |
| `ask_user_question` | Ask user structured questions |

---

## Token Optimization

Guardian includes several mechanisms to reduce token consumption when working with LLM-based coding agents:

| Mechanism | How It Works |
|-----------|-------------|
| DRY Context | Shared templates loaded once per session rather than per-turn |
| Snippet Expansion | `#handle` tokens expand to full content on demand |
| TOML Filters | 8-stage filter pipeline compresses command output before sending to LLM |
| Validator Scripts | Shell scripts replace LLM-based checks for mechanical validations |
| Context Compaction | Budget-aware truncation prioritizing structurally important lines |

Token tracking with USD estimation is available via `guardian stats`.

---

## Supported Languages

| Language | Build | Test | Lint | Format | Validators |
|----------|-------|------|------|--------|------------|
| TypeScript | `bun build` | `bun test` | `biome check` | `biome format` | 7 |
| Rust | `cargo build` | `cargo test` | `cargo clippy` | `cargo fmt` | 7 |
| Python | `python -m build` | `pytest` | `ruff check` | `ruff format` | 7 |
| Go | `go build ./...` | `go test ./...` | `golangci-lint` | `gofmt` | 7 |
| Java / Spring Boot | `mvn` / `gradle` | JUnit + Mockito | Checkstyle / Spotless | Spotless | 9 |

---

## Workflow Configuration

`.pi/agent/AGENTS.md` carries YAML front matter defining runtime settings:

```yaml
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
bun run build          # Build CLI (dist/cli.js) and library (dist/exports.js)
bun test               # Run tests
bun run lint           # biome check .
bun run format         # biome format . --write
bun run typecheck      # tsc --noEmit
```

---

## Documentation

- **User Manual:** [docs/USER_MANUAL.md](docs/USER_MANUAL.md) — 28 sections covering all workflows, verified against source
- **Contributing:** [CONTRIBUTING.md](CONTRIBUTING.md)
- **Security:** [SECURITY.md](SECURITY.md)
- **Changelog:** [CHANGELOG.md](CHANGELOG.md)
- **Code of Conduct:** [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- **Architecture:** See `.pi/architecture/decisions/` for all ADRs

---

## License

MIT

## Links

- **Source:** https://github.com/arman-jalili/guardian-framework
- **Reference Implementation:** [Rigorix](https://github.com/arman-jalili/rigorix-oss) — deterministic coding-agent runtime built with Guardian (146K LOC Rust, 30 modules, 580 commits, 11 active days)
- **Pi Framework:** https://github.com/earendil-works/pi
