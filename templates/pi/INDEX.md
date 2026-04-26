# GuardianCLI Agent Framework

**Version:** 1.2.0
**Status:** Template
**Architecture:** Pi-first

---

## Overview

This framework uses `.pi/` as the source of truth. Other formats (`.claude/`, `.opencode/`, `.agents/`) are generated exports.

---

## Canonical Reference Requirement

**All implementation files must include a canonical reference header pointing to blueprint:**

```typescript
/**
 * Canonical Reference: .pi/context/patterns.md#section-name
 * Blueprint Alignment: [pattern-name]
 * Implements: [feature/spec reference]
 */
```

**Generated files must include source reference:**

```markdown
<!--
Canonical Reference: .pi/[source-path].md
Generated: [timestamp]
DO NOT EDIT DIRECTLY - Modify source in .pi/
-->
```

**Validation:** `validate-canonical.sh` checks reference integrity in all phases.

---

## Directory Structure

```
.pi/
├── agent/
│   └── AGENTS.md              # Project instructions (template with placeholders)
│
├── context/
│   ├── project.md             # Project facts, commands (template)
│   ├── patterns.md            # Code templates (template)
│   ├── checklists.md          # Validation checklists
│   └── output-formats.md      # Report templates
│
├── skills/
│   ├── agents/
│   │   ├── architecture-coordinator.md
│   │   ├── architecture-validator.md
│   │   ├── security-validator.md
│   │   ├── operations-validator.md
│   │   ├── test-validator.md
│   │   ├── integration-validator.md
│   │   ├── ci-mr-validator.md
│   │   ├── code-developer.md
│   │   ├── documentation-maintainer.md
│   │   └── issue-creator.md
│   └── validators/
│       ├── architecture-validator.md
│       ├── security-validator.md
│       ├── operations-validator.md
│       ├── integration-validator.md
│       ├── test-validator.md
│       └── ci-validator.md
│
├── prompts/
│   ├── feature-development.md
│   ├── bug-fix.md
│   ├── hotfix.md
│   ├── refactoring.md
│   ├── issue-implementation-series.md
│   ├── epic-plan.md           # Architecture analysis + epic slicing
│   ├── issue-draft.md         # Create draft issues from epic
│   ├── git-issues.md          # Create epics/issues in GitHub/GitLab
│   ├── issue-closeout.md      # Validate + create compliance MR
│   ├── issue-merge.md         # Merge MR + close issue + update tracking
│   ├── blueprint-validate.md  # Validate blueprint integrity
│   ├── sync-check.md          # Check exports in sync with blueprint
│   ├── context-refresh.md     # Update context from codebase state
│   ├── scope-analyzer.md      # Auto-determine scope classification
│   ├── pattern-extract.md     # Extract patterns to blueprint
│   └── blueprint-update.md    # Reverse-sync implementation to blueprint
│
├── scripts/
│   ├── validate-ci.sh
│   ├── validate-tests.sh
│   ├── validate-operations.sh
│   ├── validate-security.sh
│   ├── validate-architecture.sh
│   ├── validate-canonical.sh  # Canonical reference integrity
│   ├── validation-cache.sh
│   ├── fetch-issues.sh
│   ├── categorize-issues.sh
│   ├── create-feature-branch.sh
│   ├── create-mr.sh
│   ├── mr-validation.sh
│   └── merge-mr.sh
│
├── extensions/
│   ├── validation-runner.ts   # Pi extension for validation
│   └── coordinator.ts         # Pi extension for orchestration
│
├── INDEX.md                   # This file
└── README.md                  # Complete documentation
```

---

## Repository Tool

The framework supports both GitHub and GitLab:

| Tool | CLI | Platform |
|------|-----|----------|
| `gh` | GitHub CLI | GitHub.com |
| `glab` | GitLab CLI | GitLab.com or self-hosted |

Selected during `guardian init` and used in all git-related workflows.

---

## Agent Directory

| Agent | Role | When to Use | Mode |
|-------|------|-------------|------|
| `architecture-coordinator` | Master orchestrator | All tasks | primary |
| `architecture-validator` | Architecture check | Moderate+ scope | subagent |
| `security-validator` | Security check | Complex+ scope | subagent |
| `operations-validator` | Operations check | Plan review | subagent |
| `test-validator` | Test validation | Post-code | subagent |
| `integration-validator` | Integration check | Complex+ scope | subagent |
| `ci-validator` | CI/merge | All PRs (automated) | subagent |
| `code-developer` | Implementation | All code tasks | subagent |
| `issue-creator` | Issue tracking | All tasks | subagent |
| `documentation-maintainer` | Doc sync | API changes | subagent |

---

## Scope Classification

| Scope | Files | Lines | Required Validators |
|-------|-------|-------|---------------------|
| Simple | 1 | < 50 | ci + canonical (automated) |
| Moderate | 2-5 | 50-200 | ci + architecture + canonical |
| Complex | 5-15 | 200-500 | ci + architecture + security + canonical |
| Critical | 15+ or core | 500+ | All validators + canonical + human approval |

---

## Automated Scripts

| Script | Checks |
|--------|--------|
| `validate-ci.sh` | Build, test, lint, format, audit |
| `validate-tests.sh` | Unit, integration, coverage |
| `validate-operations.sh` | Tracing, cancellation, atomic writes |
| `validate-security.sh` | Secrets, injection, path traversal |
| `validate-architecture.sh` | Architecture patterns, dependencies |
| `validate-canonical.sh` | Canonical reference integrity, coverage |
| `validation-cache.sh` | Retry optimization |

---

## Workflows

### Standard Workflows

| Workflow | File | Use When |
|----------|------|----------|
| Feature Development | `prompts/feature-development.md` | New features |
| Bug Fix | `prompts/bug-fix.md` | Bug fixes |
| Emergency Hotfix | `prompts/hotfix.md` | Production issues |
| Refactoring | `prompts/refactoring.md` | Code improvement |
| Issue Implementation | `prompts/issue-implementation-series.md` | Batch implementation |

### Epic/Issue Management Workflows

| Workflow | File | Purpose |
|----------|------|---------|
| Epic Plan | `prompts/epic-plan.md` | Architecture analysis → epic slicing → validator review |
| Issue Draft | `prompts/issue-draft.md` | Create draft issues from approved epic |
| Git Issues | `prompts/git-issues.md` | Create epics/milestones + issues + tracking in GitHub/GitLab |
| Issue Closeout | `prompts/issue-closeout.md` | Verify acceptance criteria → validators → compliance MR |
| Issue Merge | `prompts/issue-merge.md` | Merge MR → close issue → update tracking → close epic if complete |

### Blueprint Management Workflows

| Workflow | File | Purpose |
|----------|------|---------|
| Blueprint Validate | `prompts/blueprint-validate.md` | Validate .pi/ structure and integrity |
| Sync Check | `prompts/sync-check.md` | Verify exports match blueprint source |
| Context Refresh | `prompts/context-refresh.md` | Update context from codebase reality |
| Scope Analyzer | `prompts/scope-analyzer.md` | Auto-determine change scope + validators |
| Pattern Extract | `prompts/pattern-extract.md` | Extract patterns to patterns.md |
| Blueprint Update | `prompts/blueprint-update.md` | Reverse-sync implementation changes |

### Workflow Sequence

```
Blueprint Setup (one-time):
/blueprint-validate → /sync-check → [ready for implementation]

Epic/Issue Sequence:
/epic-plan → /issue-draft → /git-issues → [implement] → /issue-closeout → /issue-merge
                                    ↑                                          ↓
                                    └────────────── next issue ────────────────┘

Maintenance:
/context-refresh → /pattern-extract → /blueprint-update → /sync-check → guardian generate
```

---

## Implementation Phase Requirements

**All implementation phases must:**

1. **Add canonical reference header** to new files:
```typescript
/**
 * Canonical Reference: .pi/context/patterns.md#[pattern-section]
 * Implements: [spec from issue/workflow]
 */
```

2. **Update existing headers** when modifying files to reflect blueprint alignment

3. **Reference specific sections** not just files: `.pi/context/patterns.md#safe-file-read`

---

## Validation Phase Requirements

**All validation phases must:**

1. **Run canonical validator**: `bash .pi/scripts/validate-canonical.sh`

2. **Check coverage**: Implementation files should have ≥50% canonical reference coverage

3. **Verify accuracy**: References must point to existing blueprint sections

4. **Report gaps**: Files without references should be flagged for update

---

## Key Principles

1. **Template-driven** - Workflows in templates, not dynamic generation
2. **DAG-based** - Task nodes with dependencies, topological execution
3. **Minimal LLM** - LLM = planning tool only
4. **Bounded autonomy** - Hard caps on dynamic behavior
5. **Bounded retries** - Max 3 retries with exponential backoff + jitter (±25%)
6. **Risk-gated** - Safe=auto, Medium=confirm, Dangerous=dry-run
7. **Pre-validated** - Validator catches errors BEFORE execution
8. **Auditable** - Planning decisions tracked and diffable
9. **Canonical-traced** - All code linked to blueprint documentation

---

## Generation Mappings

When running `guardian generate`, `.pi/` files are transformed:

| Source | Destination | Transformation |
|--------|-------------|----------------|
| `AGENTS.md` | `.claude/CLAUDE.md`, `.opencode/context.md` | Direct copy + canonical header |
| `skills/agents/*.md` | `.claude/agents/*.md` | Direct copy + canonical header |
| `skills/validators/*.md` | `.opencode/prompts/*.txt` | Convert to .txt, compress |
| `context/*.md` | `.claude/context/*.md`, `.opencode/context/*.md` | Direct copy + canonical header |
| `prompts/*.md` | `.opencode/workflows/*.md` | Nest under workflows/ |
| `scripts/*.sh` | `.claude/scripts/*.sh`, `.opencode/scripts/*.sh` | Direct copy |
| `extensions/*.ts` | `extensions/*.ts` (pi only) | No export |

---

## Language Patterns

Language-specific code patterns are stored in `templates/languages/`:
- `rust-patterns.md`
- `typescript-patterns.md`
- `python-patterns.md`
- `go-patterns.md`

Selected during `guardian init` based on project language.