# Guardian — Complete Usage Guide

> **Guardian** is a CLI that scaffolds, validates, and orchestrates architecture-first development workflows. It turns canonical architecture documents into executable implementation pipelines where every slice must prove architectural conformance before it can merge.

---

## Table of Contents

1. [What Is Guardian?](#1-what-is-guardian)
2. [Quick Start (5 Minutes)](#2-quick-start-5-minutes)
3. [The Architecture-First Model](#3-the-architecture-first-model)
4. [Creating Architecture Modules](#4-creating-architecture-modules)
5. [The Issue Factory](#5-the-issue-factory)
6. [The Architect Orchestrator](#6-the-architect-orchestrator)
7. [The Hardening Pipeline](#7-the-hardening-pipeline)
8. [The Pipeline Engine](#8-the-pipeline-engine)
9. [The Goal Loop](#9-the-goal-loop)
10. [Local Developer Workflow](#10-local-developer-workflow)
11. [Git Integration](#11-git-integration)
12. [Custom Validators](#12-custom-validators)
13. [Shell Hooks](#13-shell-hooks)
14. [Skill Curator](#14-skill-curator)
15. [Architecture Generator](#15-architecture-generator)
16. [Kanban Task Board](#16-kanban-task-board)
17. [Complete Walkthrough: Auth Module](#17-complete-walkthrough-auth-module)
18. [Configuration Reference](#18-configuration-reference)
19. [Troubleshooting](#19-troubleshooting)
20. [See Also](#20-see-also)

---

## 1. What Is Guardian?

Guardian is **THE ARCHITECTURE TOOL** — a system that ensures every piece of code traces back to canonical architecture, every MR passes 10 mandatory hardening stages, and every epic completes with architecture readiness (runbook, DR, docs, observability).

### Core Principles

1. **Architecture-first** — Code traces back to `.pi/architecture/modules/*.md`
2. **Deterministic validation** — Scripts decide readiness, not LLMs
3. **Self-driving execution** — Once you approve the epic draft, everything runs automatically
4. **Architecture readiness is mandatory** — No epic closes without runbook, DR, docs, canonical sync
5. **Infinite loop** — When one epic completes, the next one starts automatically
6. **Local fast feedback** — Preflight engine catches issues before CI
7. **Every MR must pass 10 hardening stages** — No exceptions

### What Makes Guardian Different

| Traditional Development | Guardian |
|------------------------|----------|
| Code first, docs later | Architecture first, code follows |
| Ad-hoc validation | 10 mandatory hardening stages per MR |
| Manual MR review | Agent implements, validates, creates MR, merges on green |
| No architectural conformance | 11+ conformance checks enforced at CI level |
| Babysitting required | Zero babysitting — fully automated loop |
| Local checks are optional | Local preflight engine catches issues before commit |

---

## 2. Quick Start (5 Minutes)

### Step 1: Initialize Guardian

```bash
cd your-project
npx guardian-framework init
```

This creates `.pi/` — your source of truth.

### Step 2: Add Your First Architecture Module

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

### Step 3: Start Your First Epic

```
/architect --epic "Auth Module v1"
```

Guardian discovers your module, finds 4 planned components, generates 5 issues (4 implementation + 1 architecture readiness), and validates the epic draft.

### Step 4: Run the Pipeline

```
/pipeline "Auth Module v1" --items "jwt-token-validation,oauth2-provider-integration,session-management,architecture-readiness" --steps "implement,validate,create-mr,merge" --merge-on-valid
```

The agent implements each issue, runs 10 hardening stages, creates MRs, merges on green, and closes the epic.

### Step 5: Local Preflight (Before Every Commit)

```bash
# Run all preflight checks
bash .pi/scripts/ci/run_preflight.sh

# Check only staged files (pre-commit)
bash .pi/scripts/ci/run_preflight.sh --staged

# Run only security stage
bash .pi/scripts/ci/run_stage.sh security
```

---

## 3. The Architecture-First Model

Guardian requires your architecture to be documented in `.pi/architecture/modules/`. Every implementation file must reference its architecture source.

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
│   ├── modules/                    # Canonical architecture modules
│   │   ├── auth-system.md
│   │   ├── api-gateway.md
│   │   └── user-service.md
│   └── decisions/                  # Architecture Decision Records
│       ├── ADR-001-auth-pattern.md
│       └── ADR-002-db-strategy.md
├── scripts/
│   ├── validate-ci.sh              # CI validator
│   ├── validate-tests.sh           # Test validator
│   ├── validate-security.sh        # Security validator
│   ├── validate-operations.sh      # Operations validator
│   ├── validate-architecture.sh    # Architecture validator
│   ├── validate-canonical.sh       # Canonical reference validator
│   ├── validate-integration.sh     # Integration validator
│   ├── validate-architecture-readiness.sh  # Epic readiness validator
│   ├── validate-ubiquitous-language.sh     # Ubiquitous language check
│   ├── generate-architecture.sh    # Generate modules from intent/docs
│   ├── validation-cache.sh         # Retry optimization
│   ├── create-mr.sh                # MR creation
│   ├── merge-mr.sh                 # MR merge
│   ├── mr-validation.sh            # MR validation
│   ├── create-feature-branch.sh    # Branch creation
│   ├── fetch-issues.sh             # Issue fetching
│   ├── categorize-issues.sh        # Issue categorization
│   ├── ci/
│   │   ├── check_architecture_conformance.sh  # 11+ conformance checks
│   │   ├── run_hardening_stages.sh             # 10-stage orchestrator
│   │   ├── run_preflight.sh                    # Local preflight engine
│   │   ├── run_stage.sh                        # Individual stage runner
│   │   ├── validate_agent_output.sh            # Agent output validator
│   │   └── stage_*.sh                          # 11 stage scripts (docs_policy through remaining)
│   └── git/
│       ├── create-tracking-issue.sh
│       ├── update-tracking-issue.sh
│       ├── close-issue.sh
│       ├── close-epic.sh
│       └── link-issue-to-epic.sh
├── prompts/
│   ├── issue-template.md           # Professional issue contract
│   ├── issue-template-set.md       # 7 issue templates
│   ├── epic-template.md            # Epic template
│   └── ci-blueprint.md             # CI/CD pipeline reference
├── extensions/                     # Pi extensions
│   ├── architect.ts                # Epic orchestrator
│   ├── pipeline.ts                 # Pipeline engine
│   ├── goal-loop.ts                # Standing goals
│   └── ...
└── skills/
    └── agents/
        ├── issue-factory.md        # Issue generation skill
        └── architecture-generator.md  # Module generation skill
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

## 4. Creating Architecture Modules

### From Scratch

Create a new module file:

```bash
mkdir -p .pi/architecture/modules
cat > .pi/architecture/modules/payment-system.md << 'EOF'
# Payment System

## Stripe API Integration
status: planned
description: Integrates with Stripe API for payment processing, including charge creation, refunds, and webhooks.
depends: none

## Webhook Handler
status: planned
description: Handles Stripe webhook events for payment confirmation, refund processing, and dispute management.
depends: Stripe API Integration

## Idempotency Layer
status: planned
description: Ensures webhook events and payment requests are idempotent to prevent double-charging.
depends: Webhook Handler

## Reconciliation Engine
status: planned
description: Matches Stripe transactions with internal ledger entries, detects discrepancies.
depends: Idempotency Layer

## Architecture Observability
status: planned
description: Runbook, DR plan, metrics, tracing for the payment module.
depends: all above
EOF
```

### From Intent

```
/architect-generate --intent "Build a payment processing system with Stripe integration, webhook handling, idempotency, and reconciliation"
```

### From Existing Documents

```bash
bash .pi/scripts/generate-architecture.sh \
  --from "docs/prd.md,docs/payment-design.md,docs/api-spec.md" \
  --module "payment-system"
```

### Validation Rules

Before a module is accepted:

1. **No orphaned components** — every component has at least one dependency or is a root
2. **No circular dependencies** — components don't form dependency cycles
3. **Clear separation of concerns** — components don't overlap in responsibility
4. **Observable interfaces** — each component has clear inputs and outputs
5. **DR-ready** — failure modes and recovery paths are considered

---

## 5. The Issue Factory

The Issue Factory transforms accepted architecture scope into executable issues with complete session context. Every issue generated contains everything a fresh agent needs to implement correctly.

### Issue Structure

```markdown
---
guardian_issue:
  id: ISSUE-001
  title: "JWT Token Validation"
  epic: "Auth Module v1"
  epic_id: EPIC-001
  tracking_issue: 100
  status: planned
  priority: high

  intent: |
    Implement JWT token validation for the auth system.

  dependencies:
    - name: none
      type: external

  in_scope:
    - JWT token parsing and validation
    - RS256 signature verification with JWK rotation
    - Unit tests for all validation paths

  out_of_scope:
    - Token generation
    - OAuth2 flow
    - UI/login pages

  affected_layers:
    domain:
      - "New: JwtToken entity"
      - "New: TokenValidator interface"
    application:
      - "New: ValidateToken use case"
    infrastructure:
      - "New: JwkClient for fetching public keys"
    api:
      - "New: Auth middleware for token validation"

  canonical_references:
    - module: ".pi/architecture/modules/auth-system.md#jwt-token-validation"
    - adr:
        - ".pi/architecture/decisions/ADR-001-auth-pattern.md"

  acceptance_criteria:
    - "CI pipeline passes (validate-ci.sh)"
    - "All unit tests pass with ≥ 90% coverage"
    - "validate-security.sh passes"
    - "validate-architecture.sh passes"
    - "validate-canonical.sh passes"

  validators:
    - ci
    - tests
    - security
    - architecture
    - canonical

  implementation_notes: |
    - Use PyJWT library for Python / jsonwebtoken for TypeScript
    - JWK cache TTL: 1 hour, refresh on signature failure
    - Reject tokens with exp < now() - 30s
---

# ISSUE-001: JWT Token Validation

## Intent
...

## Dependencies
...

## In Scope / Out of Scope
...

## Affected Layers
...

## Acceptance Criteria
...

## Implementation Notes
...
```

### Issue Templates

Guardian provides 7 professional issue templates:

| Template | Use Case |
|----------|----------|
| **Contract Issue** | Domain contracts, API contracts, event contracts |
| **Schema/Index/Config Issue** | Migrations, indexes, RLS policies, config changes |
| **Repository/Service Issue** | Data access, storage adapters, external integrations |
| **Handler/Runtime Issue** | Commands, queries, workers, LangGraph flows |
| **Verification/Conformance Issue** | Conformance tests, CI enforcement, regression tests |
| **Rollout/Runbook/Ops Issue** | Dashboards, alerts, runbooks, rollback steps |
| **High-Risk Addendum** | For `risk::high` issues — failure modes, security review, rollback plan |

### Dependency Ordering

Issues are created in this order:

1. **Contract issue** — Domain contracts, API contracts
2. **Schema/Index issue** — Migrations, indexes, config
3. **Repository/Service issue** — Data access, adapters
4. **Handler/Runtime issue** — Business logic, workers
5. **Verification issue** — Tests, conformance
6. **Rollout/Runbook issue** — Ops, monitoring

### Recommended Labels

| Label | Meaning |
|-------|---------|
| `layer::domain` | Domain model, entities, value objects |
| `layer::application` | Use cases, services, handlers |
| `layer::infrastructure` | Databases, queues, external APIs |
| `layer::api` | REST/gRPC endpoints, middleware |
| `layer::security` | Auth, encryption, secrets |
| `layer::operations` | Observability, runbooks, DR |
| `type::feature` | New functionality |
| `type::hardening` | Security/performance improvement |
| `risk::high` | Breaks existing behavior |
| `risk::medium` | Changes internal behavior |
| `risk::low` | Additive, no breaking changes |

---

## 6. The Architect Orchestrator

The `/architect` command is the single entry point for the full architecture-to-implementation process.

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

### Commands

| Command | Effect |
|---------|--------|
| `/architect --epic "Name"` | Start a new epic |
| `/architect --epic "Name" --tracking-issue 100` | Start epic linked to existing tracking issue |
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

## 7. The Hardening Pipeline

Every MR must pass **10 mandatory hardening stages** before it can merge. This is Guardian's core innovation.

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
| 11 | `remaining` | Unclassified staging, catch-all | Always |

> **Note:** There are 11 stage scripts in `.pi/scripts/ci/` (`stage_docs_policy.sh` through `stage_remaining.sh`). The pipeline runner auto-discovers all `stage_*.sh` files. Add custom stages by creating new `stage_*.sh` files.
### Architecture Conformance (Stage 2)

The most important stage. Checks 11+ architectural contracts via `check_architecture_conformance.sh`:

| Check | What It Verifies |
|-------|-----------------|
| `tenant_isolation` | Tenant-scoped data never crosses tenant boundaries |
| `event_ordering` | Events processed in correct causal/temporal order |
| `outbox_dlq` | Outbox pattern and dead-letter queues properly implemented |
| `replay_upcaster` | Event replay and schema upcasting work correctly |
| `runstarted_publication` | Run-started events published correctly |
| `runstarted_worker_activation` | Workers activate correctly on run-started events |
| `bounded_execution` | AI executions bounded (timeout, token, step limits) |
| `artifact_proof_surfaces` | Artifact proof surfaces properly exposed |
| `runtime_baseline` | Runtime environment meets baseline requirements |
| `controlled_stage_progression` | State machines progress through defined stages only |
| `architecture_sanity` | No orphaned imports, concurrency safety, no env collisions |
| `import_boundaries` | No cross-layer violations (domain→infrastructure→api) |

Each check first looks for a language-specific validator script (`.py` for Python, `.ts` for TypeScript, `.sh` for Rust/Go), then falls back to grep-based pattern matching. Language-specific validator files can be created in `.pi/scripts/ci/`; without them, the grep-based fallbacks run automatically.
### Running the Hardening Pipeline

```bash
# Run all stages
bash .pi/scripts/ci/run_hardening_stages.sh

# Run specific stages
bash .pi/scripts/ci/run_hardening_stages.sh --stages lint,security,unit

# Verbose output
bash .pi/scripts/ci/run_hardening_stages.sh --verbose
```

### Adding Language-Specific Validators

Drop your validators in `.pi/scripts/ci/`:

```
.pi/scripts/ci/
├── check_tenant_isolation.py      # Python validator (aspirational — create your own)
├── check_tenant_isolation.ts      # TypeScript validator (aspirational — create your own)
├── check_tenant_isolation.sh      # Rust/Go validator (aspirational — create your own)
├── check_event_ordering.py
├── check_outbox_dlq.py
└── ...
```

The conformance runner auto-detects the project language and runs the right validator. If no language-specific validator exists, it falls back to grep-based pattern matching (already built into `check_architecture_conformance.sh`).

---

## 8. The Pipeline Engine

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

## 9. The Goal Loop

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

## 10. Local Developer Workflow

Run checks locally before you commit, push, or create an MR.

### Preflight Engine

```bash
# Run all preflight checks
bash .pi/scripts/ci/run_preflight.sh

# Run only specific stage
bash .pi/scripts/ci/run_preflight.sh --stage=security

# Check staged files only (pre-commit)
bash .pi/scripts/ci/run_preflight.sh --staged

# JSON output for CI/agent integration
bash .pi/scripts/ci/run_preflight.sh --json > preflight_report.json

# Verbose output
bash .pi/scripts/ci/run_preflight.sh --verbose
```

### Pre-commit Integration

```bash
# Add to .git/hooks/pre-commit:
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
set -e
echo "Running preflight checks..."
bash .pi/scripts/ci/run_preflight.sh --staged
EOF
chmod +x .git/hooks/pre-commit
```

### Stage Runner

Run individual CI stages locally:

```bash
bash .pi/scripts/ci/run_stage.sh docs_policy
bash .pi/scripts/ci/run_stage.sh architecture_conformance
bash .pi/scripts/ci/run_stage.sh lint
bash .pi/scripts/ci/run_stage.sh static_analysis
bash .pi/scripts/ci/run_stage.sh unit
bash .pi/scripts/ci/run_stage.sh integration
bash .pi/scripts/ci/run_stage.sh security
bash .pi/scripts/ci/run_stage.sh migration_verify
bash .pi/scripts/ci/run_stage.sh package_build
bash .pi/scripts/ci/run_stage.sh release_readiness
```

### Agent Output Validator

```bash
# Validate architecture validator output
bash .pi/scripts/ci/validate_agent_output.sh \
  --input=architecture_validator_output.md \
  --schema=architecture-validator

# Validate epic plan
bash .pi/scripts/ci/validate_agent_output.sh \
  --input=epic_plan.md \
  --schema=epic-plan

# Validate issue draft
bash .pi/scripts/ci/validate_agent_output.sh \
  --input=issue_draft.md \
  --schema=issue-draft

# JSON output
bash .pi/scripts/ci/validate_agent_output.sh \
  --input=output.md \
  --json
```

### IDE Integration (VS Code)

Add to `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Run Guardian Preflight",
      "type": "shell",
      "command": "bash .pi/scripts/ci/run_preflight.sh",
      "group": "test"
    },
    {
      "label": "Run Guardian Security Checks",
      "type": "shell",
      "command": "bash .pi/scripts/ci/run_stage.sh security",
      "group": "test"
    }
  ]
}
```

### Service Setup

For full local testing:

```bash
# PostgreSQL
docker run -d --name guardian-postgres \
  -e POSTGRES_PASSWORD=test -p 5432:5432 postgres:16

# Redis
docker run -d --name guardian-redis -p 6379:6379 redis:7

# Run integration tests
bash .pi/scripts/ci/run_stage.sh integration
```

---

## 11. Git Integration

Guardian wraps `gh` (GitHub CLI) and `glab` (GitLab CLI) for issue/epic management.

### Setup

```bash
# GitHub
gh auth login

# GitLab
glab auth login
```

### Scripts

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
bash .pi/scripts/git/create-tracking-issue.sh \
  --title "Epic: Auth Module v2" \
  --body "Tracking progress"

# Update tracking issue
bash .pi/scripts/git/update-tracking-issue.sh \
  --id 100 \
  --comment "✓ Issue #102 complete"

# Close issue
bash .pi/scripts/git/close-issue.sh --id 102

# Close epic
bash .pi/scripts/git/close-epic.sh \
  --epic-id 101 \
  --tracking-id 100 \
  --comment "Epic complete"

# Link issue to epic
bash .pi/scripts/git/link-issue-to-epic.sh \
  --issue-id 102 \
  --epic-id 101
```

### Platform Detection

Guardian auto-detects:
- `gh auth status` works → GitHub
- `glab auth status` works → GitLab
- Neither → local tracking files in `.pi/.tracking/`

Override with `GIT_PLATFORM=github` or `GIT_PLATFORM=gitlab`.

---

## 12. Custom Validators

Guardian's validator system is extensible. You can add validators at three levels:

### Level 1: Simple Script Validators

Create `.pi/scripts/validate-my-check.sh`:

```bash
#!/bin/bash
set -euo pipefail

if grep -r "TODO" src/ | grep -v "node_modules" | head -1 | grep -q .; then
    echo "FAIL: TODOs found in source code"
    exit 1
fi

echo "PASS: No TODOs in source code"
exit 0
```

```bash
chmod +x .pi/scripts/validate-my-check.sh
/goal Clean codebase --validators ci,my-check
```

### Level 2: Architecture Conformance Checks

Create `.pi/scripts/ci/check_my_conformance.py`:

```python
#!/usr/bin/env python3
"""Check that all database models have tenant_id scoping."""
import sys, os

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

### Level 3: CI/CD Pipeline Stage

Create `.pi/scripts/ci/stage_my_stage.sh`:

```bash
#!/bin/bash
set -euo pipefail

echo "  Running my custom stage..."

if some_check; then
    echo "  ✓ PASS: my custom stage"
    exit 0
else
    echo "  ✗ FAIL: my custom stage"
    exit 1
fi
```

Add to `run_hardening_stages.sh`:

```bash
run_stage "11" "my_custom_stage" \
    "${SCRIPTS_DIR}/stage_my_stage.sh" \
    "always"
```

---

## 13. Shell Hooks

Declarative shell scripts that fire on lifecycle events.

### Supported Events

| Event | Fires When | Can Block? | Can Inject Context? |
|-------|-----------|------------|---------------------|
| `pre_tool_call` | Before any tool executes | Yes | No |
| `post_tool_call` | After any tool returns | No | No |
| `pre_llm_call` | Before LLM turn starts | No | Yes |
| `post_llm_call` | After LLM turn completes | No | No |
| `on_session_start` | New session created | No | No |
| `on_session_end` | Session ended | No | No |
| `subagent_stop` | Subagent completed | No | No |

### Configuration (AGENTS.md front matter)

```yaml
hooks:
  pre_tool_call:
    - command: "~/.pi/hooks/block-rm-rf.sh"
      matcher: "bash"
      timeout: 5
  post_tool_call:
    - command: "~/.pi/hooks/auto-format.sh"
      matcher: "write|edit"
  pre_llm_call:
    - command: "~/.pi/hooks/inject-git-status.sh"
```

### Example: Block Destructive Commands

```bash
#!/usr/bin/env bash
# ~/.pi/hooks/block-rm-rf.sh
payload="$(cat -)"
cmd=$(echo "$payload" | jq -r '.tool_input.command // empty')
if echo "$cmd" | grep -qE 'rm[[:space:]]+-rf?[[:space:]]+/'; then
  printf '{"decision": "block", "reason": "blocked: rm -rf / is not permitted"}\n'
else
  printf '{}\n'
fi
```

### Example: Inject Git Status Every Turn

```bash
#!/usr/bin/env bash
# ~/.pi/hooks/inject-git-status.sh
cat - >/dev/null
if status=$(git status --porcelain 2>/dev/null) && [[ -n "$status" ]]; then
  jq --null-input --arg s "$status" \
     '{context: ("Uncommitted changes:\n" + $s)}'
else
  printf '{}\n'
fi
```

### CLI Commands

| Command | Effect |
|---------|--------|
| `/hooks` or `/hooks list` | Show all registered hooks |
| `/hooks test <event>` | Test hooks for a specific event |

---

## 14. Skill Curator

Background maintenance for agent-created skills. Tracks usage, detects stale/unused skills, recommends archival.

### Lifecycle

```
active → stale (30 days unused) → archived (90 days unused)
```

### Commands

| Command | Effect |
|---------|--------|
| `/curator` or `/curator status` | Show usage stats and review history |
| `/curator review` | Run review pass (archives stale skills) |
| `/curator review --dry-run` | Preview review without mutations |
| `/curator pin <skill>` | Protect a skill from archival |
| `/curator unpin <skill>` | Remove protection |
| `/curator restore <skill>` | Move archived skill back to active |

### Configuration

```yaml
curator:
  enabled: true
  stale_after_days: 30
  archive_after_days: 90
  auto_review: true
```

---

## 15. Architecture Generator

Generate canonical architecture modules from intent or existing documents.

### From Intent

```
/architect-generate --intent "Build an auth system with JWT validation, OAuth2 SSO, Redis session management, and full observability"
```

### From Existing Documents

```bash
bash .pi/scripts/generate-architecture.sh \
  --from "docs/prd.md,docs/auth-design.md,docs/api-spec.md" \
  --module "auth-system"
```

### Process

1. **Analyze** the intent or existing documents
2. **Identify** components, their responsibilities, and dependencies
3. **Structure** the architecture module with proper status, dependencies, and descriptions
4. **Validate** the module against Guardian's architecture conformance rules
5. **Write** the canonical module to `.pi/architecture/modules/<name>.md`

---

## 16. Kanban Task Board

A JSON-backed task board with state machine, dependency links, and comments.

### Task States

```
triage → todo → ready → running → done → archived
                ↑         ↓         ↑
                └── blocked ────────┘
```

### Commands

| Command | Effect |
|---------|--------|
| `/kanban` or `/kanban status` | Board summary with task counts |
| `/kanban create <title>` | Quick-create a task |
| `/kanban list [status]` | List tasks (filter by status) |

### Tools (Agent-Callable)

| Tool | Description |
|------|-------------|
| `kanban_create` | Create a new task |
| `kanban_list` | List tasks, optionally filtered |
| `kanban_show` | Show full task details + comments |
| `kanban_complete` | Mark task done (auto-unblocks children) |
| `kanban_block` | Block a task with a reason |
| `kanban_comment` | Add a comment to a task |

### Example: Engineering Pipeline

```
Agent calls: kanban_create(title="Decompose epic X", priority="high")
  → TK-0001 created (todo)

Agent calls: kanban_create(title="Implement API endpoint", parents=["TK-0001"], assignee="backend-agent", priority="high")
  → TK-0002 created (todo, depends on TK-0001)

Agent calls: kanban_complete(id="TK-0001")
  → TK-0002 auto-promoted to "ready"
```

---

## 17. Complete Walkthrough: Auth Module

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

### Step 2: Run Local Preflight

```bash
bash .pi/scripts/ci/run_preflight.sh
```

Fix any issues before proceeding.

### Step 3: Discover Next Slice

```
/architect next-epic

Next epic: auth-system (4 components planned)
Components: JWT Token Validation, OAuth2 Provider Integration, Session Management, Architecture Observability
```

### Step 4: Start the Epic

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

### Step 5: Validate Epic Draft

Guardian automatically runs:
- `validate-architecture.sh` — Checks ADR compliance, module boundaries
- `validate-security.sh` — Checks threat model, auth patterns
- `validate-operations.sh` — Checks observability, tracing

If any fail, Guardian halts and shows the failures. Fix them, then continue.

### Step 6: Publish to GitHub/GitLab

```bash
# Guardian auto-creates tracking issue if gh/glab is configured
TRACKING_ID=100  # Created automatically
```

### Step 7: Run the Pipeline

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

### Step 8: Close Epic

```bash
bash .pi/scripts/git/close-epic.sh \
  --epic-id 101 \
  --tracking-id 100 \
  --comment "Auth Module v1 complete. 5/5 issues done. 0 retries."
```

### Step 9: Next Epic

```
/architect next-epic

Next epic: api-gateway (3 components planned)

/architect --epic "API Gateway v1"
# ... same process repeats
```

---

## 18. Configuration Reference

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

# System prompt tier: "full" or "lite"
system_prompt_tier: full

# Generation settings
generate:
  on_conflict: warn       # overwrite | warn | skip
  atomic_writes: true

# Validation settings
validate:
  fail_fast: false
  timeout_ms: 300000

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
| `COVERAGE_THRESHOLD` | Minimum coverage % (default: 80) |
| `SONAR_TOKEN` | SonarQube authentication |
| `SONAR_HOST_URL` | SonarQube host URL |

---

## 19. Troubleshooting

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

Fix the issue, then `/pipeline retry-step`.

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

### "Preflight failed"

```bash
# Run verbose to see which check failed
bash .pi/scripts/ci/run_preflight.sh --verbose

# Run a specific stage
bash .pi/scripts/ci/run_stage.sh lint
```

### "Service not available"

```bash
# Start PostgreSQL
docker run -d --name postgres -e POSTGRES_PASSWORD=test -p 5432:5432 postgres:16

# Start Redis
docker run -d --name redis -p 6379:6379 redis:7

# Check Docker
docker info
```

---

## 20. See Also

- [guardian-domain-usage.md](guardian-domain-usage.md) — Domain exploration (`/domain`)
- [guardian-architect-usage.md](guardian-architect-usage.md) — Architecture orchestration (`/architect`)
- [guardian-framework-design.md](guardian-framework-design.md) — Design specification
- [architecture.md](architecture.md) — Architecture document
- [hermes-features-usage.md](hermes-features-usage.md) — Hermes-adopted features reference
- [pipeline-usage.md](pipeline-usage.md) — Pipeline engine reference
