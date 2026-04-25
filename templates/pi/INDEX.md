# GuardianCLI Agent Framework

**Version:** 1.0.0
**Status:** Template
**Architecture:** Pi-first

---

## Overview

This framework uses `.pi/` as the source of truth. Other formats (`.claude/`, `.opencode/`, `.agents/`) are generated exports.

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
│   └── issue-implementation-series.md
│
├── scripts/
│   ├── validate-ci.sh
│   ├── validate-tests.sh
│   ├── validate-operations.sh
│   ├── validate-security.sh
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
| Simple | 1 | < 50 | ci-mr (automated) |
| Moderate | 2-5 | 50-200 | architecture-validator |
| Complex | 5-15 | 200-500 | architecture + security |
| Critical | 15+ or core | 500+ | All validators + human approval |

---

## Automated Scripts

| Script | Checks |
|--------|--------|
| `validate-ci.sh` | Build, test, lint, format, audit |
| `validate-tests.sh` | Unit, integration, coverage |
| `validate-operations.sh` | Tracing, cancellation, atomic writes |
| `validate-security.sh` | Secrets, injection, path traversal |
| `validation-cache.sh` | Retry optimization |

---

## Workflows

| Workflow | File | Use When |
|----------|------|----------|
| Feature Development | `prompts/feature-development.md` | New features |
| Bug Fix | `prompts/bug-fix.md` | Bug fixes |
| Emergency Hotfix | `prompts/hotfix.md` | Production issues |
| Refactoring | `prompts/refactoring.md` | Code improvement |
| Issue Implementation | `prompts/issue-implementation-series.md` | Batch GitHub issues |

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

---

## Generation Mappings

When running `guardian generate`, `.pi/` files are transformed:

| Source | Destination | Transformation |
|--------|-------------|----------------|
| `AGENTS.md` | `.claude/CLAUDE.md`, `.opencode/context.md` | Direct copy |
| `skills/agents/*.md` | `.claude/agents/*.md` | Direct copy |
| `skills/validators/*.md` | `.opencode/prompts/*.txt` | Convert to .txt, compress |
| `context/*.md` | `.claude/context/*.md`, `.opencode/context/*.md` | Direct copy |
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