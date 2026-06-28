# Guardian — User Manual

How to use every Guardian feature.

---

## Table of Contents

1. [CLI Commands](#1-cli-commands)
2. [Interactive Commands (Inside Pi)](#2-interactive-commands-inside-pi)
3. [Available Tools (Agent Tools)](#3-available-tools-agent-tools)
4. [Local Dev Workflow](#4-local-dev-workflow)
5. [Custom Validators & Filters](#5-custom-validators--filters)
6. [Smart Updates](#6-smart-updates)

---

## 1. CLI Commands

Run from your terminal. All commands accept `-d, --dir <path>` to target a different directory.

### `guardian init`

Scaffold `.pi/` directory structure and generate exports.

```bash
guardian init
```

Interactive prompts for project name, version, language, tools, validators, workflows.

Non-interactive mode:

```bash
guardian init \
  --projectName my-app \
  --version 0.1.0 \
  --language typescript \
  --tool pi,claude \
  --validators ci,tests \
  --nonInteractive
```

| Flag | Description |
|------|-------------|
| `-t, --tool` | AI tools: pi, claude, opencode, agents, github |
| `-l, --lang` | Language: typescript, rust, python, go, java |
| `--buildTool` | Build tool: maven, gradle (Java only) |
| `--groupId` | Package prefix (default: `com.<projectName>`) |
| `--nonInteractive` | Skip prompts (requires all flags) |
| `--force` | Overwrite existing framework |

### `guardian project create`

Scaffold source code from architecture modules.

```bash
guardian project create --lang java --buildTool maven --groupId com.mycompany

guardian project create --lang typescript --validators ci,tests,security --dryRun
```

| Flag | Description |
|------|-------------|
| `-l, --lang` | Language (required): java, typescript |
| `--buildTool` | Build tool: maven, gradle |
| `--groupId` | Package prefix |
| `--validators` | Comma-separated validator categories |
| `--dryRun` | Preview without writing files |
| `--force` | Override existing project guard |

### `guardian domain`

DDD domain exploration. Two subcommands:

```bash
# Explore a business domain
guardian domain --explore "Payment processing system"

# Save results from an exploration session
guardian domain --save-result <session-id> <json>
```

Output saved to `.pi/domain/` (exploration.md, ubiquitous-language.md).

### `guardian generate`

Regenerate exports from `.pi/` source.

```bash
guardian generate                          # All configured tools
guardian generate --tool claude            # Single tool
guardian generate --dryRun                 # Preview
guardian generate --force                  # Overwrite modified exports
```

### `guardian update`

Smart merge of new template versions, preserving user edits.

```bash
guardian update --dryRun   # Preview changes
guardian update            # Apply
guardian update --force    # Overwrite user-editable files (dangerous)
guardian update --regenerate  # Also regenerate exports
```

### `guardian upgrade`

Migrate to new major version. Use `guardian update --dryRun` first to review.

### `guardian validate`

Run TOML-based validators on current state.

```bash
guardian validate                  # All validators
guardian validate --filter tests   # Only tests validator
guardian validate --verify         # Run inline tests
guardian validate --verbose        # Detailed output
```

### `guardian verify`

File integrity verification — checks hashes against manifest.

### `guardian trust`

Manage trusted TOML configs. TOML filters in `.pi/validators/` require explicit trust.

### `guardian stats`

Token analytics with USD estimation.

```bash
guardian stats               # Last 30 days
guardian stats --days 7      # Custom time window
guardian stats --history     # Recent command history
guardian stats --clear       # Clear tracking history
```

### `guardian info`

Display manifest information, file list, token stats, export records.

### `guardian uninstall`

Remove Guardian-managed files.

```bash
guardian uninstall --dryRun   # Preview what would be removed
guardian uninstall --force    # Execute removal
```

---

## 2. Interactive Commands (Inside Pi)

These commands are available as slash commands inside a pi session.

### `/architect`

Orchestrate the full architecture-to-implementation pipeline.

```bash
/architect --epic "Add payment processing"             # Start an epic
/architect --epic "Auth system" --tracking-issue 42    # With remote tracking issue
/architect status                                      # Show current epic progress
/architect next-epic                                   # Find next logical slice
/architect abort                                       # Cancel current epic
```

When an epic starts, it:
1. Discovers architecture modules in `.pi/architecture/modules/`
2. Creates issues: contract freeze → implementation slices → proofing → architecture readiness
3. Creates a pipeline with 4 steps per issue: implement → validate → create-mr → merge
4. Optionally creates remote issues (GitHub/GitLab) if authenticated

### `/pipeline`

Manage multi-step pipeline workflows.

```bash
/pipeline "Sprint-47 cleanup" --items "TK-0101,TK-0102" --steps "implement,validate,create-mr"
/pipeline "Sprint-47 cleanup" --items "TK-0101,TK-0102" --steps "implement,validate" --merge-on-valid
/pipeline status       # Current pipeline state
/pipeline pause        # Pause pipeline
/pipeline resume       # Resume pipeline
/pipeline abort        # Abort pipeline
/pipeline skip-step    # Skip current step
/pipeline retry-step   # Retry current step
```

#### Pipeline Tools (Agent Use)

These are tools the agent calls, not slash commands:

| Tool | Purpose |
|------|---------|
| `pipeline_status` | Show overall progress, current item+step |
| `pipeline_advance` | Mark current step passed, move to next |
| `pipeline_fail` | Mark step failed with reason |
| `pipeline_start` | Start a new pipeline programmatically |
| `pipeline_next_task` | Get full context for current item+step |
| `pipeline_run_acceptance` | Run per-step acceptance validators |

### `/goal`

Set a persistent objective that auto-iterates across turns.

```bash
/goal "Fix all TypeScript strict mode errors in src/"          # Set a goal
/goal "Fix tests" --validators=ci,tests,security               # With specific validators
/goal status                                                    # Show progress
/goal pause                                                     # Pause goal
/goal resume                                                    # Resume goal
/goal clear                                                     # Clear goal
/goal validators                                                # List active validators
/goal validators all                                            # Enable all validators
```

#### Subgoal Management

```bash
/subgoal "Fix strict null checks"                               # Add subgoal
/subgoal list                                                   # List subgoals
/subgoal remove 1                                               # Remove subgoal by number
/subgoal clear                                                  # Clear all subgoals
```

#### Goal Tool (Agent Use)

| Tool | Purpose |
|------|---------|
| `guardian_goal_evaluate` | Evaluate goal progress (dual validator + LLM judge) |

### `/kanban`

Manage a JSON-backed task board.

```bash
/kanban status                        # Summary counts by status
/kanban create "Add login page"       # Create a new task
/kanban list                          # List all tasks
/kanban list triage                   # List tasks by status
```

#### Kanban Tools (Agent Use)

| Tool | Purpose |
|------|---------|
| `kanban_create` | Create a task with title |
| `kanban_list` | List tasks, optionally filtered by status |
| `kanban_show` | Show full task details (id, status, comments) |
| `kanban_complete` | Mark a task as done |
| `kanban_block` | Block a task with a reason |
| `kanban_comment` | Add a comment to a task |

### `/domain`

Domain-driven exploration inside a pi session.

```bash
/domain --explore "Business domain description"               # Explore a domain
/domain --architect-scaffold <session-id>                     # Generate module docs from exploration
/domain --validate <session-id>                               # Validate exploration against domain files
```

#### Domain Tools (Agent Use)

| Tool | Purpose |
|------|---------|
| `domain_explore` | Create a DDD exploration prompt file |
| `domain_save_result` | Save domain analysis JSON as structured session |
| `domain_validate` | Validate session against canonical glossary |

### `/project`

Scaffold a project from within a pi session.

```bash
/project create --lang java --buildTool maven --groupId com.mycompany
/project create --lang typescript --validators ci,tests,security --dryRun
/project status                                                    # Check scaffold status
```

Subcommand flags match the CLI `guardian project create` flags.

### `/curator`

Manage skill lifecycle — detects stale/unused skills.

```bash
/curator status                  # Show curator report
/curator review                  # Review and archive stale skills
/curator review --dry-run        # Preview without archiving
/curator pin "skill-name"        # Protect a skill from archival
/curator unpin "skill-name"      # Allow archival
```

#### Curator Tools (Agent Use)

| Tool | Purpose |
|------|---------|
| `curator_review` | Detect stale/unused skills, recommend archival |
| `curator_pin` | Pin a skill to protect from archival |
| `curator_unpin` | Unpin a skill to allow archival |

### `/validate`

Run validators from inside a pi session.

```bash
/validate                              # Run all validators
```

### `/goal`, `/pipeline`, `/kanban` (Above)

These have both slash commands and agent tools. See each section.

### Other Slash Commands

| Command | Purpose |
|---------|---------|
| `/plan` | Enter plan mode — queue edits for batch review |
| `/plan-apply` | Apply queued plan edits |
| `/snippet list\|add\|remove\|edit` | Manage token-expansion snippets (`#handle`) |
| `/sessions` | Session history management |
| `/hooks` | List registered lifecycle hooks |
| `/redact` | Trigger manual redaction of secrets from output |
| `/reload-config` | Hot-reload `.pi/agent/AGENTS.md` config without restart |

---

## 3. Available Tools (Agent Tools)

These are tools the agent can call during a session. They are not slash commands — the agent uses them automatically when needed.

### Governance

| Tool | Description |
|------|-------------|
| `guardian_scope` | Classify current change scope (Simple/Moderate/Complex/Critical) |
| `guardian_validate` | Run validation scripts for specific categories |
| `guardian_coordinate` | Orchestrate workflow with scope classification + validation |

### Architect

| Tool | Description |
|------|-------------|
| `architect_status` | Show current epic status and progress |
| `architect_discover` | Discover architecture modules and find next logical slice |

### Pipeline

| Tool | Description |
|------|-------------|
| `pipeline_status` | Show overall pipeline progress |
| `pipeline_advance` | Mark current step as passed, advance |
| `pipeline_fail` | Mark current step as failed, advance |
| `pipeline_start` | Start a new pipeline programmatically |
| `pipeline_next_task` | Get full context for current item+step |
| `pipeline_run_acceptance` | Run acceptance gates for current step |

### Kanban

| Tool | Description |
|------|-------------|
| `kanban_create` | Create a new task |
| `kanban_list` | List tasks, optionally by status |
| `kanban_show` | Show full task details |
| `kanban_complete` | Mark task as done |
| `kanban_block` | Block a task with reason |
| `kanban_comment` | Add comment to a task |

### Domain

| Tool | Description |
|------|-------------|
| `domain_explore` | Create DDD exploration prompt |
| `domain_save_result` | Save exploration results |
| `domain_validate` | Validate against canonical glossary |

### Curator

| Tool | Description |
|------|-------------|
| `curator_review` | Detect stale/unused skills |
| `curator_pin` | Protect a skill from archival |
| `curator_unpin` | Allow archival |

### Other Tools

| Tool | Description |
|------|-------------|
| `ask_user_question` | Ask the user a structured question (multi-select, free text) |
| `guardian_goal_evaluate` | Evaluate goal progress (dual validator + LLM judge) |

---

## 4. Local Dev Workflow

Run validation locally before pushing.

### Preflight

```bash
bash .pi/scripts/ci/run_preflight.sh
```

Runs the local subset of CI checks.

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

### Validate Canonical References

```bash
bash .pi/scripts/validate-canonical.sh
```

---

## 5. Custom Validators & Filters

### Built-in Validator Categories

| Validator | What It Checks |
|-----------|---------------|
| `ci` | CI pipeline configuration, script health |
| `tests` | Test structure, coverage flags |
| `operations` | Observability, logging, error handling |
| `security` | Injection, auth bypass, secret leakage |
| `integration` | Component wiring, interface contracts |
| `architecture` | Module boundaries, dependency direction |
| `canonical` | Architecture reference headers in code |

### Scope Auto-Selection

| Scope | Conditions | Validators |
|-------|-----------|------------|
| **Simple** | 1-2 files | ci, tests |
| **Moderate** | 3-10 files | ci, tests, operations |
| **Complex** | Multi-module | ci, tests, operations, security, integration, architecture |
| **Critical** | Breaking changes | All 7 |

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

Project-level filters are **trust-gated** — Guardian requires explicit SHA-256 trust before execution.

### Available Shell Validators

Scripts in `.pi/scripts/`:

| Script | Purpose |
|--------|---------|
| `validate-canonical.sh` | Check architecture reference headers |
| `validate-architecture.sh` | Architecture conformance |
| `validate-architecture-readiness.sh` | CI enforcement readiness |
| `validate-ubiquitous-language.sh` | Ubiquitous language consistency |
| `validate-security.sh` | Security scanning |
| `validate-integration.sh` | Integration checks |
| `validate-operations.sh` | O11y, error handling |
| `validate-tests.sh` | Test coverage |
| `validate-ci.sh` | CI health |

---

## 6. Smart Updates

### Dry Run First

```bash
guardian update --dryRun
# Preview: 3 files added, 2 merged, 1 preserved
```

### Apply Update

```bash
guardian update
```

The update algorithm:

| Condition | Action |
|-----------|--------|
| New in templates | Added automatically |
| File unchanged (hash matches) | Overwritten safely |
| User-modified + has YAML front-matter | Merged: user's config stays, new body applied |
| User-modified + no front-matter | Preserved (not overwritten) |
| Generated export file | Regenerated |
| Removed from templates | Noted as orphan, not deleted |

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Config error (missing manifest, invalid YAML) |
| 3 | Template error (missing template file) |
| 4 | Validation error (checks failed) |
| 5 | Hook error (before_run/after_create failed) |
