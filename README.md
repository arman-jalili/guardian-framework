<div align="center">
  <h1>Guardian</h1>
  <p><strong>Architecture-First SDLC Framework for AI-Assisted Development</strong></p>

  <a href="https://www.npmjs.com/package/guardian-framework"><img src="https://img.shields.io/npm/v/guardian-framework?style=flat&colorA=222&colorB=00bcd4" alt="npm version"/></a>
  <a href="https://github.com/arman-jalili/guardian-framework/actions"><img src="https://img.shields.io/github/actions/workflow/status/arman-jalili/guardian-framework/ci.yml?style=flat&colorA=222&colorB=00bcd4" alt="CI status"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/guardian-framework?style=flat&colorA=222&colorB=00bcd4" alt="license"/></a>
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/runtime-Bun-f472b6?style=flat&colorA=222" alt="Bun"/></a>

  <br/><br/>

  <p><b>From domain discovery → architecture → implementation → validation → merge.</b></p>
  <p>Traceable, validated, architecture-first. For developers who want AI to<br/>respect their architecture — not guess it.</p>
</div>

---

Guardian is a CLI tool and agent framework that orchestrates AI-assisted development with deterministic quality gates. It scaffolds projects, validates architecture conformance, and runs workflows with scope-based validation — all from a single `.pi/` source of truth.

```bash
npx guardian-framework init
```

---

## Quick Start

```bash
# 1. Scaffold the framework
npx guardian-framework init

# 2. Explore a business domain (DDD)
guardian domain --explore "Payment processing for e-commerce"

# 3. Scaffold a project from architecture
guardian project create --lang java --buildTool maven --groupId com.mycompany

# 4. Generate exports for AI tools
guardian generate

# 5. Smart update (preserves your edits)
guardian update --dryRun
```

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `guardian init` | Scaffold `.pi/` framework interactively |
| `guardian domain --explore` | DDD domain exploration |
| `guardian domain --save-result` | Save exploration session results |
| `guardian project create` | Generate source tree from architecture |
| `guardian generate` | Regenerate exports from `.pi/` |
| `guardian update` | Smart merge template updates, preserve edits |
| `guardian upgrade` | Major version migration |
| `guardian validate` | Run TOML-based validators |
| `guardian verify` | SHA-256 file integrity check |
| `guardian trust` | Manage trusted TOML configs |
| `guardian info` | Show manifest status |
| `guardian stats` | Token analytics |
| `guardian uninstall` | Remove Guardian-managed files |

---

## Inside Pi (Slash Commands)

These commands work inside a [pi](https://github.com/badlogic/pi-mono) coding agent session:

| Command | Description |
|---------|-------------|
| `/architect --epic "Name"` | Start epic from architecture modules |
| `/architect status` | Current epic progress |
| `/architect next-epic` | Find next logical slice |
| `/architect abort` | Cancel epic |
| `/domain --explore "..."` | Start domain exploration |
| `/domain --validate <id>` | Validate against domain files |
| `/domain --architect-scaffold <id>` | Generate module docs from exploration |
| `/project create --lang java ...` | Scaffold project |
| `/project status` | Check scaffold status |
| `/pipeline "Name" --items "A,B" --steps "x,y"` | Start multi-step pipeline |
| `/pipeline status\|pause\|resume\|abort` | Manage pipeline |
| `/goal "objective" --validators=ci,tests` | Set persistent goal |
| `/goal status\|pause\|resume\|clear` | Manage goal |
| `/subgoal "..."\|list\|remove\|clear` | Manage subgoals |
| `/kanban create\|list\|status` | Task board |
| `/curator review\|pin\|unpin` | Skill lifecycle |
| `/snippet list\|add\|remove\|edit` | Token expansion snippets |
| `/plan` / `/plan-apply` | Queue edits for batch review |
| `/validate` | Run validators |

---

## Agent Tools

These tools are callable by the agent during a session:

| Tool | Purpose |
|------|---------|
| `guardian_scope` | Classify change scope (Simple→Critical) |
| `guardian_validate` | Run validation scripts by category |
| `guardian_coordinate` | Orchestrate scope + validation workflow |
| `guardian_goal_evaluate` | Evaluate goal progress (validator + LLM judge) |
| `architect_status` | Show epic state |
| `architect_discover` | Find modules + next slice |
| `pipeline_status` | Pipeline progress |
| `pipeline_advance` | Mark step passed |
| `pipeline_fail` | Mark step failed |
| `pipeline_start` | Start pipeline programmatically |
| `pipeline_next_task` | Get current item+step context |
| `pipeline_run_acceptance` | Run step acceptance gates |
| `kanban_create` | Create task |
| `kanban_list` | List tasks |
| `kanban_show` | Show task details |
| `kanban_complete` | Mark done |
| `kanban_block` | Block with reason |
| `kanban_comment` | Add comment |
| `domain_explore` | Create exploration prompt |
| `domain_save_result` | Save analysis session |
| `domain_validate` | Validate against glossary |
| `curator_review` | Detect stale skills |
| `curator_pin` | Protect from archival |
| `curator_unpin` | Allow archival |
| `ask_user_question` | Ask user structured questions |

---

## Workflow Prompts

Guardian ships 22 workflow prompt templates in `.pi/prompts/`. Each is a complete flow the agent follows when you give it a task:

| Workflow | File | When to Use |
|----------|------|-------------|
| Feature Development | `feature-development.md` | New features (Moderate+ scope) |
| Bug Fix | `bug-fix.md` | Bug fixes (Simple/Moderate) |
| Emergency Hotfix | `hotfix.md` | Production issues (skip planning) |
| Refactoring | `refactoring.md` | Code improvement (behavior unchanged) |
| Epic Plan | `epic-plan.md` | Plan work across modules |
| Issue Implementation Series | `issue-implementation-series.md` | Batch implementation via pipeline |
| Issue Closeout | `issue-closeout.md` | Verify AC + create compliance MR |
| Issue Merge | `issue-merge.md` | Merge MR + close issue |
| Issue Draft | `issue-draft.md` | Create draft issues from epic |
| Blueprint Validate | `blueprint-validate.md` | Validate `.pi/` structure |
| Blueprint Update | `blueprint-update.md` | Reverse-sync code to blueprint |
| Context Refresh | `context-refresh.md` | Update context from codebase |
| Sync Check | `sync-check.md` | Verify exports match source |
| Scope Analyzer | `scope-analyzer.md` | Auto-classify change scope |
| Pattern Extract | `pattern-extract.md` | Extract patterns to context |
| Plan to Issues | `plan-to-issues.md` | Convert plans to GitHub issues |

---

## Validators

7 categories, auto-selected by scope:

| Category | What It Checks |
|-----------|---------------|
| CI | Build, test, lint, format |
| Tests | Unit, integration, coverage |
| Security | Secrets, injection, auth bypass |
| Operations | Tracing, cancellation, error handling |
| Architecture | Module boundaries, ADR compliance |
| Integration | Component wiring, interfaces |
| Canonical | Reference headers in code |

---

## Extensions

19 TypeScript extensions for pi (`.pi/extensions/`):

| Extension | Purpose |
|-----------|---------|
| `architect.ts` | Epic orchestration |
| `pipeline.ts` | Multi-step workflow engine |
| `goal-loop.ts` | Standing goals with dual validation |
| `kanban.ts` | Durable task board |
| `domain-explorer.ts` | DDD exploration |
| `project-scaffolder.ts` | Project scaffolding |
| `coordinator.ts` | Scope + validation orchestration |
| `curator.ts` | Skill lifecycle management |
| `bash-guard.ts` | Destructive command blocking |
| `filechanges.ts` | File change tracking |
| `plan-mode.ts` | Queued edits for batch review |
| `snippets.ts` | `#handle` token expansion |
| `session-persistence.ts` | Session history |
| `redaction.ts` | Secret auto-redaction |
| `hooks.ts` | Shell lifecycle hooks |
| `config-reload.ts` | Hot config reload |
| `read-only-mode.ts` | Safe exploration mode |
| `slash-commands.ts` | Init/validate/scope commands |
| `validation-runner.ts` | Validator execution |

---

## Support

- **Full manual:** [docs/USER_MANUAL.md](docs/USER_MANUAL.md)
- **Architecture:** [.pi/architecture/architecture-overview.md](.pi/architecture/architecture-overview.md)
- **Issues:** [github.com/arman-jalili/guardian-framework/issues](https://github.com/arman-jalili/guardian-framework/issues)
- **Standalone agent:** [guardian-pi](https://github.com/arman-jalili/guardian-pi)

---

## Development

```bash
bun install
bun run build
bun test
bun run lint
```

---

## License

MIT
