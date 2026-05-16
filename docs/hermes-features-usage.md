# Hermes-Adopted Features — Usage Guide

Four features ported from [Hermes-Agent](https://github.com/nousresearch/hermes-agent) into Guardian's pi-first architecture.

---

## 1. Standing Goals (`/goal`)

Set an objective that auto-iterates across turns until validators + semantic check confirm completion.

### Basic usage

```
/goal Fix every lint error in src/ and verify CI passes
```

The agent works toward the goal, and after each turn runs `validate-ci.sh` and `validate-canonical.sh`. If both pass and the agent's response confirms completion, the goal is marked done. If not, a continuation prompt is injected and the agent keeps going — up to the turn budget (default 20).

### Commands

| Command | Effect |
|---------|--------|
| `/goal <text>` | Set (or replace) the standing goal |
| `/goal` or `/goal status` | Show current goal, status, turns used |
| `/goal pause` | Pause the auto-continuation loop |
| `/goal resume` | Resume (resets turn counter to zero) |
| `/goal clear` | Drop the goal entirely |
| `/subgoal <text>` | Add a criterion to the active goal |
| `/subgoal list` | Show all subgoals |
| `/subgoal remove <N>` | Remove subgoal by 1-based index |
| `/subgoal clear` | Remove all subgoals |

### Example workflow

```
You: /goal Refactor auth module to use proper logging instead of print()

  ⊙ Goal set (20-turn budget): Refactor auth module...

Agent: [works on first file, commits]

  ↻ Continuing toward goal (1/20): CI passed but canonical refs need updating

Agent: [Continuing toward your standing goal]
  Updates canonical references, runs validate-canonical.sh

  ↻ Continuing toward goal (2/20): Validators passed but 3 more files remain

Agent: [Continuing toward your standing goal]
  [continues...]

  ✓ Goal achieved: All files refactored, all validators pass, canonical refs updated
```

### With subgoals

```
You: /goal Implement OAuth login flow
You: /subgoal Add unit tests for token validation
You: /subgoal Update architecture docs in .pi/architecture/modules/auth-system.md

  ⊙ Goal (active, 0/20 turns, 2 subgoals): Implement OAuth login flow
```

### Configuration (AGENTS.md front matter)

```yaml
goal:
  enabled: true
  max_turns: 20           # Continuation turns before auto-pause
  judge_validator: true   # Run CI + canonical validators as completion criteria
```

---

## 2. Kanban Task Board

A JSON-backed task board with state machine, dependency links, and comments. Use it for multi-session, multi-agent work that `delegate_task` can't handle (needs human input, crash resilience, or durable audit trail).

### Task states

```
triage → todo → ready → running → done → archived
                ↑         ↓         ↑
                └── blocked ────────┘
```

### Tools (agent callable)

| Tool | Parameters | Effect |
|------|-----------|--------|
| `kanban_create` | `title`, `body?`, `assignee?`, `priority?`, `parents?` | Create a new task |
| `kanban_list` | `status?` | List tasks, optionally filtered |
| `kanban_show` | `id` | Show full task details + comments |
| `kanban_complete` | `id` | Mark task done (auto-unblocks children) |
| `kanban_block` | `id`, `reason` | Block a task with a reason |
| `kanban_comment` | `id`, `text` | Add a comment to a task |

### CLI commands

| Command | Effect |
|---------|--------|
| `/kanban` or `/kanban status` | Board summary with task counts |
| `/kanban create <title>` | Quick-create a task |
| `/kanban list [status]` | List tasks (filter by status) |

### Example: engineering pipeline

```
Agent calls: kanban_create(title="Decompose epic X", priority="high")
  → TK-0001 created (todo)

Agent calls: kanban_create(title="Implement API endpoint", parents=["TK-0001"], assignee="backend-agent", priority="high")
  → TK-0002 created (todo, depends on TK-0001)

Agent calls: kanban_create(title="Build frontend component", parents=["TK-0001"], assignee="frontend-agent", priority="high")
  → TK-0003 created (todo, depends on TK-0001)

Agent calls: kanban_complete(id="TK-0001")
  → TK-0002 and TK-0003 auto-promoted to "ready"
```

### Priority levels

| Priority | Emoji | Use for |
|----------|-------|---------|
| `critical` | 🔴 | Blocking issues, security fixes |
| `high` | 🟠 | Current sprint, important features |
| `medium` | 🟡 | Normal features, improvements |
| `low` | 🟢 | Nice-to-have, tech debt |

### Configuration

```yaml
kanban:
  enabled: true
  auto_create_tasks: true  # Allow agent to create tasks automatically
```

---

## 3. Shell Hook System

Declarative shell scripts that fire on lifecycle events. Scripts receive a JSON payload on stdin and can respond via stdout to **block tool calls**, **inject context**, or **observe events**.

### Supported events

| Event | Fires when | Can block? | Can inject context? |
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

### Example: block destructive commands

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

### Example: auto-format after file writes

```bash
#!/usr/bin/env bash
# ~/.pi/hooks/auto-format.sh
payload="$(cat -)"
path=$(echo "$payload" | jq -r '.tool_input.file_path // empty')
[[ "$path" == *.ts ]] && command -v biome >/dev/null && biome check --write "$path" 2>/dev/null
printf '{}\n'
```

### Example: inject git status every turn

```bash
#!/usr/bin/env bash
# ~/.pi/hooks/inject-git-status.sh
cat - >/dev/null  # discard stdin
if status=$(git status --porcelain 2>/dev/null) && [[ -n "$status" ]]; then
  jq --null-input --arg s "$status" \
     '{context: ("Uncommitted changes:\n" + $s)}'
else
  printf '{}\n'
fi
```

### CLI commands

| Command | Effect |
|---------|--------|
| `/hooks` or `/hooks list` | Show all registered hooks |
| `/hooks test <event>` | Test hooks for a specific event |

---

## 4. Skill Curator

Background maintenance for agent-created skills. Tracks usage, detects stale/unused skills, and recommends archival.

### Lifecycle

```
active → stale (30 days unused) → archived (90 days unused)
```

Archived skills are moved to `.pi/skills/.archive/` and are always recoverable.

### Commands

| Command | Effect |
|---------|--------|
| `/curator` or `/curator status` | Show usage stats and review history |
| `/curator review` | Run review pass (archives stale skills) |
| `/curator review --dry-run` | Preview review without mutations |
| `/curator pin <skill>` | Protect a skill from archival |
| `/curator unpin <skill>` | Remove protection |
| `/curator restore <skill>` | Move archived skill back to active |

### Tools (agent callable)

| Tool | Effect |
|------|--------|
| `curator_review` | Run the curator review pass (`dryRun?`) |
| `curator_pin` | Pin a skill by name |
| `curator_unpin` | Unpin a skill by name |

### Configuration

```yaml
curator:
  enabled: true
  stale_after_days: 30    # Mark stale after N days unused
  archive_after_days: 90  # Archive after N days unused
  auto_review: true       # Auto-review on session start
```

### Best practices

1. Run `/curator review --dry-run` first to see what would happen
2. Pin skills you rely on: `/curator pin my-critical-skill`
3. Archived skills are always recoverable: `/curator restore my-archived-skill`

---

## 5. Delegation Roles (leaf vs orchestrator)

Subagents now have explicit roles that control whether they can spawn their own subagents.

### Roles

| Role | Can delegate? | Use case |
|------|--------------|----------|
| `leaf` (default) | No | Single-task investigations, code review, security audit |
| `orchestrator` | Yes (bounded by `max_spawn_depth`) | Multi-stage workflows: research → synthesis |

### Configuration

```yaml
delegation:
  max_spawn_depth: 1             # 1 = flat (leaf-only), 2 = orchestrator can spawn leaves
  max_concurrent_children: 3     # Parallel children per batch
  max_iterations: 50             # Max turns per child
  child_timeout_ms: 600000       # 10 min child timeout
```

### Cost warning

With `max_spawn_depth: 3` and `max_concurrent_children: 3`, the tree can reach 27 concurrent leaf agents. Raise `max_spawn_depth` intentionally.

---

## Quick reference: all new config keys

```yaml
# AGENTS.md front matter — add these sections

goal:
  enabled: true
  max_turns: 20
  judge_validator: true

kanban:
  enabled: true
  auto_create_tasks: true

hooks:
  pre_tool_call:
    - command: "script.sh"
      matcher: "bash"
      timeout: 5
  post_tool_call:
    - command: "format.sh"
      matcher: "write|edit"
  pre_llm_call:
    - command: "inject-context.sh"

curator:
  enabled: true
  stale_after_days: 30
  archive_after_days: 90
  auto_review: true

delegation:
  max_spawn_depth: 1
  max_concurrent_children: 3
  max_iterations: 50
  child_timeout_ms: 600000
```
