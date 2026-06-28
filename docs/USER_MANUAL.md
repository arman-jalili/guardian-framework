# Guardian — Complete User Manual

Guardian is organized into **workflow modes**. Each mode has a purpose, a starting command, and a flow that the agent follows using prompt templates.

---

## Quick Reference

| Mode | Start With | Purpose |
|------|-----------|---------|
| Domain Mode | `/domain --explore` | Discover business domain → bounded contexts → glossary |
| Epic-Plan Mode | `/epic-plan` | Read architecture → plan modules → slice into issues |
| Architect Mode | `/architect --epic` | Create epic → auto-generate issues + pipeline |
| Pipeline Mode | `/pipeline` | Execute work across multiple items step by step |
| Goal Mode | `/goal` | Auto-iterate on a single objective until done |
| Kanban Mode | `/kanban` | Track tasks with state machine + dependencies |
| Project Mode | `/project create` | Generate source code from architecture |
| Validate Mode | `/validate` | Run validation checks |
| Plan Mode | `/plan` | Queue edits for batch review |
| Snippet Mode | `/snippet` | Manage `#handle` token expansions |
| Curator Mode | `/curator review` | Detect stale skills and archive |

---

## 1. Domain Mode

**Purpose:** Turn fuzzy business context into structured domain knowledge — bounded contexts, entities, events, ubiquitous language.

**When to use:** At the start of every new project or feature area.

### Flow

```
/domain --explore "Payment processing system"
    │
    ▼
Agent reads prompt → analyzes business context
    │
    ▼
Produces: actors, functional requirements, bounded contexts, entities,
           domain events, assumptions, ubiquitous language
    │
    ▼
Saved to .pi/domain/exploration.md + .pi/domain/ubiquitous-language.md
```

### Commands

```bash
# Start exploration (in pi session)
/domain --explore "Payment processing system for e-commerce"

# Save structured analysis (agent uses this tool)
domain_save_result

# Validate against canonical glossary
/domain --validate <session-id>

# Generate architecture module docs from exploration
/domain --architect-scaffold <session-id>
```

### How It Works

1. You call `/domain --explore "description"`
2. A session is created in `.pi/domain/exploration/` with a UUID
3. A stub `exploration.md` is written with the context
4. The agent reads this file and fills in: actors, requirements, bounded contexts, entities, domain events, assumptions, glossary
5. The agent calls `domain_save_result` to persist
6. You validate with `/domain --validate <session-id>`
7. When the exploration is solid, you call `/domain --architect-scaffold <session-id>` to generate actual architecture module docs

### Output Files

| File | Content |
|------|---------|
| `.pi/domain/exploration.md` | Full domain analysis |
| `.pi/domain/ubiquitous-language.md` | Shared terminology glossary |
| `.pi/domain/exploration/<uuid>.md` | Session files (per exploration) |
| `.pi/architecture/modules/<name>.md` | Generated module docs (after scaffold) |

### Agent Tools

| Tool | Purpose |
|------|---------|
| `domain_explore` | Create exploration prompt file |
| `domain_save_result` | Save analysis as structured session |
| `domain_validate` | Validate against canonical glossary |

---

## 2. Epic-Plan Mode

**Purpose:** Plan work across modules — read architecture documents, identify what needs building, and slice into epics.

**When to use:** After domain exploration, when you have architecture module docs. Or when starting a major feature.

### How It Works

`/epic-plan` is **not a registered command** — it's an instruction the agent follows by reading the `epic-plan.md` prompt template. You type `/epic-plan --overview` and the agent loads the workflow definition.

### Modes

```
/epic-plan --overview
    Plan ALL modules (backend + frontend + infra):
    1. Discover all .pi/architecture/modules/*.md
    2. Load each module's components
    3. Map dependencies between modules
    4. Plan epics for each module
    5. Identify cross-cutting concerns

/epic-plan --module auth-service
    Plan ONE module:
    1. Load auth-service architecture doc
    2. Identify planned components
    3. Slice into implementation issues

/epic-plan "Add payment gateway"
    Free-form: plan a specific feature
```

### When to Use Which

| Mode | Example | Best For |
|------|---------|----------|
| `--overview` | First planning session | Greenfield projects, major releases |
| `--module` | Auth system needs work | Single module iteration |
| Free-form | "Add Stripe integration" | Well-understood small feature |

### Output

The agent produces:
- Epic definitions with scope and goals
- Per-module issue lists
- Dependencies between issues
- Priority ordering

You then take this output into the Architect to create tracked issues.

---

## 3. Architect Mode

**Purpose:** Turn an epic into tracked issues with a pipeline. The Architect reads architecture modules, creates issue markdown files, and starts a pipeline for execution.

**When to use:** After you have architecture module docs and know what epic to tackle.

### Flow

```
/architect --epic "Add payment processing"
    │
    ▼
Discovers architecture modules in .pi/architecture/modules/
    │
    ▼
Matches epic name to module OR picks module with planned components
    │
    ▼
Creates 4+ issues in .pi/issues/:
  ├── issue-contract-freeze.md     (Define interfaces)
  ├── issue-<component-1>.md       (Implementation slice 1)
  ├── issue-<component-2>.md       (Implementation slice 2)
  ├── issue-proofing.md            (Validation + CI)
  └── issue-architecture-readiness.md (Runbook, DR, docs)
    │
    ▼
Auto-creates pipeline state in .pi/.guardian-pipeline-state.json
  Steps: implement → validate → create-mr → merge
    │
    ▼
Agent starts working through the pipeline
```

### Commands

```bash
/architect --epic "Add payment processing"                # Start new epic
/architect --epic "Auth system" --tracking-issue 42       # Link to remote issue
/architect status                                          # Current epic state
/architect next-epic                                       # Find next logical slice
/architect abort                                           # Cancel epic
```

### What Each Issue Covers

| Issue | Content | Goal |
|-------|---------|------|
| Contract Freeze | Interfaces, types, API contracts | Lock down what needs building |
| Implementation N | Component from architecture | Build the actual code |
| Proofing | Validation scripts + CI | Tests and integration |
| Architecture Readiness | Runbook, docs, DR | Production readiness |

### Agent Tools

| Tool | Purpose |
|------|---------|
| `architect_status` | Show epic progress |
| `architect_discover` | Show all modules + recommended next slice |

### Remote Issue Tracking

If `gh` or `glab` is authenticated, the Architect auto-creates remote issues on GitHub/GitLab and links them as dependencies.

---

## 4. Pipeline Mode

**Purpose:** Execute work across multiple items through identical steps. Each item goes through the same state machine.

**When to use:** When you have multiple items that need the same process (e.g., close all P1 bugs, implement all issues in an epic).

### Flow

```
/pipeline "Sprint-47" --items "TK-0101,TK-0102" --steps "implement,validate,create-mr,merge"
    │
    ▼
State machine created:
  Item    │ implement │ validate │ create-mr │ merge
  ────────┼───────────┼──────────┼───────────┼──────
  TK-0101 │ ▶ ACTIVE  │ pending  │ pending   │ pending
  TK-0102 │ pending   │ pending  │ pending   │ pending
    │
    ▼
Agent calls pipeline_next_task → gets full issue context
    │
    ▼
Agent implements → calls pipeline_run_acceptance
    │
    ▼
If passes → calls pipeline_advance
If fails → calls pipeline_fail (with reason)
    │
    ▼
Continues to next step/item until all done
```

### Commands

```bash
# Start a pipeline
/pipeline "Sprint-47 cleanup" \
  --items "ISSUE-1,ISSUE-2,ISSUE-3" \
  --steps "implement,validate,create-mr,merge"

# With auto-merge when valid
/pipeline "Quick fixes" \
  --items "TK-0101,TK-0102" \
  --steps "implement,validate" \
  --merge-on-valid

# Manage pipeline
/pipeline status            # Current progress
/pipeline pause             # Pause execution
/pipeline resume            # Resume
/pipeline abort             # Cancel entirely
/pipeline skip-step         # Skip current step for current item
/pipeline retry-step        # Retry current step
```

### Step Acceptance Gates

Each step can have different validation requirements:

| Step | Prompt Used | Validator | Requires |
|------|-------------|-----------|----------|
| implement | `issue-implementation-series.md` | CI | Code compiles |
| validate | — | CI, tests, security | All checks pass |
| create-mr | `issue-closeout.md` | None | Description written |
| merge | `issue-merge.md` | CI, canonical | Branch mergable |

### Agent Tools

| Tool | What It Does | When Agent Calls It |
|------|-------------|-------------------|
| `pipeline_next_task` | Load full context for current item+step | At start of each item |
| `pipeline_run_acceptance` | Run validators for current step | After implementing |
| `pipeline_advance` | Mark step passed, move to next | When acceptance passes |
| `pipeline_fail` | Mark step failed, skip to next | When acceptance fails |
| `pipeline_status` | Show overall progress | Any time |

### Pipeline vs Goal

| Aspect | Pipeline | Goal |
|--------|----------|------|
| **Items** | Multiple (same process) | Single objective |
| **Steps** | Fixed sequence per item | Auto-iterate until complete |
| **Acceptance** | Per-step gates | One final condition |
| **Best for** | "Close all 15 P1 bugs" | "Fix auth module" |

---

## 5. Goal Mode

**Purpose:** Set a single objective and let the agent auto-iterate across turns until it's done.

**When to use:** When you have one clear task that requires multiple turns.

### Flow

```
/goal "Fix all TypeScript strict mode errors in src/"
    │
    ▼
Agent reads current state → identifies type errors
    │
    ▼
Turn 1: Fixes first batch → runs tsc
Turn 2: Fixes more → runs tsc
Turn N: All fixed → tsc passes
    │
    ▼
Dual validation:
  ✓ Validators pass (tsc, lint, tests)
  ✓ LLM judge confirms (semantic check)
    │
    ▼
Goal complete
```

### Commands

```bash
# Set a new goal
/goal "Fix all TypeScript strict mode errors in src/"

# With specific validators to check
/goal "Fix all TypeScript strict mode errors" --validators=ci,tests,security

# Manage goal
/goal status           # Show progress, remaining work
/goal pause            # Pause (agent stops)
/goal resume           # Resume (turn resets)
/goal clear            # Clear current goal

# Validator management
/goal validators       # List active validators
/goal validators all   # Enable all known validators
```

### Subgoals

Break a goal into smaller steps:

```bash
/subgoal "Fix strict null checks in src/auth"
/subgoal list          # Show all subgoals
/subgoal remove 1      # Remove subgoal by number
/subgoal clear         # Clear all subgoals
```

### Dual Validation

A goal passes when **both** checks pass:

1. **Automated validators** — `tsc` compiles, tests pass, lint clean (the ones you specify with `--validators=`)
2. **LLM semantic judge** — evaluates whether the objective is truly met, not just technically passing

### Goal Tool

| Tool | Purpose |
|------|---------|
| `guardian_goal_evaluate` | Agent calls this to check goal progress |

---

## 6. Kanban Mode

**Purpose:** Track tasks with a durable state machine — create, show, complete, block, comment.

**When to use:** For any task tracking that doesn't warrant a full epic. Also used internally by other features.

### Commands

```bash
/kanban status                     # Summary: triage: 3 | todo: 5 | done: 12
/kanban create "Add login page"    # Create task (auto-assigned ID: TK-0001)
/kanban list                       # All tasks
/kanban list triage                # Filter by status
```

### Agent Tools

| Tool | Purpose |
|------|---------|
| `kanban_create` | Create a task with title, body, priority |
| `kanban_list` | List tasks, optionally filtered by status |
| `kanban_show` | Show full task with comments |
| `kanban_complete` | Mark task as done |
| `kanban_block` | Block a task with a reason |
| `kanban_comment` | Add a comment to a task |

---

## 7. Project Scaffolding Mode

**Purpose:** Generate source code from architecture modules.

**When to use:** After you have architecture docs and want to generate the actual project source tree.

### Commands

```bash
# From CLI
guardian project create --lang java --buildTool maven --groupId com.mycompany

# From pi session
/project create --lang java --buildTool maven --groupId com.mycompany

# Dry run (preview)
/project create --lang typescript --validators ci,tests,security --dryRun

# Check status
/project status
```

### Options

| Flag | Description |
|------|-------------|
| `--lang` | Language (required): java, typescript |
| `--buildTool` | maven, gradle |
| `--groupId` | Package prefix |
| `--validators` | Comma-separated (default: ci, tests) |
| `--dryRun` | Preview without writing |
| `--force` | Override existing project |

### What It Creates

```
src/main/java/com/mycompany/
  Application.java
  config/
  controller/
  service/
  repository/
  model/
```

Architecture modules are mapped to package structure with canonical reference headers.

---

## 8. Validate Mode

**Purpose:** Run validation checks — from quick preflight to full multi-category validation.

**When to use:** Before pushing, during CI, or whenever you need to check conformance.

### CLI

```bash
guardian validate                    # All validators
guardian validate --filter tests     # Single category
guardian validate --verify           # Run inline tests only
guardian validate --verbose          # Detailed output
```

### Inside Pi

```bash
/validate                            # Run all validators
```

### Shell Scripts

```bash
# Quick local preflight
bash .pi/scripts/ci/run_preflight.sh

# Specific stage
bash .pi/scripts/ci/run_stage.sh architecture_conformance
bash .pi/scripts/ci/run_stage.sh security
bash .pi/scripts/ci/run_stage.sh release_readiness

# Validate agent output
bash .pi/scripts/ci/validate_agent_output.sh \
  --input=validator_output.md \
  --schema=architecture-validator

# Canonical reference check
bash .pi/scripts/validate-canonical.sh
```

### Available Scripts

| Script | What It Validates |
|--------|------------------|
| `validate-canonical.sh` | Architecture reference headers in code |
| `validate-architecture.sh` | Module boundary compliance |
| `validate-security.sh` | Security scanning |
| `validate-integration.sh` | Component wiring |
| `validate-operations.sh` | Logging, error handling |
| `validate-tests.sh` | Test coverage |
| `validate-ci.sh` | CI pipeline health |
| `validate-ubiquitous-language.sh` | Terminology consistency |

---

## 9. Other Modes

### Plan Mode

Queue edits for batch review, then apply all at once.

```bash
/plan                 # Enter plan mode
/plan-apply           # Apply all queued changes
```

Best for: Large refactors where you want to review changes before they land.

### Snippet Mode

Manage `#handle` tokens that expand into full text blocks (70–90% token savings).

```bash
/snippet list                       # Show all snippets
/snippet add my-handle <content>    # Register a snippet
/snippet remove my-handle           # Delete a snippet
/snippet edit my-handle <content>   # Update a snippet
```

Usage: Type `#my-handle` in a message, and the agent expands it to the full content.

### Curator Mode

Detect stale/unused skills and manage skill lifecycle.

```bash
/curator status                           # Show curator report
/curator review                           # Review and archive stale skills
/curator review --dry-run                 # Preview only
/curator pin "skill-name"                # Protect from archival
/curator unpin "skill-name"              # Allow archival
```

Best for: Monthly maintenance — keeps your skill directory clean.

### Other Slash Commands

| Command | Purpose |
|---------|---------|
| `/sessions` | Session history (list, switch, fork) |
| `/hooks` | List all registered lifecycle hooks |
| `/redact` | Manually trigger secret redaction |
| `/reload-config` | Hot-reload AGENTS.md config |
| `/read-only` | Enter safe exploration mode (no mutations) |

---

## 10. CLI Reference

### Commands

| Command | Description | Example |
|---------|-------------|---------|
| `guardian init` | Scaffold framework | `guardian init` |
| `guardian project create` | Generate source from architecture | `guardian project create --lang java --buildTool maven` |
| `guardian domain --explore` | DDD exploration | `guardian domain --explore "Payment system"` |
| `guardian domain --save-result` | Save exploration result | `guardian domain --save-result <id> <json>` |
| `guardian generate` | Regenerate exports from `.pi/` | `guardian generate --tool claude` |
| `guardian update` | Smart merge template updates | `guardian update --dryRun` |
| `guardian upgrade` | Major version migration | `guardian upgrade` |
| `guardian validate` | Run validators | `guardian validate --filter tests` |
| `guardian verify` | File integrity check | `guardian verify` |
| `guardian trust` | Manage trusted configs | `guardian trust` |
| `guardian info` | Show manifest | `guardian info` |
| `guardian stats` | Token analytics | `guardian stats --days 7` |
| `guardian uninstall` | Remove Guardian | `guardian uninstall --dryRun` |

### Common Flags

| Flag | Applies To | Description |
|------|-----------|-------------|
| `-d, --dir <path>` | All | Target directory |
| `-v, --version` | All | Show version |
| `-h, --help` | All | Show help |
| `--dryRun` | project, generate, update, uninstall | Preview without changes |
| `--force` | init, project, update, generate, uninstall | Skip confirmations |
| `--nonInteractive` | init | Skip interactive prompts |

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Config error (missing manifest, invalid YAML) |
| 3 | Template error (missing template) |
| 4 | Validation error (checks failed) |
| 5 | Hook error (before_run/after_create failed) |

---

## 11. Complete Example Workflow

Here's how a real project flows through all modes:

```bash
# ── DISCOVERY ──
guardian domain --explore "Multi-tenant SaaS platform"
# Agent produces bounded contexts: Auth, Billing, Workspace, Analytics

# ── ARCHITECTURE ──
/domain --architect-scaffold <session-id>
# Creates: auth-system.md, billing-system.md, workspace-management.md in architecture/modules/

/manually create ADRs: ADR-001 (multi-tenancy strategy), ADR-002 (auth approach)

# ── EPIC PLAN ──
/epic-plan --overview
# Agent reads all modules, plans epics across them

# ── ARCHITECT ──
/architect --epic "Multi-tenant auth system"
# Creates issues: contract-freeze → auth implementation → proofing → readiness
# Creates pipeline: implement → validate → create-mr → merge

# ── PIPELINE EXECUTION ──
# Agent works through each issue automatically:
#   1. pipeline_next_task → reads issue contract-freeze.md
#   2. Implements interfaces
#   3. pipeline_run_acceptance → validates
#   4. pipeline_advance → moves to next step
#   ... continues through all issues

# ── KANBAN (for ad-hoc work) ──
/kanban create "Document API endpoints"
/kanban create "Review auth PR"
/kanban complete TK-0001

# ── VALIDATION ──
guardian validate --filter security
bash .pi/scripts/ci/run_preflight.sh

# ── UPDATE ──
guardian update --dryRun   # When new Guardian version drops
guardian update            # Apply
```
