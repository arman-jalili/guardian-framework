# Domain Exploration — DDD from Business Intent

Guardian's domain exploration layer helps you go from business language to enforceable architecture in one flow. Built in three slices, it gives you a glossary that catches naming drift, a CLI that extracts bounded contexts from plain English, and a pi extension that keeps everything accessible during development.

---

## Architecture

```
Business description
        │
        ▼
domain_explore (pi tool)  ─── writes ──▶ .pi/domain/exploration/<id>.prompt.md
        │                                              │
        │   (agent reads prompt, LLM responds)         │
        │                                              ▼
        │                                    <id>.response.json
        │                                              │
        ▼                                              ▼
guardian domain answer <id> response.json ─── writes ──▶ <id>.md (session)
        │                                              │
        │                                              ▼
guardian domain scaffold <id>        ─── writes ──▶ .pi/architecture/modules/<context>.md
        │
        ▼
domain_validate (pi tool)  ─── checks ──▶ glossary compliance + source drift
        │
        ▼
validate-ubiquitous-language.sh  ── runs on every commit ──▶ exit 1 on drift
```

---

## Files

| File | Purpose |
|------|---------|
| `.pi/domain/ubiquitous-language.md` | Canonical glossary — terms, definitions, alias blacklists, code examples |
| `.pi/domain/exploration/<id>.prompt.md` | DDD extraction prompt (AI-generated, agent-editable) |
| `.pi/domain/exploration/<id>.md` | Completed exploration session (bounded contexts, entities, events, language) |
| `.pi/domain/exploration/<id>.response.json` | Raw LLM response for reprocessing |
| `.pi/scripts/validate-ubiquitous-language.sh` | Drift detector — scans source identifiers against glossary |
| `.pi/validators/default.toml` | TOML filter entry for `--validators` discovery |
| `.pi/extensions/domain-explorer.ts` | Pi extension: `domain_explore` and `domain_validate` tools |
| `src/commands/domain.ts` | CLI handler for `guardian domain` subcommands |
| `src/lib/domain-explorer.ts` | Core library — prompt building, parsing, glossary merge, scaffolding |

---

## Workflow

### 1. Explore a domain

In pi, describe the business:

```
Use domain_explore with:
  context: "An online marketplace connecting buyers and sellers, with escrow payments, shipping logistics, dispute resolution, and seller ratings"
```

This writes a `.prompt.md` file to `.pi/domain/exploration/`. The agent reads it and responds with a structured JSON model.

Alternatively, use the CLI directly:

```bash
guardian domain explore --context "An online marketplace..."
```

### 2. Process the response

If you used the CLI (no LLM attached), save the LLM's JSON response and run:

```bash
guardian domain answer <session-id> response.json
```

This creates the exploration session, parses bounded contexts, entities, events, and merges new terms into the ubiquitous language glossary.

### 3. Scaffold architecture modules

Turn bounded contexts into module docs:

```bash
guardian domain scaffold <session-id>
```

Generates `.pi/architecture/modules/<ContextName>.md` for each bounded context, with entities listed as components and dependency edges inferred from context relationships.

### 4. Validate

Check source code against the glossary:

```bash
bash .pi/scripts/validate-ubiquitous-language.sh
```

Or in pi:

```
Use domain_validate with sessionId: <id>
```

### 5. Iterate

The glossary is a living document. As you code, add terms that two agents use differently. Run the validator before each commit to catch drift.

---

## CLI Reference

```bash
guardian domain explore --context "..." [--session <id>] [--dry-run]
  Writes a DDD extraction prompt to .pi/domain/exploration/

guardian domain answer <session-id> <response-file> [--dry-run]
  Processes an LLM response JSON into an exploration session

guardian domain scaffold <session-id> [--dry-run]
  Generates architecture module docs from exploration data

guardian domain list
  Shows all exploration sessions
```

## Pi Extension Tools

| Tool | Parameters | Description |
|------|-----------|-------------|
| `domain_explore` | `context` (required), `sessionId` (optional), `dryRun` (optional) | Writes a prompt file, returns session ID + path |
| `domain_validate` | `sessionId` (required) | Runs 5 checks: session exists, structure integrity, glossary compliance, source drift, canonical refs |

## Validator

```bash
bash .pi/scripts/validate-ubiquitous-language.sh [src_dir]
```

Exit codes: 0 = clean, 1 = drift detected.

For TOML-based validation (when Guardian CLI supports it):
```bash
guardian validate --filter ubiquitous-language
```

## Design Decisions

**No embedded LLM providers.** The domain explorer writes prompt files instead of calling OpenAI/Anthropic directly. The same model that runs pi handles the DDD extraction — no API keys, no SDK imports, no provider chain.

**Prompt file as interface.** The `.prompt.md` file is a standalone artifact. You can feed it to any LLM, edit it, version it, or review it before sending. This keeps the exploration process transparent and auditable.

**Glossary first.** The ubiquitous language glossary is the cornerstone. The validator enforces naming consistency at the code level, which prevents the most common DDD failure mode: agreeing on terms in a workshop and immediately violating them in code.

**Sessions are immutable.** Each exploration creates a snapshot. Re-running with a refined context creates a new session — old ones remain for comparison. Use `domain list` to see all sessions.
