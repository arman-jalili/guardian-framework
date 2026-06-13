# Guardian — Domain Exploration

**Guardian** is a CLI that scaffolds, validates, and orchestrates architecture-first development workflows. The **Domain Exploration** subsystem is where every project begins — turning fuzzy business context into structured domain knowledge.

> **Domain First, Architecture Second, Code Third.**

---

## Quick Start (2 Minutes)

### 1. Initialize Guardian

```bash
cd your-project
npx guardian-framework init
```

### 2. Explore Your Domain

```bash
guardian domain explore --context "We build a subscription-based analytics platform where users ingest event data, build dashboards, set up alerting rules, and collaborate in workspaces."
```

### 3. Feed the Prompt to an LLM

A `.prompt.md` file is created in `.pi/domain/exploration/<session-id>.prompt.md`. This prompt asks the LLM to extract:

- Bounded contexts
- Entities and value objects
- Domain events
- Ubiquitous language (canonical terms + prohibited aliases)
- Aggregate roots
- Open questions

Save the LLM's JSON response to a file (e.g., `response.json`).

### 4. Save the Response

```bash
guardian domain answer <session-id> response.json
```

### 5. Scaffold Architecture

```bash
guardian domain scaffold <session-id>
```

This creates `.pi/architecture/modules/` and `.pi/architecture/decisions/` directories ready for architecture module docs and ADRs.

### 6. Start Architecting

```
/architect --epic "Platform MVP"
```

---

## Table of Contents

1. [What Is Domain Exploration?](#1-what-is-domain-exploration)
2. [CLI Reference](#2-cli-reference)
3. [Slash Command Reference](#3-slash-command-reference)
4. [Exploration Workflow](#4-exploration-workflow)
5. [Output Format](#5-output-format)
6. [Session Management](#6-session-management)
7. [Ubiquitous Language](#7-ubiquitous-language)
8. [From Exploration to Architecture](#8-from-exploration-to-architecture)
9. [Validation](#9-validation)
10. [Integration with /architect](#10-integration-with-architect)
11. [Complete Walkthrough](#11-complete-walkthrough)
12. [Troubleshooting](#12-troubleshooting)
13. [See Also](#13-see-also)

---

## 1. What Is Domain Exploration?

Domain Exploration is the **first phase** of the Guardian SDLC. Before any architecture decisions, before any code, you explore the business domain to discover:

- **Bounded Contexts** — Logical boundaries within the domain (e.g., Billing, Analytics, User Management)
- **Entities** — Objects with identity and lifecycle (e.g., `Workspace`, `Dashboard`, `AlertRule`)
- **Value Objects** — Immutable descriptive objects (e.g., `EmailAddress`, `MetricName`, `TimeRange`)
- **Aggregate Roots** — Consistency boundaries (e.g., `Workspace` as root containing members, dashboards)
- **Domain Events** — Notable occurrences (e.g., `AlertTriggered`, `DashboardShared`, `WorkspaceCreated`)
- **Ubiquitous Language** — Canonical terms with definitions and prohibited aliases

### Why Explore Before Architecting?

| Without Exploration | With Exploration |
|---|---|
| Architecture reflects assumptions | Architecture reflects discovered reality |
| Terms drift across team | Ubiquitous language enforced |
| Missing bounded contexts | All contexts discovered upfront |
| Refactoring late | Right boundaries from the start |
| Architects guess, developers correct | Domain experts validate the model |

### Key Principles

1. **LLM-assisted, human-validated** — The LLM extracts structure; domain experts validate and refine
2. **Session-based** — Multiple exploration sessions can run in parallel
3. **Prompt-driven** — Structured DDD prompts guide the LLM output
4. **Architecture-ready output** — Exploration feeds directly into architecture modules and ADRs
5. **Language-aware** — Terms feed the ubiquitous language validator for drift detection

---

## 2. CLI Reference

### `guardian domain explore`

Start a new DDD domain exploration session.

```bash
guardian domain explore --context "Describe your business domain here..."

# Optional session ID (resume an existing session)
guardian domain explore --context "..." --session my-session-id

# Preview without writing files
guardian domain explore --context "..." --dry-run
```

**Options:**

| Option | Required | Description |
|--------|----------|-------------|
| `--context` | Yes | Business domain description (max 5000 chars) |
| `--session` | No | Custom session ID (defaults to UUID) |
| `--dry-run` | No | Simulate without writing files |

**Output:** A `.prompt.md` file in `.pi/domain/exploration/<session-id>.prompt.md` containing a structured DDD extraction prompt ready for an LLM.

### `guardian domain answer`

Save an LLM response to complete an exploration session.

```bash
guardian domain answer <session-id> <response-file>
```

**Arguments:**

| Argument | Required | Description |
|----------|----------|-------------|
| `session-id` | Yes | Session ID from `domain explore` |
| `response-file` | Yes | Path to file containing LLM JSON response |

**Output:** A session `.md` file in `.pi/domain/exploration/<session-id>.md` with the prompt, response, and placeholder sections for bounded contexts, entities, and ubiquitous language.

### `guardian domain scaffold`

Generate architecture directories from a completed exploration session.

```bash
guardian domain scaffold <session-id>

# Preview without writing files
guardian domain scaffold <session-id> --dry-run
```

**Output:** Creates `.pi/architecture/modules/` and `.pi/architecture/decisions/` directories if they don't exist. Ready for architecture module docs and ADRs.

### `guardian domain list`

List all domain exploration sessions.

```bash
guardian domain list
```

**Output:** A table of all sessions with their IDs, creation timestamps, and status.

---

## 3. Slash Command Reference

Inside the pi agent, use `/domain` instead of the CLI. Consistent with `/architect`.

### `/domain --explore`

```bash
# Inside the pi agent
/domain --explore "We build a subscription analytics platform..."

# Long context (wrap in quotes)
/domain --explore "Describe your business domain in detail..."
```

Creates a DDD exploration prompt, returns the **session ID** and prompt file path. The agent can then read the prompt file and process it.

**Output from the agent:**

```
I've prepared a DDD domain exploration for you.

1. Read the prompt file: .pi/domain/exploration/<id>.prompt.md
2. Feed the prompt to your LLM to get a structured domain model
3. Save the JSON response to a file
4. Use /domain --answer <id> <response-file>
5. Use /domain --architect-scaffold <id> to generate architecture

Session ID: <uuid>
```

### `/domain --answer`

```bash
# Inside the pi agent
/domain --answer <session-id> response.json
```

Saves an LLM response file to complete an exploration session. Requires:
- A valid session ID from a previous `/domain --explore`
- An existing response file on disk

**Output:** Saves the exploration to `.pi/domain/exploration/<session-id>.md` and notifies the agent to continue with architecture scaffolding.

### `/domain --architect-scaffold`

```bash
# Inside the pi agent
/domain --architect-scaffold <session-id>
```

Creates architecture directories from a completed exploration. Requires a session that has been answered (`.md` file exists).

**What is generated:**

| Path | Contents |
|------|----------|
| `.pi/architecture/modules/<context>.md` | One module doc per bounded context (stub with placeholder sections) |
| `.pi/architecture/decisions/ADR-001.md` | A single starter ADR (DDD with bounded contexts pattern) |
| `.pi/architecture/diagrams/system-context.md` | Mermaid bounded context flow diagram |

**What is NOT generated (agent responsibility):**

- **Additional ADRs** — only `ADR-001` is created. The agent should generate remaining ADRs based on architecture decisions.
- **Module doc ADR references** — module docs contain `## ADRs\n\nNone yet`. The agent fills these in.
- **CHANGELOG** — remains as placeholder. The agent updates it when asked.
- **Key Files** — module docs contain `## Key Files\n\nNone yet`. The agent fills these in during implementation.

### `/domain --validate`

```bash
# Inside the pi agent
/domain --validate <session-id>
```

Validates an exploration session structure. Checks:
- Session file exists
- Contains `## Bounded Contexts` section
- Contains `## Entities` section
- Contains `## Ubiquitous Language` section

**Output:** Pass/fail report per check.

### No arguments

Shows usage help:

```
Available /domain subcommands:

  /domain --explore "..."
    Start a new DDD domain exploration session

  /domain --answer <session-id> <response-file>
    Save an LLM response to complete an exploration

  /domain --architect-scaffold <session-id>
    Generate architecture directories from exploration

  /domain --validate <session-id>
    Validate exploration session structure
```

---

## 4. Exploration Workflow

```
┌───────────────────────────────────────────────────────────────┐
│                    DOMAIN EXPLORATION                         │
│                                                               │
│  ┌─────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   │
│  │ Describe │   │ Generate │   │ LLM      │   │ Save     │   │
│  │ business │──▶│ DDD      │──▶│ extracts │──▶│ response │   │
│  │ context  │   │ prompt   │   │ model    │   │          │   │
│  └─────────┘   └──────────┘   └──────────┘   └──────────┘   │
│                                     │                         │
│                                     ▼                         │
│                              ┌──────────────┐                │
│                              │ Validate     │                │
│                              │ session      │                │
│                              └──────┬───────┘                │
│                                     │                         │
│                                     ▼                         │
│                              ┌──────────────┐                │
│                              │ Scaffold     │                │
│                              │ architecture │                │
│                              └──────┬───────┘                │
│                                     │                         │
│                                     ▼                         │
│                              ┌──────────────┐                │
│                              │ /architect   │                │
│                              │ epic plan    │                │
│                              └──────────────┘                │
└───────────────────────────────────────────────────────────────┘
```

### Step-by-Step

**Step 1: Describe** — Write a paragraph describing the business domain. Include:
- Who the users are
- What they do
- What the system needs to handle
- Any known bounded contexts or entities

**Step 2: Prompt** — Guardian generates a structured DDD extraction prompt. The prompt asks the LLM to respond with valid JSON containing bounded contexts, entities, domain events, and ubiquitous language.

**Step 3: Extract** — Feed the prompt to any LLM (Claude, GPT, etc.). The LLM returns structured JSON following the schema in the prompt.

**Step 4: Save** — Save the response file and use `domain answer` to create the session file.

**Step 5: Validate** — Use `domain --validate` to check structural integrity.

**Step 6: Scaffold** — Use `domain scaffold` or `domain --architect-scaffold` to create architecture directories.

**Step 7: Architect** — Use `/architect --epic "MVP"` to begin planning epics from the discovered bounded contexts.

### What the Prompt Asks

The generated prompt instructs the LLM to return **valid JSON only** with this structure:

```json
{
  "businessContext": "Brief one-line summary",
  "boundedContexts": [
    {
      "name": "ContextName",
      "description": "What this context does",
      "entities": ["EntityName1", "EntityName2"]
    }
  ],
  "entities": [
    {
      "name": "EntityName",
      "context": "BoundedContextName",
      "type": "entity | value-object | aggregate-root",
      "description": "What this entity represents"
    }
  ],
  "domainEvents": [
    {
      "name": "EventName",
      "context": "BoundedContextName",
      "description": "What happened",
      "triggeredBy": "What caused this event"
    }
  ],
  "ubiquitousLanguage": [
    {
      "term": "TermName",
      "definition": "Clear definition",
      "boundedContext": "BoundedContextName",
      "aliases": ["bad-alias-1", "bad-alias-2"],
      "examples": "code snippet showing correct usage"
    }
  ],
  "openQuestions": "Any ambiguities that need human clarification",
  "aggregateRoots": ["AggregateRootName1", "AggregateRootName2"]
}
```

---

## 5. Output Format

### Directory Structure

After exploration, the `.pi/domain/` directory contains:

```
.pi/domain/
├── exploration/              ← Exploration sessions
│   ├── <session-id>.prompt.md   ← Generated DDD prompt (sent to LLM)
│   ├── <session-id>.md          ← Completed session (prompt + response)
│   └── ...
├── exploration.md            ← Active exploration log
└── ubiquitous-language.md    ← Canonical glossary (source of truth)
```

### Session File Structure

A completed session (`.md`) has:

```markdown
# Domain Exploration

Session ID: <uuid>

## Prompt

[The DDD extraction prompt that was sent to the LLM]

## Response

[The raw JSON response from the LLM]

## Bounded Contexts

*(Parsed from response)*

## Entities

*(Parsed from response)*

## Ubiquitous Language

*(Parsed from response)*
```

### Ubiquitous Language Glossary

The canonical glossary in `.pi/domain/ubiquitous-language.md` follows this format:

| Term | Definition | Bounded Context | Aliases/Synonyms | Examples |
|------|-----------|----------------|-----------------|---------|
| `Workspace` | A collaborative space for team analytics | Analytics | Organization, Project | `workspace.create({ name })` |
| `Dashboard` | A visual representation of metrics | Analytics | Board, ChartView | `dashboard.addPanel(metric)` |

The ubiquitous language validator (`validate-ubiquitous-language.sh`) checks:
- Source code uses canonical terms (not aliases)
- Import aliases don't shadow canonical names
- Class/function names match the glossary

---

## 6. Session Management

### Create a Session

```bash
guardian domain explore --context "..." --session my-custom-id
```

Or let Guardian generate a UUID:

```bash
guardian domain explore --context "..."
```

### List Sessions

```bash
guardian domain list
```

### Resume a Session

```bash
guardian domain explore --context "Additional details..." --session <existing-id>
```

This adds more context to the same session's prompt.

### Delete a Session

Sessions are files in `.pi/domain/exploration/`. Remove them manually:

```bash
rm .pi/domain/exploration/<session-id>.*
```

---

## 7. Ubiquitous Language

The ubiquitous language glossary is the **canonical source of truth** for domain terminology. Every term has:

| Field | Description |
|-------|-------------|
| **Term** | The canonical name (e.g., `Workspace`) |
| **Definition** | Clear, unambiguous meaning |
| **Bounded Context** | Which context owns this term |
| **Aliases/Synonyms** | **Prohibited** names — never use in code |
| **Examples** | Code snippets showing correct usage |

### Adding New Terms

```markdown
| `AggregateRoot` | Definition here | ContextName | ProhibitedAlias1, ProhibitedAlias2 | `code example` |
```

### Drift Detection

The script `.pi/scripts/validate-ubiquitous-language.sh` checks:

1. **Import alias drift** — `import { Thing as BadAlias }` where `BadAlias` is a prohibited alias
2. **Function/class name drift** — Classes named with aliases instead of canonical terms
3. **Canonical term coverage** — Missing terms that should exist based on architecture

---

## 8. From Exploration to Architecture

The output of domain exploration feeds directly into Guardian's architecture system:

### Bounded Context → Architecture Module

Each bounded context becomes a module in `.pi/architecture/modules/`:

```
.pi/architecture/modules/
├── billing-context.md
├── analytics-context.md
├── user-management-context.md
└── notification-context.md
```

### Entities → Components

Each entity becomes a component within its module:

```markdown
# Analytics Context

## Components

### Workspace
status: planned
description: A collaborative space for team analytics
depends: none

### Dashboard
status: planned
description: Visual representation of metrics
depends: Workspace

### AlertRule
status: planned
description: Threshold-based alerting configuration
depends: Dashboard
```

### Ubiquitous Language → Canonical References

Terms from the glossary become the language used in canonical reference headers:

```typescript
/**
 * Canonical Reference: .pi/architecture/modules/analytics-context.md#Workspace
 * Implements: Workspace entity
 */
```

### Domain Events → Integration Contracts

Domain events define the integration boundaries between contexts:

```typescript
// Event published by Analytics when an alert triggers
// Consumed by Notification context
interface AlertTriggered {
  workspaceId: string;
  alertRuleId: string;
  metric: string;
  threshold: number;
  actualValue: number;
  timestamp: string;
}
```

---

## 9. Validation

### Session Validation

```bash
# CLI
guardian domain list

# Inside pi agent
/domain --validate <session-id>
```

Checks performed:
1. Session file exists
2. Contains `## Bounded Contexts` section
3. Contains `## Entities` section
4. Contains `## Ubiquitous Language` section

### Glossary Validation

```bash
bash .pi/scripts/validate-ubiquitous-language.sh
```

Checks source code drift from canonical terms:
- Import aliases that match prohibited terms
- Function/class names using aliases
- Missing canonical references

### Canonical Reference Validation

```bash
bash .pi/scripts/validate-canonical.sh
```

Checks that implementation files reference architecture modules derived from exploration.

---

## 10. Integration with /architect

Domain exploration is designed to feed directly into `/project` (Epic 0) and then `/architect`:

```
┌────────────────────────────────────────────────────────────┐
│  /domain --explore                                          │
│  Discover bounded contexts, entities, ubiquitous language   │
└─────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│  /domain --architect-scaffold                               │
│  Create architecture directories from exploration           │
└─────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│  Create architecture module docs                            │
│  .pi/architecture/modules/<context>.md                      │
│  (One per bounded context from exploration)                 │
└─────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│  /project create --lang java --buildTool maven              │
│  Scaffold source tree, build config, CI pipeline            │
│  FROM architecture decisions (Epic 0)                       │
└─────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│  /architect --epic "MVP"                                    │
│  Discover modules, find next slices, plan epics             │
└─────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│  /pipeline "MVP" --items ... --merge-on-valid               │
│  Execute: implement → validate → MR → merge                 │
└────────────────────────────────────────────────────────────┘
```

**Key points:**
- `/domain` discovers *what* to build
- `/architect` discovers *how* to build it
- `/pipeline` executes the build
- Every term from `/domain` is enforced by validators during `/pipeline`

---

## 11. Complete Walkthrough

### Scenario: Building a Fintech Payment Platform

**Step 1: Explore the domain**

```bash
guardian domain explore --context "We are building a fintech payment platform that processes merchant transactions. Merchants onboard via our dashboard, configure payment methods (credit card, crypto, bank transfer), and customers can initiate payments through a checkout API. The system handles fraud detection, dispute resolution, settlement to merchant bank accounts, and reconciliation with payment processors."
```

Output:
```
Domain Exploration Created
Session ID: abc123-def456
Prompt File: .pi/domain/exploration/abc123-def456.prompt.md
Context Length: 342 characters
Status: awaiting-response
```

**Step 2: Feed to an LLM**

Read the prompt file and send it to Claude/GPT. Save the JSON response to `response.json`.

**Step 3: Save the response**

```bash
guardian domain answer abc123-def456 response.json
```

**Step 4: Validate the session**

```bash
guardian domain validate --session abc123-def456
```

Or inside pi:
```
/domain --validate abc123-def456
```

**Step 5: Scaffold architecture**

```bash
guardian domain scaffold abc123-def456
```

Or inside pi:
```
/domain --architect-scaffold abc123-def456
```

**Step 6: Create architecture modules**

Create one module per bounded context:

```markdown
# Merchant Onboarding Context

## Components

### MerchantRegistration
status: planned
description: Handles merchant signup, KYC verification, and dashboard provisioning
depends: none

### PaymentMethodConfiguration
status: planned
description: Lets merchants configure accepted payment methods and processors
depends: MerchantRegistration
```

**Step 7: Start architecting**

```
/architect --epic "Payment Platform MVP"
```

Guardian discovers the modules, plans epics, validates, and begins implementation.

---

## 12. Troubleshooting

### "No context provided"

```
ERROR: context is required (business description)
```

Provide a `--context` argument describing your business domain.

### "Session not found"

```
Session not found: <id>. Start with /domain --explore first.
```

The session ID doesn't exist. Run `/domain --explore` first to create a session, then use the returned ID.

### "Response file not found"

The file path you provided doesn't exist. Check:
- The path is relative to your current working directory
- The file has been created and saved

### Empty or malformed response

If the LLM didn't return valid JSON, the session file will have placeholder sections. Re-run with a better prompt or manually edit the response file.

### "Architecture directories already exist"

This is fine — `/domain --architect-scaffold` ensures directories exist and is a no-op if they already do. Continue with `/architect`.

### LLM returned too much or too little

The prompt asks for specific JSON fields. If the LLM goes off-format:
1. Edit the response file to conform to the expected schema
2. Re-run `/domain --answer <session-id> <response-file>`

### Can I run multiple sessions?

Yes. Each session is independent. Use custom session IDs to keep them organized:

```bash
guardian domain explore --context "..." --session billing-v1
guardian domain explore --context "..." --session analytics-v1
```

---

## 13. See Also

- [guardian-architect-usage.md](guardian-architect-usage.md) — Architecture orchestration (`/architect`)
- [guardian-complete-usage.md](guardian-complete-usage.md) — Complete Guardian usage guide
- [architecture.md](architecture.md) — Architecture document
- [guardian-framework-design.md](guardian-framework-design.md) — Design specification
- [pipeline-usage.md](pipeline-usage.md) — Pipeline engine reference
- [guardian-domain-usage.md](guardian-domain-usage.md) — Domain exploration (this document)
