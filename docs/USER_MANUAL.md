# Guardian — Complete User Manual

All workflows, commands, tools, and scripts — verified against source code.

> **How to read this manual:** Each workflow is a complete flow the agent follows. You trigger workflows by telling the agent the workflow name or calling the relevant slash command. The agent reads the corresponding prompt file (in `.pi/prompts/`) and executes the steps.

---

## Table of Contents

1. [Workflow Overview](#1-workflow-overview)
2. [Feature Development](#2-feature-development)
3. [Bug Fix](#3-bug-fix)
4. [Hotfix (Production Emergency)](#4-hotfix-production-emergency)
5. [Refactoring](#5-refactoring)
6. [Epic Plan](#6-epic-plan)
7. [Architect](#7-architect)
8. [Issue Draft & Create](#8-issue-draft--create)
9. [Issue Implementation Series](#9-issue-implementation-series)
10. [Issue Closeout & Merge](#10-issue-closeout--merge)
11. [Pipeline](#11-pipeline)
12. [Goal Loop](#12-goal-loop)
13. [Domain Exploration](#13-domain-exploration)
14. [Blueprint Validate & Update](#14-blueprint-validate--update)
15. [Context Refresh](#15-context-refresh)
16. [Sync Check](#16-sync-check)
17. [Pattern Extract](#17-pattern-extract)
18. [Scope Analyzer](#18-scope-analyzer)
19. [Plan to Issues](#19-plan-to-issues)
20. [Kanban](#20-kanban)
21. [Project Scaffolding](#21-project-scaffolding)
22. [Curator](#22-curator)
23. [Snippets](#23-snippets)
24. [Plan Mode](#24-plan-mode)
25. [Validate](#25-validate)
26. [CI Scripts](#26-ci-scripts)
27. [Git Scripts](#27-git-scripts)
28. [CLI Commands Reference](#28-cli-commands-reference)

---

## 1. Workflow Overview

Every workflow in Guardian is defined in `.pi/prompts/<name>.md`. The agent reads the prompt and executes the flow. You trigger a workflow by:

1. **Telling the agent** what you want — e.g., "we have a bug in auth" → agent loads `bug-fix.md`
2. **Calling a slash command** that triggers a workflow — e.g., `/architect --epic "Auth"` → agent loads `epic-template.md` and creates issues
3. **Running a pipeline** that references a prompt — e.g., pipeline `implement` step uses `issue-implementation-series.md`

### Scope-Based Validator Selection

The coordinator classifies every change and selects validators automatically. Classification logic is in `classifyScope()` at `coordinator.ts:70-75`; the validator map is at `coordinator.ts:230-243`.

| Scope | Files | Lines | Validators Triggered |
|-------|-------|-------|---------------------|
| **Simple** | 1-2 | <= 50 | CI, canonical |
| **Moderate** | 3-5 | 51-200 | CI, architecture, canonical |
| **Complex** | 6-15 | 201-500 | CI, architecture, security, tests, integration, canonical |
| **Critical** | 16+ | 501+ | CI, architecture, security, operations, tests, integration, canonical |

---

## 2. Feature Development

**Prompt:** `.pi/prompts/feature-development.md`
**Scope:** Moderate, Complex, Critical
**Agent:** `code-developer`

### Flow

```
User Request
    │
    ▼
1. COORDINATOR: Classify scope
   Load: context/project.md
   Output: scope + validators
    │
    ▼
2. ISSUE-CREATOR: Create GitHub/GitLab issue
   Output: GitHub issue #N
    │
    ▼
3. PLAN VALIDATORS (Parallel):
   • architecture-validator (Moderate+)
   • security-validator (Complex+)
   Load: context/checklists.md (plan section)
   Output: Validation Contract (signed)
    │
    ▼
4. COORDINATOR: Synthesize plan
   Output: Design Proposal
   → User approval if Critical
    │
    ▼
5. CODE-DEVELOPER: Implement
   Input: Design Proposal + Contract
   Load: context/patterns.md
   Add: Canonical Reference Headers
   Output: Code + tests
    │
    ▼
6. POST-CODE: Automated Checks (NO LLM)
   • bash .pi/scripts/validate-ci.sh
   • bash .pi/scripts/validate-tests.sh
   • bash .pi/scripts/validate-operations.sh
   • bash .pi/scripts/validate-security.sh
   • bash .pi/scripts/validate-canonical.sh
   Output: Pass/Fail per check
    │
    ▼
7. LLM VALIDATORS: Wiring Checks ONLY
   • architecture-validator: callers, duplicates
   • security-validator: manual review if flagged
   Output: Final verdict
    │
    ▼
8. CI-MR: Create PR + merge
   Output: Merged PR
```

### How to Use

```
User: "Add user profile page with avatar upload"
Agent: Loads feature-development.md → classifies scope → creates issue → validates plan → implements → validates → merges
```

### Commands

```bash
# Run automated validators
bash .pi/scripts/validate-ci.sh
bash .pi/scripts/validate-tests.sh
bash .pi/scripts/validate-operations.sh [src_dir]
bash .pi/scripts/validate-security.sh [src_dir]
bash .pi/scripts/validate-canonical.sh

# Validation cache
bash .pi/scripts/validation-cache.sh init <task-id>
bash .pi/scripts/validation-cache.sh summary <task-id>
```

---

## 3. Bug Fix

**Prompt:** `.pi/prompts/bug-fix.md`
**Scope:** Simple, Moderate
**Agent:** `code-developer`

### Flow

```
Bug Report
    │
    ▼
1. COORDINATOR: Classify scope
   Most bugs = Simple/Moderate
    │
    ▼
2. CODE-DEVELOPER: Fix bug
   Load: context/patterns.md
   Output: Fixed code + test
    │
    ▼
3. AUTOMATED: Run validators
   • bash .pi/scripts/validate-ci.sh
   • bash .pi/scripts/validate-tests.sh
    │
    ▼
4. CI-MR: Create PR + merge
   Simple scope = ci-mr only
```

### How to Use

```
User: "There's a bug in src/auth/login.ts — null pointer when token is missing"
Agent: Loads bug-fix.md → fixes → validates → merges
```

### Rules

- **Simple bugs** (1-2 files, <= 50 lines): Fix → automated checks → merge. No LLM validators.
- **Moderate bugs** (3-5 files, 51-200 lines): Fix → automated checks → architecture-validator wiring check → merge.
- **Complex bugs** (root cause in architecture): Escalate to Feature Development workflow.

---

## 4. Hotfix (Production Emergency)

**Prompt:** `.pi/prompts/hotfix.md`
**Scope:** Critical (production issue)
**Agent:** `code-developer`

### Flow

```
Production Issue Detected
    │
    ▼
1. COORDINATOR: Assess severity
   → If critical: hotfix path
    │
    ▼
2. CODE-DEVELOPER: Fix ASAP
   Minimal change, no refactor
   Load: context/patterns.md
    │
    ▼
3. ALL AUTOMATED VALIDATORS
   • bash .pi/scripts/validate-ci.sh
   • bash .pi/scripts/validate-tests.sh
   • bash .pi/scripts/validate-operations.sh
   • bash .pi/scripts/validate-security.sh
    │
    ▼
4. SECURITY-VALIDATOR: Review
   Hotfixes can introduce vulns
   Manual review REQUIRED
    │
    ▼
5. CI-MR: Fast-track merge
   Skip normal review queue
   Human approval still needed
    │
    ▼
6. POST-MERGE: Full validation
   Run complete validation suite
   Create follow-up issue if
   hotfix introduced tech debt
```

### How to Use

```
User: "CRITICAL: payments API returning 500 for all requests, need immediate fix"
Agent: Loads hotfix.md → bypasses planning → fixes → validates → fast-track merge
```

### Rules

- **NO planning phase** — fix first, validate after
- **Minimal change** — fix the bug, do NOT refactor
- **Security review mandatory**
- **Post-merge cleanup** — create follow-up issue for tech debt

---

## 5. Refactoring

**Prompt:** `.pi/prompts/refactoring.md`
**Scope:** Moderate, Complex
**Agent:** `code-developer`

### Flow

```
Refactor Request
    │
    ▼
1. COORDINATOR: Classify scope
   Determine affected modules
    │
    ▼
2. CODE-DEVELOPER: Baseline
   Run all tests, record output
   Run all validators, cache
   bash .pi/scripts/validation-cache.sh init <task-id>
    │
    ▼
3. ARCHITECTURE-VALIDATOR: Plan
   Review refactor approach
   Ensure patterns preserved
    │
    ▼
4. CODE-DEVELOPER: Refactor
   Small commits, one change at a time
   Run tests after each change
    │
    ▼
5. POST-REFACTOR:
   Run all tests → compare with baseline
   Run all validators → compare with baseline
   Output must match EXACTLY (except performance)
```

### How to Use

```
User: "Refactor src/auth/ from Express to Fastify — keep all behavior identical"
Agent: Loads refactoring.md → baselines tests → validates plan → refactors one file at a time → compares output
```

---

## 6. Epic Plan

**Prompt:** `.pi/prompts/epic-plan.md`
**What it is:** A prompt template the agent reads to plan work across modules. Not a registered command — you tell the agent to plan an epic and it follows this workflow.

### Modes

| Mode | Trigger | What It Does |
|------|---------|-------------|
| **Overview** | `"Plan epics across all modules"` | Discover all architecture modules → map dependencies → plan epics |
| **Module Slice** | `"Plan next slice for auth module"` | Load one module → find planned components → slice into issues |
| **Free-Form** | `"Plan Stripe integration"` | Plan a specific feature from description |

### Overview Flow

```
1. Find all .pi/architecture/modules/*.md
2. For each module:
   a. Load architecture doc
   b. Read component list and statuses
   c. Identify planned components
3. Map dependencies between modules
4. Plan epics:
   - Group related components into epics
   - Order by dependency chain
   - Estimate effort per epic
5. Output: epic definitions with component lists
```

### How to Use

```
User: "Plan epics for all modules"
Agent: Loads epic-plan.md → discovers modules → plans epics → presents results

User: "Plan the next slice for auth module"
Agent: Loads epic-plan.md → reads auth-system.md → finds planned components → slices into issues
```

---

## 7. Architect

**Extension:** `.pi/extensions/architect.ts`
**Slash command:** `/architect`
**Agent tools:** `architect_status`, `architect_discover`

### Commands

| Command | Description |
|---------|-------------|
| `/architect --epic "Epic Name"` | Start a new epic — creates issues + pipeline |
| `/architect --epic "Name" --tracking-issue 42` | Link to existing remote issue |
| `/architect status` | Show current epic state |
| `/architect next-epic` | Find the next logical slice to implement |
| `/architect abort` | Cancel current epic |

### How It Works

When you start an epic (`/architect --epic "Auth Module v1"`):

1. Scans `.pi/architecture/modules/*.md` for components with `status: planned`
2. Matches epic name to a module, or picks the first module with planned components
3. Creates 4+ issues in `.pi/issues/`:
   - `issue-contract-freeze.md` — Define interfaces, types, API contracts
   - `issue-<component1>.md` — Implementation slice 1
   - `issue-<component2>.md` — Implementation slice 2
   - `issue-proofing.md` — Validation scripts, CI integration
   - `issue-architecture-readiness.md` — Runbook, DR plan, docs
4. If `gh`/`glab` authenticated: creates remote issues with labels (`epic,implementation`)
5. Auto-creates a pipeline: `implement → validate → create-mr → merge`
6. Starts the agent on the first issue

### Architecture Module Format

Your module files in `.pi/architecture/modules/*.md` must have this format:

```markdown
# Auth System

## JWT Token Validation
status: planned
description: Validates JWT tokens, checks expiry, signature, claims.
depends: none

## OAuth2 Provider Integration
status: planned
description: Google, GitHub OAuth2 for SSO.
depends: JWT Token Validation

## Session Management
status: implemented
description: Redis-backed session storage.
depends: JWT Token Validation
```

### Status Values

| Status | Meaning |
|--------|---------|
| `planned` | Not yet implemented — will appear in next epic |
| `in-progress` | Currently being worked on |
| `implemented` | Done, verified |
| `deprecated` | Being phased out |

---

## 8. Issue Draft & Create

**Prompt:** `.pi/prompts/issue-draft.md`
**Agent:** `issue-creator`

### Flow

```
Approved Epic (from /epic-plan or /architect)
    │
    ▼
ISSUE-CREATOR agent:
1. Reads approved epic proposal
2. Creates draft issue files in .pi/issues/
3. Each draft has: title, description, acceptance criteria,
   architecture references, labels
4. User reviews drafts
5. On approval: publishes to GitHub/GitLab
```

### How to Use

```
User: "Create issues from the epic plan"
Agent: Loads issue-draft.md → creates draft issues → presents for review
User: "Publish issue TK-0001 to GitHub"
Agent: Creates GitHub issue with all details
```

### Related Prompts

| Prompt | Purpose |
|--------|---------|
| `issue-draft.md` | Create draft issues from epic |
| `issue-template.md` | Issue format template |
| `issue-template-set.md` | Full template set for all issue types |
| `git-issues.md` | Create epics and issues in GitHub/GitLab |

---

## 9. Issue Implementation Series

**Prompt:** `.pi/prompts/issue-implementation-series.md`
**Used by:** Pipeline `implement` step, Architect auto-pipeline

### Flow

```
Phase 1: Fetch Issues
   bash .pi/scripts/fetch-issues.sh
   or gh issue list --state open

Phase 2: Categorize Issues
   Group by component, priority, dependency
   Create batch groups for feature branches
   ┌─────────────────────┬──────────────────────┬──────────────────────────┐
   │ Component batch     │ Same module (2-5)    │ feature/{component}-{N}  │
   │ Priority batch      │ All Critical/High    │ priority/critical-{date} │
   │ Related batch       │ Dependencies linked  │ feature/{feature}-issues │
   └─────────────────────┴──────────────────────┴──────────────────────────┘

Phase 3: Implement Each Group
   For each batch:
     → Create feature branch
     → Implement issues in order
     → Run validators per issue
     → Create MR per group
     → Link issues to MR
```

### How to Use

This is the default workflow for the pipeline's `implement` step. When a pipeline advances to `implement`, the agent loads this prompt and implements the current issue.

---

## 10. Issue Closeout & Merge

### Issue Closeout

**Prompt:** `.pi/prompts/issue-closeout.md`

```
Verify acceptance criteria → run all validators → check canonical references → create compliance MR
```

Commands after closeout:

```bash
bash .pi/scripts/validate-ci.sh
bash .pi/scripts/validate-tests.sh
bash .pi/scripts/validate-canonical.sh
bash .pi/scripts/validate-integration.sh
```

### Issue Merge

**Prompt:** `.pi/prompts/issue-merge.md`

```
CI passed ✓ → MR approved ✓ → Merge → Close issue → Update tracking → Close epic (if last)
```

### How to Use

These are pipeline steps. When the pipeline reaches `create-mr`, agent loads `issue-closeout.md`. When it reaches `merge`, agent loads `issue-merge.md`.

---

## 11. Pipeline

**Extension:** `.pi/extensions/pipeline.ts`
**Slash command:** `/pipeline`
**Agent tools:** `pipeline_status`, `pipeline_advance`, `pipeline_fail`, `pipeline_start`, `pipeline_next_task`, `pipeline_run_acceptance`

### Commands

```bash
# Start a pipeline
/pipeline "Sprint-47" --items "TK-0101,TK-0102" --steps "implement,validate,create-mr,merge"

# With auto-merge on valid
/pipeline "Sprint-47" --items "TK-0101,TK-0102" --steps "implement,validate" --merge-on-valid

# Manage
/pipeline status               # Show current state
/pipeline pause                # Pause execution
/pipeline resume               # Resume
/pipeline abort                # Cancel
/pipeline skip-step            # Skip current step
/pipeline retry-step           # Retry current step
```

### How the Agent Uses It

```
Current: Item TK-0101 → Step: implement
    │
    ▼
Agent calls pipeline_next_task
    → Gets issue TK-0101 context
    → Loads issue-implementation-series.md
    → Implements the issue
    │
    ▼
Agent calls pipeline_run_acceptance
    → Runs validators (CI, tests, security)
    → If PASS: pipeline_advance
    → If FAIL: pipeline_fail("reason")
    │
    ▼
Continues to next step/item
```

### Default Steps

| Step | Prompt | Validator |
|------|--------|-----------|
| implement | `issue-implementation-series.md` | CI |
| validate | — | CI, tests, security |
| create-mr | `issue-closeout.md` | None |
| merge | `issue-merge.md` | CI, canonical |

---

## 12. Goal Loop

**Extension:** `.pi/extensions/goal-loop.ts`
**Slash commands:** `/goal`, `/subgoal`
**Agent tool:** `guardian_goal_evaluate`

### Commands

```bash
# Set and manage goals
/goal "Fix all TypeScript strict mode errors"          # Set goal
/goal "Fix all TypeScript strict mode errors" --validators=ci,tests,security  # With validators
/goal status                                            # Show progress
/goal pause                                             # Pause
/goal resume                                            # Resume (turn resets)
/goal clear                                             # Clear
/goal validators                                        # List active validators
/goal validators all                                    # Enable all validators

# Subgoals
/subgoal "Fix strict null checks in src/auth"          # Add sub-criteria
/subgoal list                                           # List subgoals
/subgoal remove 1                                       # Remove by number
/subgoal clear                                          # Clear all subgoals
```

### Dual Validation

A goal passes when **both** checks pass:
1. **Validators** — automated: `tsc`, tests, lint (the ones you specify with `--validators=`)
2. **LLM semantic judge** — `guardian_goal_evaluate` tool checks if objective is truly met

### How It Works Per Turn

```
Turn 1: Agent reads files → identifies errors → fixes some → runs tsc → fails
Turn 2: Fixes more → runs tsc → passes → runs tests → fails
Turn 3: Fixes tests → all pass → guardian_goal_evaluate confirms → Done ✓
```

---

## 13. Domain Exploration

**Extension:** `.pi/extensions/domain-explorer.ts`
**Slash command:** `/domain`
**Agent tools:** `domain_explore`, `domain_save_result`, `domain_validate`

### Commands

```bash
# Start exploration (inside pi)
/domain --explore "Payment processing system for e-commerce"

# Validate against domain files
/domain --validate <session-id>

# Generate architecture modules from exploration
/domain --architect-scaffold <session-id>
```

### CLI Version

```bash
guardian domain --explore "Payment processing system"
guardian domain --save-result <session-id> <json>
```

### What It Produces

When you call `/domain --explore "description"`:
1. Session created in `.pi/domain/exploration/<uuid>.md`
2. Agent fills in:
   - Actors & Roles
   - Functional Requirements
   - Non-Functional Requirements
   - Assumptions
   - Bounded Contexts
   - Entities & Value Objects
   - Domain Events
   - Aggregates
   - Ubiquitous Language
3. Saved to `.pi/domain/exploration.md` + `.pi/domain/ubiquitous-language.md`

### Full Domain Workflow

From `.pi/context/domain-workflow.md`:

```
/domain --explore "description"
    → Agent fills domain analysis
    → You validate with /domain --validate <session-id>
    → If good: /domain --architect-scaffold <session-id>
        → Generates architecture module docs from domain entities
    → Then: /epic-plan --overview or /architect --epic "Name"
    → Then: implement through pipeline
```

---

## 14. Blueprint Validate & Update

### Blueprint Validate

**Prompt:** `.pi/prompts/blueprint-validate.md`

Validates that the `.pi/` blueprint is complete and properly structured before starting implementation.

**When to use:** Before starting any implementation work.

```
Checks:
1. Architecture modules exist with proper format
2. ADRs have status and context fields
3. Script files are present and executable
4. Extension files are well-formed
5. No broken canonical references

Output: Pass/Fail with specific issues
```

### Blueprint Update

**Prompt:** `.pi/prompts/blueprint-update.md`

Reverse-sync implementation changes back to the blueprint. When code evolves, the `.pi/` docs need to reflect reality.

**When to use:** After implementation, when architecture has drifted.

```
1. Compare implemented code with blueprint
2. Identify drift: new patterns, changed interfaces, removed components
3. Update architecture module docs
4. Update ADRs if decisions changed
5. Update context files
6. Mark implemented components as status: implemented
```

---

## 15. Context Refresh

**Prompt:** `.pi/prompts/context-refresh.md`

Analyze the current codebase and update `.pi/context/` files to reflect actual patterns, commands, and facts.

**When to use:** When the project has evolved and context files are stale.

```
1. Scan source code for:
   - Build commands (package.json, pom.xml, Cargo.toml)
   - Test commands
   - Lint/format commands
   - Directory structure
   - Import patterns
2. Compare with current .pi/context/project.md
3. Update out-of-date sections
4. Add new patterns to .pi/context/patterns.md
```

---

## 16. Sync Check

**Prompt:** `.pi/prompts/sync-check.md`

Verify that generated exports (`.claude/`, `.opencode/`, `.agents/`) are in sync with the `.pi/` blueprint.

**When to use:** When exports seem stale, or before CI.

```
1. Run guardian generate --dryRun
2. Compare hashes of .pi/ source vs export files
3. Report out-of-sync files
4. Suggest: "Run guardian generate to sync"
```

---

## 17. Pattern Extract

**Prompt:** `.pi/prompts/pattern-extract.md`

Extract code patterns from implementation and add to `.pi/context/patterns.md`.

**When to use:** When you notice reusable patterns in implementation.

```
1. Read implementation code
2. Identify patterns (error handling, logging, middleware, etc.)
3. Create generalized pattern description
4. Add to .pi/context/patterns.md
5. Include example code snippets
```

---

## 18. Scope Analyzer

**Prompt:** `.pi/prompts/scope-analyzer.md`

Automatically determine scope classification from proposed changes.

**When to use:** Built into coordinator — the agent runs this automatically before any work.

```
Input: git diff, branch, or description
Output: scope (simple/moderate/complex/critical) + recommended validators

Algorithm (from `classifyScope()` in coordinator.ts):

```
if (fileCount > 15 || lineChanges > 500) return "critical";
if (fileCount > 5 || lineChanges > 200) return "complex";
if (fileCount > 2 || lineChanges > 50) return "moderate";
return "simple";
```

Validator selection (from `validatorMap` in coordinator.ts):

| Scope | Validators |
|-------|-----------|
| simple | ci, canonical |
| moderate | ci, architecture, canonical |
| complex | ci, architecture, security, tests, integration, canonical |
| critical | ci, architecture, security, operations, tests, integration, canonical |
```

---

## 19. Plan to Issues

**Prompt:** `.pi/prompts/plan-to-issues.md`

Convert a superpowers plan file into GitHub/GitLab issues with epics and tracking.

**When to use:** When you have a plan document (e.g., from a product manager) and need to create issues.

```
Input: docs/superpowers/plans/*.md
Format:
  # Plan Title
  ## Milestone 1 (priority)
  ### Task 1
  - [ ] Step 1: description
  - [ ] Step 2: description

Output: GitHub/GitLab issues with:
  - Epics per milestone
  - Issues per task
  - Labels for priority
  - Dependencies between issues
```

---

## 20. Kanban

**Extension:** `.pi/extensions/kanban.ts`
**Slash command:** `/kanban`
**Agent tools:** `kanban_create`, `kanban_list`, `kanban_show`, `kanban_complete`, `kanban_block`, `kanban_comment`

### Commands

```bash
/kanban status                       # Summary: triage: 3 | todo: 5 | done: 12
/kanban create "Add login page"      # Create task (gets ID: TK-0001)
/kanban list                         # All tasks
/kanban list triage                  # Filter by status
```

### Agent Tools

| Tool | Parameters | Purpose |
|------|-----------|---------|
| `kanban_create` | title, body, assignee, priority | Create task |
| `kanban_list` | status (optional) | List tasks |
| `kanban_show` | id | Full task with comments |
| `kanban_complete` | id | Mark done |
| `kanban_block` | id, reason | Block a task |
| `kanban_comment` | id, text | Add comment |

### Statuses

triage → todo → ready → running → blocked → done → archived

---

## 21. Project Scaffolding

**Extension:** `.pi/extensions/project-scaffolder.ts`
**Slash command:** `/project`
**CLI:** `guardian project create`

### Commands

```bash
# From CLI
guardian project create --lang java --buildTool maven --groupId com.mycompany

# From pi session
/project create --lang java --buildTool maven --groupId com.mycompany

# Preview
/project create --lang typescript --validators ci,tests,security --dryRun

# Check status
/project status
```

### Options

| Flag | Description |
|------|-------------|
| `--lang` | java, typescript (required) |
| `--buildTool` | maven, gradle |
| `--groupId` | Package prefix (default: com.example) |
| `--validators` | Comma-separated (default: ci,tests) |
| `--dryRun` | Preview without writing |
| `--force` | Override existing project |

---

## 22. Curator

**Extension:** `.pi/extensions/curator.ts`
**Slash command:** `/curator`
**Agent tools:** `curator_review`, `curator_pin`, `curator_unpin`

### Commands

```bash
/curator status                # Show curator report
/curator review                # Detect + archive stale skills
/curator review --dry-run      # Preview only
/curator pin "skill-name"      # Protect from archival
/curator unpin "skill-name"    # Allow archival
```

### How It Works

Tracks skill usage (reads, tool calls, patches). Skills unused for 30 days flagged as stale. Skills unused for 90 days archived.

---

## 23. Snippets

**Extension:** `.pi/extensions/snippets.ts`
**Slash command:** `/snippet`

### Commands

```bash
/snippet list                    # Show all snippets
/snippet add my-handle <content> # Register a snippet
/snippet remove my-handle        # Delete
/snippet edit my-handle <content> # Update
```

### Usage

Register a snippet, then type `#my-handle` in any message. The agent expands it to the full content. Token savings: 70–90%.

---

## 24. Plan Mode

**Extension:** `.pi/extensions/plan-mode.ts`
**Slash commands:** `/plan`, `/plan-apply`

### Commands

```bash
/plan              # Enter plan mode — queue changes for review
/plan-apply        # Apply all queued changes
```

### How It Works

In plan mode, the agent proposes edits without applying them. You review the plan, then call `/plan-apply` to execute all changes at once. Best for: large refactors where you want to review before mutation.

---

## 25. Validate

**Extension:** `.pi/extensions/validation-runner.ts`
**Slash command:** `/validate`
**CLI:** `guardian validate`

### Commands

```bash
# CLI
guardian validate                    # All validators
guardian validate --filter tests     # Single category
guardian validate --verify           # Inline tests only
guardian validate --verbose          # Detailed output

# Inside pi
/validate                            # Run all validators
```

### Validator Categories

| Validator | Purpose |
|-----------|---------|
| ci | CI pipeline configuration, script health |
| tests | Test structure, coverage flags |
| operations | Observability, logging, error handling |
| security | Injection, auth bypass, secret leakage |
| integration | Component wiring, interface contracts |
| architecture | Module boundaries, dependency direction |
| canonical | Architecture reference headers in code |

### Shell Scripts (by category)

```bash
bash .pi/scripts/validate-ci.sh
bash .pi/scripts/validate-tests.sh
bash .pi/scripts/validate-operations.sh [src_dir]
bash .pi/scripts/validate-security.sh [src_dir]
bash .pi/scripts/validate-integration.sh
bash .pi/scripts/validate-architecture.sh
bash .pi/scripts/validate-canonical.sh
bash .pi/scripts/validate-architecture-readiness.sh
bash .pi/scripts/validate-ubiquitous-language.sh
```

---

## 26. CI Scripts

Located in `.pi/scripts/ci/` — run individual CI stages locally.

### Commands

```bash
bash .pi/scripts/ci/run_preflight.sh                    # Quick local preflight

bash .pi/scripts/ci/run_stage.sh docs_policy            # Individual stage
bash .pi/scripts/ci/run_stage.sh architecture_conformance
bash .pi/scripts/ci/run_stage.sh lint
bash .pi/scripts/ci/run_stage.sh build
bash .pi/scripts/ci/run_stage.sh unit
bash .pi/scripts/ci/run_stage.sh test
bash .pi/scripts/ci/run_stage.sh integration
bash .pi/scripts/ci/run_stage.sh security
bash .pi/scripts/ci/run_stage.sh static_analysis
bash .pi/scripts/ci/run_stage.sh package_build
bash .pi/scripts/ci/run_stage.sh release_readiness
bash .pi/scripts/ci/run_stage.sh migration_verify
bash .pi/scripts/ci/run_stage.sh remaining

bash .pi/scripts/ci/run_hardening_stages.sh             # Run all hardening stages

bash .pi/scripts/ci/validate_agent_output.sh \           # Validate agent output
  --input=validator_output.md \
  --schema=architecture-validator
```

---

## 27. Git Scripts

Located in `.pi/scripts/git/` and `.pi/scripts/`.

### Branch & MR

```bash
bash .pi/scripts/create-feature-branch.sh <branch-name>
bash .pi/scripts/create-mr.sh [issue-number] [title]
bash .pi/scripts/merge-mr.sh [mr-id]
bash .pi/scripts/mr-validation.sh                        # Validate MR before merge
```

### Issue/Epic Management

```bash
bash .pi/scripts/git/create-tracking-issue.sh <epic-name>
bash .pi/scripts/git/link-issue-to-epic.sh <issue-id> <epic-id>
bash .pi/scripts/git/close-issue.sh <issue-id>
bash .pi/scripts/git/update-tracking-issue.sh <issue-id>
bash .pi/scripts/git/close-epic.sh <epic-id>
```

### Fetch & Categorize

```bash
bash .pi/scripts/fetch-issues.sh                          # Fetch open issues
bash .pi/scripts/categorize-issues.sh                     # Categorize by component
```

---

## 28. CLI Commands Reference

### Commands

| Command | Description | Example |
|---------|-------------|---------|
| `guardian init` | Scaffold framework interactively | `guardian init` |
| `guardian project create` | Generate source from architecture | `guardian project create --lang java --buildTool maven` |
| `guardian domain --explore` | DDD exploration | `guardian domain --explore "Payment system"` |
| `guardian domain --save-result` | Save exploration JSON | `guardian domain --save-result <id> <json>` |
| `guardian generate` | Regenerate exports from `.pi/` | `guardian generate --tool claude` |
| `guardian update` | Smart merge template updates | `guardian update --dryRun` |
| `guardian upgrade` | Major version migration | `guardian upgrade` |
| `guardian validate` | Run validators | `guardian validate --filter tests` |
| `guardian verify` | File integrity check | `guardian verify` |
| `guardian trust` | Manage trusted TOML configs | `guardian trust` |
| `guardian info` | Show manifest | `guardian info` |
| `guardian stats` | Token analytics | `guardian stats --days 7` |
| `guardian uninstall` | Remove Guardian-managed files | `guardian uninstall --dryRun` |

### init — Detailed Flow

**Usage:**
```bash
guardian init [options]
```

**Interactive prompt sequence (from `src/lib/prompts.ts`):**

1. Check for existing framework → ask: overwrite, merge, or cancel
2. Project name (text, validated: no spaces, required)
3. Project version (text, default: `0.1.0`)
4. Repository `owner/repo` (text, e.g., `my-org/my-project`)
5. Git tool (select: GitHub CLI `gh` or GitLab CLI `glab`)
6. AI tools (multi-select, `pi` pre-selected):
   - `pi` — Full features: extensions, skills, prompts
   - `claude` — Claude Code (static export)
   - `github` — GitHub Copilot CLI
   - `omp` — oh-my-pi
   - `opencode` — OpenCode (static export)
   - `agents` — Antigravity (static export)
7. Language (select: typescript, rust, python, go, java)
8. Build tool (select, only for Java: maven or gradle)
9. Architecture mode (select: strict hexagonal or simplified)
10. Group/package prefix (text, default: `com.<projectName>`)
11. Business domain description (text, optional — seeds domain exploration)
12. Confirmation summary

All validators and workflows are scaffolded by default — no selection needed.

**Non-interactive mode flags:**

| Flag | Default | Notes |
|------|---------|-------|
| `-l, --lang` | Required | Language: typescript, rust, python, go, java |
| `-t, --tool` | pi | AI tools: pi, claude, github, omp, opencode, agents |
| `--buildTool` | (auto) | Build tool for Java: maven, gradle |
| `--groupId` | com.<name> | Package prefix |
| `--validators` | (all) | Comma-separated (all scaffolded by default) |
| `--workflows` | (all) | Comma-separated (all scaffolded by default) |
| `--nonInteractive` | false | Skip all prompts (requires `--lang`) |

**Scaffold process:**

1. Copy `templates/pi/` to `.pi/` in target directory
2. Render templates with project context (name, version, language, etc.)
3. Apply language selection — copy patterns file for chosen language
4. Apply validator selection — filter scripts to only included validators
5. Apply workflow selection — filter prompts to only included workflows
6. Write `guardian-manifest.json` with file checksums and config
7. Generate exports for selected tools

### generate — Detailed Flow

**Usage:**
```bash
guardian generate [options]
```

| Flag | Description |
|------|-------------|
| `--tool <name>` | Single tool (claude, opencode, agents, github) or `all` |
| `--dryRun` | Show what would change without writing |
| `--force` | Overwrite existing export files |

**Step-by-step flow:**

```
1. Validate prerequisites (.pi/ exists, manifest exists)

2. If --dryRun:
   a. Calculate all export mappings
   b. Show file-by-file changes per export
   c. Exit (no files written)

3. Read .pi/ directory and manifest

4. Determine target exports:
   - --tool specified → that tool only
   - --tool all → iterate over manifest.exports keys
   - No --tool → all configured exports

5. For each target export:
   a. Apply pi → target file mappings
   b. Check existing files:
      - If --force: overwrite all
      - Else: warn on conflicts, skip unchanged
   c. Generate files (atomic writes per file)
   d. On partial failure: keep successful files, report failed

6. Update manifest timestamps and checksums

7. Report summary: files generated, conflicts, failures
```

**Dry-run output example:**

```
$ guardian generate --dryRun --tool claude

Calculating changes from .pi/ → .claude/...

=== .claude/ (12 files) ===
Changes:
  + context/project.md        (new)
  + context/patterns.md       (new)
  ~ prompts/bug-fix.md        (modified, content changed)
  = scripts/validate-ci.sh    (unchanged)
  = scripts/validate-tests.sh (unchanged)

Summary:
  2 new files
  1 modified file
  9 unchanged files
  Exit code: 0 (dry-run, no changes applied)
```

**Partial failure handling:**

If one export fails (e.g., disk full), Guardian:
- Keeps successfully generated exports intact (no rollback)
- Reports which exports failed with error message
- Updates manifest only for successful exports
- Exits with code 2 (warning / partial success)

### update — Detailed Flow

**Usage:**
```bash
guardian update [options]
```

| Flag | Description |
|------|-------------|
| `--dryRun` | Show changes without applying |
| `--force` | Overwrite user-editable files (dangerous) |
| `--regenerate` | Also regenerate exports after update |

**Merge strategy:**

| File State | Action |
|------------|--------|
| New in templates, not in manifest | **Add** — render + write |
| Unchanged framework file (hash matches) | **Update** — overwrite safely |
| User-modified + has YAML front matter | **Merge** — keep user's config, replace body |
| User-modified + no front matter | **Preserve** — don't touch |
| Generated export file | **Regenerate** (if --regenerate) |
| Removed from templates | **Orphan** — noted, not deleted |

**Dry-run output:**

```
$ guardian update --dryRun

Analyzing changes...

  + .pi/prompts/blueprint-update.md     (new feature)
  ~ .pi/agent/AGENTS.md                 (merge front matter + new body)
  ~ .pi/scripts/validate-ci.sh          (update, hash matches)
  → .pi/context/project.md             (preserved, user-modified)
  ✓ .claude/CLAUDE.md                  (regenerate, generated)

Summary:
  1 file added
  2 files updated
  1 file preserved
  1 file marked for regeneration
```

### .pi/ Source Structure

The full template tree that `guardian init` scaffolds:

```
.pi/
├── agent/
│   └── AGENTS.md              ← Project instructions + YAML front matter config
├── architecture/
│   ├── CHANGELOG.md           ← Architecture change log template
│   ├── decisions/
│   │   └── ADR-template.md    ← ADR template
│   ├── diagrams/
│   │   └── system-overview.md ← System diagram template
│   └── modules/
│       └── module-template.md ← Module doc template
├── context/
│   ├── checklists.md          ← Validation checklists
│   ├── output-formats.md      ← Report templates
│   ├── patterns-base.md       ← Base patterns (all languages)
│   ├── patterns.md            ← Language-specific patterns (overwritten)
│   └── project.md             ← Project facts template
├── domain/
│   └── exploration.md         ← DDD exploration output
├── extensions/                ← 20 Pi TypeScript extensions
│   ├── architect.ts
│   ├── pipeline.ts
│   ├── goal-loop.ts
│   ├── kanban.ts
│   ├── domain-explorer.ts
│   ├── project-scaffolder.ts
│   ├── coordinator.ts
│   ├── curator.ts
│   ├── bash-guard.ts
│   ├── filechanges.ts
│   ├── plan-mode.ts
│   ├── snippets.ts
│   ├── session-persistence.ts
│   ├── redaction.ts
│   ├── hooks.ts
│   ├── config-reload.ts
│   ├── read-only-mode.ts
│   ├── ask-user-question.ts
│   ├── slash-commands.ts
│   └── validation-runner.ts
├── github/
│   └── copilot-instructions.md ← GitHub Copilot export
├── prompts/                   ← 21 workflow prompt templates
│   ├── feature-development.md
│   ├── bug-fix.md
│   ├── hotfix.md
│   ├── refactoring.md
│   ├── epic-plan.md
│   ├── issue-implementation-series.md
│   ├── issue-closeout.md
│   ├── issue-merge.md
│   ├── issue-draft.md
│   ├── blueprint-validate.md
│   ├── blueprint-update.md
│   ├── context-refresh.md
│   ├── sync-check.md
│   ├── pattern-extract.md
│   ├── scope-analyzer.md
│   ├── plan-to-issues.md
│   └── ... (21 total)
├── scripts/                   ← Validator shell scripts (74)
│   ├── validate-ci.sh
│   ├── validate-tests.sh
│   ├── validate-security.sh
│   ├── validate-operations.sh
│   ├── validate-architecture.sh
│   ├── validate-integration.sh
│   ├── validate-canonical.sh
│   ├── validate-architecture-readiness.sh
│   ├── validate-ubiquitous-language.sh
│   ├── ci/                    ← 17 CI stage scripts
│   ├── git/                   ← 5 Git management scripts
│   └── languages/             ← Language-specific validators
├── skills/
│   ├── agents/                ← 27 agent definitions
│   └── validators/            ← 10 validator skill definitions
├── validators/                ← TOML declarative validation filters
│   ├── default.toml           ← Built-in validators with inline tests
│   └── spring.toml            ← Spring Boot annotation enforcement
├── INDEX.md                   ← Quick reference
└── README.md                  ← Framework docs
```

### Common Flags

| Flag | Applies To | Description |
|------|-----------|-------------|
| `-d, --dir <path>` | All | Target directory |
| `-v, --version` | All | Show version |
| `-h, --help` | All | Show help |
| `--dryRun` | project, generate, update, uninstall | Preview without changes |
| `--force` | init, project, generate, update, uninstall | Skip confirmations |
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

## Index: File Locations

All features map to real files in the repository:

| Feature | Location |
|---------|----------|
| Bug fix workflow | `.pi/prompts/bug-fix.md` |
| Feature development workflow | `.pi/prompts/feature-development.md` |
| Hotfix workflow | `.pi/prompts/hotfix.md` |
| Refactoring workflow | `.pi/prompts/refactoring.md` |
| Epic plan workflow | `.pi/prompts/epic-plan.md` |
| Issue implementation series | `.pi/prompts/issue-implementation-series.md` |
| Issue closeout | `.pi/prompts/issue-closeout.md` |
| Issue merge | `.pi/prompts/issue-merge.md` |
| Issue draft | `.pi/prompts/issue-draft.md` |
| Blueprint validate | `.pi/prompts/blueprint-validate.md` |
| Blueprint update | `.pi/prompts/blueprint-update.md` |
| Context refresh | `.pi/prompts/context-refresh.md` |
| Sync check | `.pi/prompts/sync-check.md` |
| Pattern extract | `.pi/prompts/pattern-extract.md` |
| Scope analyzer | `.pi/prompts/scope-analyzer.md` |
| Plan to issues | `.pi/prompts/plan-to-issues.md` |
| Architect extension | `.pi/extensions/architect.ts` |
| Pipeline extension | `.pi/extensions/pipeline.ts` |
| Goal loop extension | `.pi/extensions/goal-loop.ts` |
| Domain explorer extension | `.pi/extensions/domain-explorer.ts` |
| Kanban extension | `.pi/extensions/kanban.ts` |
| Curator extension | `.pi/extensions/curator.ts` |
| Project scaffolder extension | `.pi/extensions/project-scaffolder.ts` |
| Validation runner extension | `.pi/extensions/validation-runner.ts` |
| Plan mode extension | `.pi/extensions/plan-mode.ts` |
| Snippets extension | `.pi/extensions/snippets.ts` |
| CI scripts | `.pi/scripts/ci/` |
| Git scripts | `.pi/scripts/git/` |
| Language validators | `.pi/scripts/languages/{lang}/` |
| Agent definitions | `.pi/skills/agents/` |
| Validator definitions | `.pi/skills/validators/` |
