# Pipeline Engine — Complete Usage Guide

> **Guardian-native feature.** The pipeline engine is original to Guardian — designed to solve the problem of
> repeating structured workflows across multiple items with validation gates between each step.

---

## Overview

The pipeline engine lets you define a **repeatable multi-step workflow** that iterates over a list of items. Each step can have its own prompt template, acceptance conditions (validators, shell commands, LLM evaluation), and automatic progression rules.

### When to use `/pipeline` vs `/goal`

| | `/goal` | `/pipeline` |
|---|---------|-------------|
| **Shape** | Single objective, auto-iterate until done | Step-by-step state machine across multiple items |
| **Acceptance** | One global condition (validators + LLM) | Per-step acceptance gates |
| **Best for** | "Fix auth module" (one task) | "Close all 15 P1 bugs" (repeatable process) |
| **Analogy** | A persistent to-do item | A CI/CD pipeline for issues |

### Pipeline vs `delegate_task`

| | `delegate_task` | Pipeline |
|---|----------------|----------|
| **Execution** | RPC-style, blocks parent until done | State machine, tracks progress across steps |
| **Resumption** | None — if interrupted, work is lost | Pauses and resumes from exact step |
| **Human input** | Not supported | Can pause for human review between steps |
| **Audit** | Summary only, no per-step history | Full step-by-step result log |
| **Multi-agent** | One child = one answer | Multiple steps, different prompts per step |

---

## Quick Start

### Basic Pipeline

```
/pipeline "Fix P1 bugs" --items "1234,1235,1236" --steps "implement,validate,create-mr"
```

This creates a pipeline that will:
1. For issue 1234: implement → validate → create-mr
2. For issue 1235: implement → validate → create-mr
3. For issue 1236: implement → validate → create-mr

### With Auto-Merge

```
/pipeline "Fix P1 bugs" --items "1234,1235,1236" --steps "implement,validate,create-mr,merge" --merge-on-valid
```

The `--merge-on-valid` flag tells the agent to automatically merge merge requests if all validators pass.

---

## Commands

| Command | Effect |
|---------|--------|
| `/pipeline <name> --items "id1,id2" --steps "implement,validate"` | Start a new pipeline |
| `/pipeline` or `/pipeline status` | Show current progress |
| `/pipeline pause` | Pause at the current step |
| `/pipeline resume` | Resume from where you paused |
| `/pipeline skip-step` | Skip the current step, move to the next |
| `/pipeline retry-step` | Retry the current step (increments retry counter) |
| `/pipeline abort` | Kill the pipeline entirely |

---

## Built-in Steps

| Step | Prompt Loaded | Acceptance Gate | Description |
|------|--------------|-----------------|-------------|
| `implement` | `.pi/prompts/issue-implementation-series.md` | CI validator passes | Implement the fix for the current item |
| `validate` | — | CI + tests + security all pass | Run full validation suite |
| `create-mr` | `.pi/prompts/issue-closeout.md` | None (always passes) | Create merge request / PR |
| `merge` | — | CI + canonical pass | Merge the MR if validators pass |
| `document` | `.pi/prompts/blueprint-update.md` | Canonical validator passes | Update architecture docs |
| `test` | — | Tests validator passes | Write and run tests |
| `security-review` | — | Security validator passes | Security audit of the implementation |

### Step Behavior

Each step works independently:

1. **Prompt loading:** If the step has a prompt file, it's loaded into context
2. **Agent works:** The agent performs the step's task
3. **Acceptance gate:** The gate is evaluated
   - **Pass:** Pipeline advances to next step
   - **Fail:** Item is marked failed, remaining steps for this item are skipped, moves to next item

---

## Custom Steps

Any step name not in the built-in list works as a **free-form step** with no prompt and no acceptance gate:

```
/pipeline "Code cleanup" --items "auth,api,ui" --steps "implement,lint-check,document"
```

Here `lint-check` is a custom step. The agent will work on it freely without any validation gate.

---

## Full Example: Close All P1 Bugs

```
You: /pipeline "Close P1 bugs" --items "1234,1235,1236" --steps "implement,validate,create-mr,merge" --merge-on-valid

▶ Pipeline "Close P1 bugs" started (PL-0001)
Items: 1234, 1235, 1236
Steps: implement → validate → create-mr → merge
Merge on valid: enabled

---

Agent works on item 1234...

[1/12] Item 1234 → Step: implement
  Agent: [loads issue-implementation-series.md, reads the issue, implements fix]
  [CI validator runs] → PASS
  ✓ Step passed, advancing

[2/12] Item 1234 → Step: validate
  Agent: [runs ci, tests, security validators]
  [Validators run] → ALL PASS
  ✓ Step passed, advancing

[3/12] Item 1234 → Step: create-mr
  Agent: [loads issue-closeout.md, creates merge request]
  [No gate — always passes]
  ✓ Step passed, advancing

[4/12] Item 1234 → Step: merge
  Agent: [validates MR, merges if all checks pass]
  [CI + canonical validators] → PASS
  ✓ Merged! Item 1234 complete. Advancing to next item.

---

[5/12] Item 1235 → Step: implement
  Agent: [implements fix]
  [CI validator runs] → PASS
  ✓ Step passed, advancing

[6/12] Item 1235 → Step: validate
  Agent: [runs validators]
  [Tests validator] → FAIL (test_user_auth failing)
  ✗ Step failed. Skipping remaining steps for 1235, moving to 1236.

You: /pipeline retry-step
  Agent: [retries the validate step for 1235]
  [Fixes the test, re-runs validators]
  ✓ All pass! Continuing...

---

[Final status]
/pipeline status

## Pipeline: Close P1 bugs
**Status:** done
**Progress:** 3/3 items, 100%

### Results
  ✓ 1234 — done
  ✓ 1235 — done (1 retry on validate step)
  ✓ 1236 — done
```

---

## Acceptance Gates

Each step can have one of four gate types:

### 1. Validator Gate

Runs specified Guardian validator scripts. All must pass (exit 0).

```
implement → { type: "validator", validators: ["ci"] }
validate  → { type: "validator", validators: ["ci", "tests", "security"] }
merge     → { type: "validator", validators: ["ci", "canonical"] }
```

**Available validators:** `ci`, `tests`, `security`, `canonical`, `operations`, `architecture`, `integration`, plus any custom `validate-*.sh` scripts in `.pi/scripts/`.

### 2. Shell Gate

Runs a custom shell command. Exit 0 = pass.

```json
{ "type": "shell", "command": "bash .pi/scripts/check-coverage.sh 80" }
```

### 3. LLM Gate

An LLM evaluates whether the step's work meets a specified criterion.

```json
{ "type": "llm", "prompt": "Verify the implementation covers all acceptance criteria in the issue" }
```

### 4. No Gate

Always passes. Used for steps that don't need validation.

```json
{ "type": "none" }
```

---

## Pipeline States

```
                    ┌─────────┐
   ┌───────────────▶│ running │◀──────────────┐
   │                └────┬────┘               │
   │                     │                    │
   │              ┌──────┴──────┐             │
   │              │   paused    │─────────────┘
   │              └──────┬──────┘  (resume)
   │                     │
   │              ┌──────┴──────┐
   └──────────────│    done     │
                  └─────────────┘

   Also: failed (step failure), aborted (user cancellation)
```

| State | Meaning | How to exit |
|-------|---------|-------------|
| `running` | Actively processing | Completes all items, or pause/abort |
| `paused` | User paused | `resume`, `skip-step`, `retry-step`, `abort` |
| `done` | All items processed | Terminal state |
| `failed` | A step failed without retry | Fix manually and resume |
| `aborted` | User killed pipeline | Terminal state |

---

## Tools (Agent-Callable)

| Tool | Description |
|------|-------------|
| `pipeline_status` | Returns the current pipeline status and progress |
| `pipeline_advance` | Mark current step as passed and advance to next |
| `pipeline_fail` | Mark current step as failed, skip remaining steps for this item |

---

## Best Practices

### 1. Start small, iterate

```
# Start with just implement + validate
/pipeline "Test pipeline" --items "1234" --steps "implement,validate"

# Once confident, add more steps and items
/pipeline "Full run" --items "1234,1235,1236" --steps "implement,validate,create-mr,merge"
```

### 2. Use custom steps for project-specific workflows

```
# Add project-specific validation
/pipeline "Feature rollout" --items "feat-a,feat-b" --steps "implement,validate,perf-check,document"
```

Here `perf-check` is a custom step with no gate — the agent handles it freely.

### 3. Pause for human review

```
/pipeline "Critical fixes" --items "100,101" --steps "implement,validate"

# After validate passes, pause before creating MR
/pipeline pause

# Review the changes manually, then resume to create MR
/pipeline resume
```

### 4. Use --merge-on-valid carefully

Only enable `--merge-on-valid` when you trust the validation suite to catch all issues:

```
# Safe: CI + tests + security all validated
/pipeline "Safe merges" --items "1,2,3" --steps "implement,validate,create-mr,merge" --merge-on-valid

# Risky: skipping validation
/pipeline "Quick merges" --items "1,2,3" --steps "implement,create-mr,merge" --merge-on-valid
```

---

## State Persistence

Pipeline state is stored in `.pi/.guardian-pipeline-state.json`. It survives:
- Session restarts
- pi restarts
- Machine reboots

If a pipeline is running when you restart pi, you can resume it with `/pipeline resume`.

---

## Troubleshooting

### "No active pipeline"
Start one with `/pipeline <name> --items "..." --steps "..."`.

### Pipeline stuck on a step
Use `/pipeline skip-step` to skip and move to the next step, or `/pipeline retry-step` to retry.

### Pipeline failed on one item
Failed items are skipped automatically. The pipeline continues with the next item. Review the failed item's results with `/pipeline status`.

### Pipeline aborted accidentally
Pipeline state is preserved. You can't resume an aborted pipeline, but you can start a new one with the same items.
