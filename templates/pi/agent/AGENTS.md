# Project Context

> **Purpose:** Single source of truth for project-specific knowledge. All agents load this ONCE, not scattered across individual agent files.
> **Generic:** Replace bracketed placeholders with your project's values.

## Project Overview

- **Name:** [Project Name]
- **Version:** [0.1.0]
- **Language:** [Rust / TypeScript / Python / etc.]
- **Type:** [CLI / Web App / Library / etc.]
- **Repository:** [owner/repo]

## Core Principles

> Keep to 5-8 bullet points. These are loaded into EVERY agent's context.

1. **[Principle 1]** - [One-line description]
2. **[Principle 2]** - [One-line description]
3. **[Principle 3]** - [One-line description]
4. **[Principle 4]** - [One-line description]
5. **[Principle 5]** - [One-line description]

## Architecture

### Structure

```
[project]/
├── src/              # Source code
├── tests/            # Test files
├── docs/             # Documentation
└── [other dirs]
```

### Key Patterns

> List the 3-5 patterns every agent must follow. No code examples here — those go in `patterns.md`.

- **[Pattern 1]:** [Description]
- **[Pattern 2]:** [Description]
- **[Pattern 3]:** [Description]

## Quality Gates

### Before Commit

```bash
[build command]
[format command]
```

### Before Push

```bash
[test command]
[lint command]
```

### Before Merge

```bash
[full test suite]
[lint check]
[security audit]
```

## Scope Classification

| Scope | Files | Lines | Required Validators |
|-------|-------|-------|---------------------|
| Simple | 1 | < 50 | ci-mr-validator |
| Moderate | 2-5 | 50-200 | architecture-validator, ci-mr-validator |
| Complex | 5-15 | 200-500 | All validators |
| Critical | 15+ or core | 500+ | All validators + human approval |

## Key Files

> Files every agent should know about. Keep under 10.

| File | Purpose |
|------|---------|
| [docs/ARCHITECTURE.md] | [Complete specification] |
| [src/orchestrator.rs] | [Main coordinator] |
| [src/error.rs] | [Error types] |

## Commands

> Essential commands agents need to run.

| Command | Purpose |
|---------|---------|
| `[build]` | [Build project] |
| `[test]` | [Run tests] |
| `[lint]` | [Lint check] |
| `[audit]` | [Security audit] |
