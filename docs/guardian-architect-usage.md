# Guardian — The Architecture Tool

**Guardian** is a CLI that scaffolds, validates, and orchestrates architecture-first development workflows. It turns canonical architecture documents into executable implementation pipelines where every slice must prove architectural conformance before it can merge.

---

## Quick Start (5 Minutes)

### 1. Initialize Guardian

```bash
cd your-project
npx guardian-framework init
```

This creates `.pi/` — your source of truth.

### 2. Add Your First Architecture Module

Create `.pi/architecture/modules/auth-system.md`:

```markdown
# Auth System

## Components

### JWT Token Validation
status: planned
description: Validates JWT tokens from request headers, checks expiry, signature, and claims.
depends: none

### OAuth2 Provider Integration
status: planned
description: Integrates with Google, GitHub OAuth2 providers for SSO.
depends: JWT Token Validation

### Session Management
status: planned
description: Manages user sessions with Redis-backed storage, automatic expiry.
depends: JWT Token Validation

### Architecture Observability
status: planned
description: Runbook, DR plan, metrics, tracing for the auth module.
depends: OAuth2 Provider Integration, Session Management
```

### 3. Start Your First Epic

```
/architect --epic "Auth Module v1"
```

Guardian discovers your module, finds the 4 planned components, generates 5 issues (4 implementation + 1 architecture readiness), and validates the epic draft.

### 4. Run the Pipeline

```
/pipeline "Auth Module v1" --items "issue-jwt-token-validation,issue-oauth2-provider-integration,issue-session-management,issue-architecture-readiness" --steps "implement,validate,create-mr,merge" --merge-on-valid
```

The agent implements each issue, runs 10 hardening stages, creates MRs, merges on green, and closes the epic.

---

## Table of Contents

1. [Architecture-First Setup](#1-architecture-first-setup)
2. [The /architect Command](#2-the-architect-command)
3. [The Hardening Pipeline](#3-the-hardening-pipeline)
4. [The /pipeline Command](#4-the-pipeline-command)
5. [The /goal Command](#5-the-goal-command)
6. [Custom Validators](#6-custom-validators)
7. [Git Integration](#7-git-integration)
8. [Full Walkthrough: Auth Module](#8-full-walkthrough-auth-module)
9. [Configuration Reference](#9-configuration-reference)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Architecture-First Setup

Guardian requires your architecture to be documented in `.pi/architecture/modules/`. Each module is a Markdown file with components that have `status` fields.

### Module File Format

```markdown
# Module Name

## Component Name
status: planned
description: What this component does.
depends: Other Component Name

## Another Component
status: implemented
description: Already done.
depends: Component Name
```

### Status Values

| Status | Meaning |
|--------|---------|
| `planned` | Not yet implemented — will appear in next epic |
| `in-progress` | Currently being worked on |
| `implemented` | Done, verified |
| `deprecated` | Being phased out |

### Directory Structure

```
.pi/
├── architecture/
│   ├── modules/
│   │   ├── auth-system.md
│   │   ├── api-gateway.md
│   │   └── user-service.md
│   └── decisions/
│       ├── ADR-001-auth-pattern.md
│       └── ADR-002-db-strategy.md
├── scripts/
│   ├── validate-ci.sh
│   ├── validate-security.sh
│   └── ci/
│       ├── check_architecture_conformance.sh
│       └── run_hardening_stages.sh
└── extensions/
    ├── architect.ts
    └── pipeline.ts
```

### Canonical References

Every implementation file must reference its architecture source:

```python
"""
Canonical Reference: .pi/architecture/modules/auth-system.md#jwt-token-validation
Implements: AC-1, AC-2
Last Sync: 2026-05-16
"""
```

The `validate-canonical.sh` script checks that all implementation files have these references.

---

## 2. The /architect Command

The single entry point for the full architecture-to-implementation process.

### Starting an Epic

```
/architect --epic "Auth Module v1"
```

Guardian:
1. Reads `.pi/architecture/modules/*.md`
2. Finds components with `status: planned`
3. Generates issues (one per component + one for architecture readiness)
4. Validates the epic draft against architecture, security, and operations validators
5. Creates a tracking issue on GitHub/GitLab (if configured)

### With Tracking Issue

```
/architect --epic "Auth Module v1" --tracking-issue 100
```

Links the epic to an existing tracking issue.

### Commands

| Command | Effect |
|---------|--------|
| `/architect --epic "Name"` | Start a new epic |
| `/architect status` | Show current epic progress |
| `/architect next-epic` | Discover the next logical epic |
| `/architect abort` | Kill the current epic |

### Tools (Agent-Callable)

| Tool | Description |
|------|-------------|
| `architect_status` | Returns current epic status |
| `architect_discover` | Discovers architecture modules and next slice |

### Epic Lifecycle

```
planning → validating → publishing → executing → done
                                    ↓
                                aborted
```

---

## 3. The Hardening Pipeline

Every MR must pass 10 hardening stages before it can merge. This is Guardian's core innovation: **architectural conformance is enforced at the CI level, not just at the agent level.**

### The 10 Stages

| Stage | Name | What It Checks | Conditional |
|-------|------|---------------|-------------|
| 1 | `docs_policy` | MR traceability, docs sync guard | Always |
| 2 | `architecture_conformance` | 11+ architectural contract checks | Always |
| 3 | `lint` | Language-specific linting + format | Always |
| 4 | `static_analysis` | Type checking, import boundaries, sanity | Always |
| 5 | `unit` | Domain, application, contract, verification tests | Always |
| 6 | `integration` | Integration tests | Always |
| 7 | `security` | SBOM, Trivy scan, secret scan, dependency audit | Always |
| 8 | `migration_verify` | Migration apply + index/policy check | Only if migration files changed |
| 9 | `package_build` | Docker build | Only on main branch |
| 10 | `release_readiness` | Runbook, observability, release policy | Always |

### Running the Hardening Pipeline

```bash
# Run all stages
bash .pi/scripts/ci/run_hardening_stages.sh

# Run specific stages
bash .pi/scripts/ci/run_hardening_stages.sh --stages lint,security,unit

# Verbose output
bash .pi/scripts/ci/run_hardening_stages.sh --verbose
```

### Architecture Conformance (Stage 2)

This is the most important stage. It checks 11+ architectural contracts:

| Check | What It Verifies |
|-------|-----------------|
| `tenant_isolation` | Tenant-scoped data never crosses tenant boundaries |
| `event_ordering` | Events processed in correct causal/temporal order |
| `outbox_dlq` | Outbox pattern and dead-letter queues properly implemented |
| `replay_upcaster` | Event replay and schema upcasting work correctly |
| `runstarted_publication` | Run-started events published correctly |
| `runstarted_worker_activation` | Workers activate correctly on run-started events |
| `bounded_execution` | LangGraph/AI executions bounded (timeout, token, step limits) |
| `artifact_proof_surfaces` | Artifact proof surfaces properly exposed |
| `runtime_baseline` | Runtime environment meets baseline requirements |
| `controlled_stage_progression` | State machines progress through defined stages only |
| `architecture_sanity` | No orphaned imports, concurrency safety, no env collisions |
| `import_boundaries` | No cross-layer violations (domain→infrastructure→api) |

Each check tries a **language-specific validator** first (`.py` for Python, `.ts` for TypeScript, `.sh` for Rust/Go), then falls back to grep-based pattern matching.

### Adding Language-Specific Validators

Drop your validators in `.pi/scripts/ci/`:

```
.pi/scripts/ci/
├── check_tenant_isolation.py      # Python validator
├── check_tenant_isolation.ts      # TypeScript validator
├── check_event_ordering.py
├── check_outbox_dlq.py
└── ...
```

The conformance runner auto-detects the project language and runs the right validator.

### Adding Custom Conformance Checks

1. Create `.pi/scripts/ci/check_my_conformance.sh` (or `.py`/`.ts`)
2. Add it to `check_architecture_conformance.sh` by calling your script
3. The hardening pipeline will automatically include it in Stage 2

---

## 4. The /pipeline Command

Multi-step workflow that iterates over items with per-step prompts and acceptance gates.

### Starting a Pipeline

```
/pipeline "Auth Module v1" --items "issue-jwt,issue-oauth,issue-session" --steps "implement,validate,create-mr,merge" --merge-on-valid
```

### Built-in Steps

| Step | Prompt Loaded | Acceptance Gate |
|------|--------------|-----------------|
| `implement` | `.pi/prompts/issue-implementation-series.md` | CI validator passes |
| `validate` | — | CI + tests + security all pass |
| `create-mr` | `.pi/prompts/issue-closeout.md` | None (always passes) |
| `merge` | — | CI + canonical pass |
| `document` | `.pi/prompts/blueprint-update.md` | Canonical validator passes |
| `test` | — | Tests validator passes |
| `security-review` | — | Security validator passes |

### Commands

| Command | Effect |
|---------|--------|
| `/pipeline <name> --items "..." --steps "..."` | Start pipeline |
| `/pipeline status` | Show progress |
| `/pipeline pause` | Pause at current step |
| `/pipeline resume` | Resume from where paused |
| `/pipeline skip-step` | Skip current step |
| `/pipeline retry-step` | Retry current step |
| `/pipeline abort` | Kill pipeline |

### Acceptance Gates

Each step can have a different gate:

```
validator → Runs specified validators (must all pass)
shell     → Runs custom shell command (exit 0 = pass)
llm       → LLM evaluates completion
none      → No gate (always passes)
```

---

## 5. The /goal Command

Set a standing objective that auto-iterates until validators + semantic check confirm completion.

### Basic Usage

```
/goal Fix every lint error in src/ and verify CI passes
```

### With Custom Validators

```
/goal Refactor auth module --validators ci,tests,security
/goal Security audit --validators all
/goal Increase coverage --validators ci,tests,coverage
```

### Commands

| Command | Effect |
|---------|--------|
| `/goal <text>` | Set standing goal |
| `/goal <text> --validators=ci,tests` | Set goal with specific validators |
| `/goal <text> --validators=all` | Run every validator |
| `/goal` or `/goal status` | Show current goal |
| `/goal pause` | Pause auto-continuation |
| `/goal resume` | Resume (resets counter) |
| `/goal clear` | Drop goal |
| `/goal validators` | Show current validators |
| `/goal validators --discover` | List all available validators |
| `/goal validators ci,tests` | Set validators on active goal |
| `/subgoal <text>` | Add criteria to active goal |
| `/subgoal list` | Show subgoals |
| `/subgoal remove <N>` | Remove subgoal by index |
| `/subgoal clear` | Remove all subgoals |

### Available Validators

| Validator | Script | Purpose |
|-----------|--------|---------|
| `ci` | `validate-ci.sh` | Build, lint, format, audit |
| `tests` | `validate-tests.sh` | Unit/integration test suite |
| `security` | `validate-security.sh` | Secrets, injection, path traversal |
| `operations` | `validate-operations.sh` | Tracing, cancellation, atomic writes |
| `architecture` | `validate-architecture.sh` | Layer structure, ADR compliance |
| `canonical` | `validate-canonical.sh` | Reference integrity, coverage |
| `integration` | `validate-integration.sh` | Integration test suite |

### Custom Validators

Any `validate-*.sh` script you drop in `.pi/scripts/` is auto-discovered:

```bash
printf '#!/bin/bash\nnpm run coverage -- --threshold=80\n' > .pi/scripts/validate-coverage.sh
chmod +x .pi/scripts/validate-coverage.sh

/goal Increase coverage --validators ci,tests,coverage
/goal validators --discover   # shows coverage under 'Custom'
```

---

## 6. Custom Validators

Guardian's validator system is extensible. You can add validators at three levels:

### Level 1: Simple Script Validators

Create `.pi/scripts/validate-my-check.sh`:

```bash
#!/bin/bash
set -euo pipefail

# Your check here
if grep -r "TODO" src/ | grep -v "node_modules" | head -1 | grep -q .; then
    echo "FAIL: TODOs found in source code"
    exit 1
fi

echo "PASS: No TODOs in source code"
exit 0
```

Make it executable: `chmod +x .pi/scripts/validate-my-check.sh`

Use it: `/goal Clean codebase --validators ci,my-check`

### Level 2: Architecture Conformance Checks

Create `.pi/scripts/ci/check_my_conformance.py` (or `.ts`/`.sh`):

```python
#!/usr/bin/env python3
"""Check that all database models have tenant_id scoping."""
import sys
import os

violations = 0
for root, dirs, files in os.walk("app"):
    for f in files:
        if f.endswith(".py"):
            path = os.path.join(root, f)
            with open(path) as fh:
                content = fh.read()
                if "tenant_id" in content and "WHERE" not in content:
                    violations += 1
                    print(f"FAIL: {path} has tenant_id but no tenant-scoped queries")

if violations > 0:
    sys.exit(1)

print("PASS: All tenant-scoped models have proper filtering")
sys.exit(0)
```

The architecture conformance runner (Stage 2 of the hardening pipeline) will auto-discover and run it.

### Level 3: CI/CD Pipeline Stage

Create `.pi/scripts/ci/stage_my_stage.sh`:

```bash
#!/bin/bash
set -euo pipefail

echo "  Running my custom stage..."

# Your check here
if some_check; then
    echo "  ✓ PASS: my custom stage"
    exit 0
else
    echo "  ✗ FAIL: my custom stage"
    exit 1
fi
```

Add it to `run_hardening_stages.sh`:

```bash
run_stage "11" "my_custom_stage" \
    "${SCRIPTS_DIR}/stage_my_stage.sh" \
    "always"
```

---

## 7. Git Integration

Guardian wraps `gh` (GitHub CLI) and `glab` (GitLab CLI) for issue/epic management.

### Setup

```bash
# GitHub
gh auth login

# GitLab
glab auth login
```

### Available Scripts

| Script | Purpose |
|--------|---------|
| `create-tracking-issue.sh` | Create epic tracking issue |
| `update-tracking-issue.sh` | Post progress updates |
| `close-issue.sh` | Close individual issue |
| `close-epic.sh` | Close epic + tracking issue |
| `link-issue-to-epic.sh` | Link issue to epic |

### Usage

```bash
# Create tracking issue
bash .pi/scripts/git/create-tracking-issue.sh --title "Epic: Auth Module v2" --body "Tracking progress"

# Update tracking issue
bash .pi/scripts/git/update-tracking-issue.sh --id 100 --comment "✓ Issue #102 complete"

# Close issue
bash .pi/scripts/git/close-issue.sh --id 102

# Close epic
bash .pi/scripts/git/close-epic.sh --epic-id 101 --tracking-id 100 --comment "Epic complete"

# Link issue to epic
bash .pi/scripts/git/link-issue-to-epic.sh --issue-id 102 --epic-id 101
```

### Platform Detection

Guardian auto-detects the platform:
- If `gh auth status` works → GitHub
- If `glab auth status` works → GitLab
- Otherwise → local tracking files in `.pi/.tracking/`

You can override with `GIT_PLATFORM=github` or `GIT_PLATFORM=gitlab`.

---

## 8. Full Walkthrough: Auth Module

This is a complete end-to-end example.

### Step 1: Set Up Architecture

```bash
cd your-project
npx guardian-framework init
```

Create `.pi/architecture/modules/auth-system.md`:

```markdown
# Auth System

## JWT Token Validation
status: planned
description: Validates JWT tokens from request headers, checks expiry, signature, and claims.
depends: none

## OAuth2 Provider Integration
status: planned
description: Integrates with Google, GitHub OAuth2 providers for SSO.
depends: JWT Token Validation

## Session Management
status: planned
description: Manages user sessions with Redis-backed storage, automatic expiry.
depends: JWT Token Validation

## Architecture Observability
status: planned
description: Runbook, DR plan, metrics, tracing for the auth module.
depends: OAuth2 Provider Integration, Session Management
```

### Step 2: Discover Next Slice

```
/architect next-epic

Next epic: auth-system (4 components planned)
Components: JWT Token Validation, OAuth2 Provider Integration, Session Management, Architecture Observability
```

### Step 3: Start the Epic

```
/architect --epic "Auth Module v1"

▶ Epic "Auth Module v1" started
Module: auth-system
Components to implement:
  - JWT Token Validation (Validates JWT tokens from request headers...)
  - OAuth2 Provider Integration (Integrates with Google, GitHub OAuth2...)
  - Session Management (Manages user sessions with Redis-backed...)
  - Architecture Observability (Runbook, DR plan, metrics, tracing...)

Issues generated: 5 (4 implementation + 1 architecture readiness)
```

### Step 4: Validate Epic Draft

Guardian automatically runs:
- `validate-architecture.sh` — Checks ADR compliance, module boundaries
- `validate-security.sh` — Checks threat model, auth patterns
- `validate-operations.sh` — Checks observability, tracing

If any fail, Guardian halts and shows the failures. Fix them, then continue.

### Step 5: Publish to GitHub/GitLab

```bash
# Guardian auto-creates tracking issue if gh/glab is configured
TRACKING_ID=100  # Created automatically
```

### Step 6: Run the Pipeline

```
/pipeline "Auth Module v1" --items "issue-jwt-token-validation,issue-oauth2-provider-integration,issue-session-management,issue-architecture-readiness" --steps "implement,validate,create-mr,merge" --merge-on-valid
```

What happens:

```
[1/20] Item: issue-jwt-token-validation → Step: implement
  Agent: [loads issue-implementation-series.md, creates auth/jwt_validator.py]
  [CI passes] → ✓

[2/20] Item: issue-jwt-token-validation → Step: validate
  Agent: [runs 10 hardening stages]
  Stage 1: docs_policy → ✓
  Stage 2: architecture_conformance → ✓ (11 checks pass)
  Stage 3: lint → ✓
  Stage 4: static_analysis → ✓
  Stage 5: unit → ✓
  Stage 6: integration → ✓
  Stage 7: security → ✓
  Stage 8: migration_verify → ⊘ skipped (no migration changes)
  Stage 9: package_build → ⊘ skipped (not on main)
  Stage 10: release_readiness → ✓
  → ✓ All stages pass

[3/20] Item: issue-jwt-token-validation → Step: create-mr
  Agent: [creates MR #102]
  → ✓

[4/20] Item: issue-jwt-token-validation → Step: merge
  Agent: [validates MR, merges]
  → ✓ Issue #102 closed. Tracking issue #100 updated.

[5/20] Item: issue-oauth2-provider-integration → Step: implement
  ...continues for each issue...

[17/20] Item: issue-architecture-readiness → Step: implement
  Agent: [creates docs/runbook.md, docs/dr-plan.md, updates architecture docs]

[18/20] Item: issue-architecture-readiness → Step: validate
  Agent: [runs validate-architecture-readiness.sh]
  ✓ Runbook readiness
  ✓ DR plan readiness
  ✓ Documentation sync
  ✓ Canonical references
  ✓ Observability: tracing detected
  ✓ Observability: metrics detected
  ✓ Architecture conformance

[20/20] Item: issue-architecture-readiness → Step: merge
  ✓ Merged! Epic complete.

✅ Epic "Auth Module v1" complete. 5/5 issues done.
```

### Step 7: Close Epic

```bash
bash .pi/scripts/git/close-epic.sh --epic-id 101 --tracking-id 100 --comment "Auth Module v1 complete. 5/5 issues done. 0 retries."
```

### Step 8: Next Epic

```
/architect next-epic

Next epic: api-gateway (3 components planned)

/architect --epic "API Gateway v1"
# ... same process repeats
```

---

## 9. Configuration Reference

### AGENTS.md Front Matter

```yaml
# Workspace settings
workspace:
  root: ".pi/workspaces"
  hooks:
    timeout_ms: 60000

# Agent settings
agent:
  max_turns: 20
  max_retry_backoff_ms: 300000
  stall_timeout_ms: 300000

# Goal settings
goal:
  enabled: true
  max_turns: 20
  judge_validator: true

# Kanban settings
kanban:
  enabled: true
  auto_create_tasks: true

# Shell hooks
hooks:
  pre_tool_call:
    - command: "~/.pi/hooks/block-rm-rf.sh"
      matcher: "bash"
      timeout: 5
  post_tool_call:
    - command: "~/.pi/hooks/auto-format.sh"
      matcher: "write|edit"

# Curator settings
curator:
  enabled: true
  stale_after_days: 30
  archive_after_days: 90
  auto_review: true

# Delegation settings
delegation:
  max_spawn_depth: 1
  max_concurrent_children: 3
  max_iterations: 50
  child_timeout_ms: 600000
```

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `GITHUB_TOKEN` | GitHub API authentication |
| `GITLAB_TOKEN` | GitLab API authentication |
| `GIT_PLATFORM` | Force platform: `github` or `gitlab` |
| `COVERAGE_THRESHOLD` | Minimum coverage percentage (default: 80) |
| `SONAR_TOKEN` | SonarQube authentication |
| `SONAR_HOST_URL` | SonarQube host URL |

---

## 10. Troubleshooting

### "No architecture modules found"

Create `.pi/architecture/modules/` with at least one module file:

```bash
mkdir -p .pi/architecture/modules
cat > .pi/architecture/modules/my-module.md << 'EOF'
# My Module

## Component
status: planned
description: Description here.
depends: none
EOF
```

### "Hardening stage failed"

Check which stage failed:

```bash
bash .pi/scripts/ci/run_hardening_stages.sh --verbose
```

Fix the issue, then retry the pipeline step.

### "Git platform not detected"

Install and authenticate the CLI:

```bash
# GitHub
brew install gh
gh auth login

# GitLab
brew install glab
glab auth login
```

Or set `GIT_PLATFORM=github` or `GIT_PLATFORM=gitlab`.

### "Validator not found"

Custom validators must be in `.pi/scripts/` and start with `validate-`:

```bash
# Correct
.pi/scripts/validate-coverage.sh

# Wrong (won't be auto-discovered)
.pi/scripts/check-coverage.sh
```

### "Pipeline stuck on a step"

```
/pipeline skip-step    # Skip and move to next step
/pipeline retry-step   # Retry the current step
/pipeline abort        # Kill the pipeline
```

### "Goal loop not continuing"

Check the goal status:

```
/goal status
```

If validators are failing, fix them. If the turn budget is exhausted:

```
/goal resume   # Resets counter, continues
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    GUARDIAN ARCHITECT                           │
│                                                                 │
│  1. DISCOVER → 2. PLAN → 3. VALIDATE → 4. GENERATE             │
│     ↓             ↓          ↓           ↓                     │
│  Read modules   Generate   Run arch/   Create epic             │
│  Find slices    epic+issues security/  + issues on             │
│                 drafts      ops val.    GitLab/GitHub           │
│                                                                 │
│  5. EXECUTE (per issue via /pipeline)                          │
│  implement → validate → create-MR → merge-on-green             │
│  After each: 10 hardening stages must pass                     │
│                                                                 │
│  6. ARCHITECTURE READINESS (final issue)                       │
│  runbook → DR plan → docs → canonical → observability          │
│                                                                 │
│  7. CLOSE → 8. NEXT EPIC (loop back to 1)                      │
└─────────────────────────────────────────────────────────────────┘
```

Every MR must pass all mandatory hardening stages before it can merge. No exceptions. This is what makes Guardian **THE ARCHITECTURE TOOL**.

---

## See Also

- [guardian-domain-usage.md](guardian-domain-usage.md) — Domain exploration (`/domain`) — discover bounded contexts before architecting
- [guardian-complete-usage.md](guardian-complete-usage.md) — Complete Guardian usage guide
- [pipeline-usage.md](pipeline-usage.md) — Pipeline engine reference
