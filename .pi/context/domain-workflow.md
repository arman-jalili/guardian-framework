# Domain-Driven Design Workflow (End-to-End)

## Overview

The full workflow from business idea to implemented architecture using Guardian's domain tools.
Every step produces artifacts the next step consumes. No manual file creation needed.

---

## Step 1: Explore the Domain

**Two ways to start:**

### Option A: Tell the agent directly
Just describe your business domain to the agent. The agent will analyze it using Domain-Driven Design and write two files:
- `.pi/domain/exploration.md` — Full analysis: Business Context, Actors/Roles, FR, NFR, Assumptions, Bounded Contexts, Entities, Domain Events, Ubiquitous Language, Open Questions, Aggregate Roots
- `.pi/domain/ubiquitous-language.md` — Canonical glossary with terms (deduplicated)

**Agent instructions — when the user asks you to analyze a business domain:**
1. Read `.pi/domain/exploration.md` if it exists (to see if there's a stub to fill in)
2. Analyze the business context using Domain-Driven Design
3. Use `read`/`edit`/`write` tools to fill in or create `.pi/domain/exploration.md` with ALL sections:
   - Business Context
   - Actors & Roles — table with Actor, Description, Interactions columns
   - Functional Requirements — table with ID, Requirement, Priority, Bounded Context columns
   - Non-Functional Requirements — table with ID, Requirement, Category, Target columns
   - Assumptions — table with Assumption, Impact if Wrong, Mitigation columns
   - Bounded Contexts — table with Context, Description, Entities columns
   - Entities — table with Entity, Context, Type, Description columns
   - Domain Events — table with Event, Context, Description, Triggered By columns
   - Ubiquitous Language — table with Term, Definition, Bounded Context, Aliases columns
   - Open Questions
   - Aggregate Roots
4. Create or update `.pi/domain/ubiquitous-language.md` with the DDD terms from your analysis
   - If the file already exists, READ it first and append new terms (deduplicate by term name)
   - Table format: | Term | Definition | Bounded Context | Aliases/Synonyms | Examples |

### Option B: Use the slash command
```bash
/domain --explore "Describe your business domain here..."
```

**What happens:**
- Creates a session ID and session file in `.pi/domain/exploration/<session-id>.md`
- Creates stub `.pi/domain/exploration.md` with the business context filled in
- Creates `.pi/domain/ubiquitous-language.md` if it doesn't exist
- Returns a message telling you what was created

**Then ask the agent to fill in the analysis.** The agent will read the stub file and fill in all DDD sections using the `read` and `edit` tools.

---

## Step 2: Review & Validate

Read the generated files:

```bash
/domain --validate <session-id>
```

What to check:
1. Are the bounded contexts correct?
2. Does the ubiquitous language match your team's vocabulary?
3. Are the open questions acceptable or should you refine?
4. Change `status: draft` to `status: validated` when agreed upon

If the analysis needs refinement, edit the `.md` files directly or describe the changes to the agent.

---

## Step 3: Generate Architecture Docs

> **IMPORTANT:** This step creates architecture DOCUMENTS (module docs, ADRs, diagrams) from the domain exploration.
> Do NOT confuse this with Step 5 (Project Scaffold) which generates source code with Maven/Gradle.

**Tell the agent:**
```
generate architecture from <session-id>
```

Example:
```
generate architecture from payment-processing-ddd
```

The agent will:
1. Read the domain exploration (`.pi/domain/exploration/<session-id>.md`)
2. Create one architecture module file per bounded context in `.pi/architecture/modules/`
3. Each module file includes components with `status: planned` for the bounded context
4. Create ADRs in `.pi/architecture/decisions/` for key technology choices
5. Create system diagrams in `.pi/architecture/diagrams/` with mermaid
6. Create directories if needed

**IMPORTANT — Agent instructions (read carefully):**
When the user says "generate architecture from <session-id>" or asks you to create architecture
module docs from a domain exploration, do the following. **Do NOT run `guardian project create`**
or ask about Maven/Gradle — that is for Step 5 (greenfield project scaffold) only.

1. Read `.pi/domain/exploration/<session-id>.md` to get the bounded contexts and entities
2. Create `.pi/architecture/modules/` directory if it doesn't exist
3. For each bounded context, create a module doc (e.g., `payment-ingestion.md`) with:
   - Title and description of the bounded context
   - A table of components with Name, Description, Dependencies, Status columns
   - Components are derived from entities and domain events in that context
   - Set each component's status to `planned`
4. Create `.pi/architecture/decisions/` if it doesn't exist
5. Create relevant ADR files (e.g., `ADR-001-payment-idempotency.md`)
6. Create `.pi/architecture/diagrams/` if it doesn't exist
7. Create system context and container diagrams using mermaid

**Output structure:**
| Path | Purpose |
|------|---------|
| `.pi/architecture/modules/<context>.md` | One module doc per bounded context |
| `.pi/architecture/decisions/ADR-*.md` | Architecture Decision Records |
| `.pi/architecture/diagrams/*.md` | System diagrams with mermaid |

---

## Step 4: Plan Implementation

Two approaches:

**A) Module exists:** Use `/epic-plan`
```bash
/epic-plan --module <module-name>
```

**B) Cross-module:** Use `/epic-plan --overview` or `/architect`
```bash
/architect --epic "First epic name"
```

**Epic structure (4 layers):**
1. **Contract Freeze** — define interfaces before implementation
2. **Implementation Issues** — one per component
3. **Proofing** — deterministic validation scripts + CI integration
4. **Architecture Readiness** — runbook, DR, docs, observability, CI enforcement

---

## Step 5: Scaffold Project (Epic 0 — greenfield only)

For a new project, BEFORE implementing the first epic, tell the agent:

```
scaffold project from architecture --lang java --buildTool maven
```

The agent will read the architecture modules and generate:
- Source directories per module + layer (`src/main/java/com/.../<module>/<layer>/`)
- Build configuration (`pom.xml` or `build.gradle`)
- CI pipeline (`.github/workflows/`)
- `README.md`

**IMPORTANT — Agent instructions (read carefully):**
When the user says "scaffold project from architecture" or asks you to create the
project structure from architecture modules:

1. Read all `.md` files in `.pi/architecture/modules/` to get the module names
2. Determine layers based on language (Java: domain, application, infrastructure, api)
3. Create source directories: `src/main/java/<groupId>/<module>/<layer>/.gitkeep`
4. Create test directories: `src/test/java/<groupId>/<module>/<layer>/.gitkeep`
5. Create placeholder source files in each directory with canonical reference headers
6. Generate build file (`pom.xml` for Maven or `build.gradle` for Gradle) with:
   - All modules listed as submodules or packages
   - Dependencies for Spring Boot, JPA, Validation, Lombok, Testcontainers
7. Generate CI pipeline (`.github/workflows/ci.yml`) with:
   - Build and test stages
   - Steps for compilation, tests, and quality checks
8. Update `README.md` with project overview and build instructions
9. Do NOT run `guardian project create` CLI — create files directly using `write` tool

Existing projects (with `src/` directory) skip this step.

**Agent instructions for build file generation — Maven pom.xml:**
- Include spring-boot-starter-parent as parent
- Set Java version to 17 or 21
- Create a multi-module POM with one module per bounded context
- Each module has its own POM with appropriate dependencies
- Include: spring-boot-starter-web, spring-boot-starter-data-jpa, spring-boot-starter-validation,
  lombok, postgresql, h2 (test), testcontainers, springdoc-openapi
- Add maven-surefire-plugin, spring-boot-maven-plugin, jacoco-maven-plugin

**Agent instructions for build file generation — Gradle build.gradle:**
- Apply java, spring-boot, and jacoco plugins
- Set Java version to 17 or 21
- Create a multi-module build with one subproject per bounded context
- Include same dependencies as Maven version

**Agent instructions for CI pipeline (.github/workflows/ci.yml):**
- Trigger on push and pull_request to main
- Java 17/21 setup with actions/setup-java
- Cache Maven/Gradle dependencies
- Build step: `mvn verify` or `gradle build`
- Run tests with jacoco report
- Upload test reports as artifacts

---

## Step 6: Implement

```bash
/implement-series
# or follow the pipeline generated by /architect
```

Each issue follows the contract freeze → implementation → proofing → readiness sequence.

---

## Quick Reference

```
Tell the agent: "Analyze this business domain using DDD: <description>"
  |  (agent writes exploration.md + ubiquitous-language.md automatically)
  |
Tell the agent: "generate architecture from <session-id>"
  |  (agent creates module docs, ADRs, diagrams)
  |
Tell the agent: "scaffold project from architecture --lang java --buildTool maven"
  |  (Epic 0 — agent creates source dirs, pom.xml, CI pipeline)
  |
/epic-plan --overview  or  /architect --epic "Name"
  |
/implement-series
```

## Files Reference

| Path | Contents |
|------|----------|
| `.pi/domain/exploration/` | Session files (one per explore run) |
| `.pi/domain/exploration.md` | Active exploration analysis (rendered) |
| `.pi/domain/ubiquitous-language.md` | Canonical glossary (auto-updated) |
| `.pi/architecture/modules/` | Module docs (one per bounded context) |
| `.pi/architecture/decisions/` | ADRs |
| `.pi/architecture/diagrams/` | System diagrams with mermaid |

---

## Agent Definitions

Each agent has a canonical definition in `.pi/agents/`:

| Agent | Role | What It Decides |
|-------|------|-----------------|
| Architecture Coordinator | Coordinator | Scope, dependencies, validators, CI gates |
| Issue Factory | Coordinator | Issue breakdown, labels, acceptance criteria |
| Bootstrap Implementer | Builder | Code, tests, docs within one issue |
| Architecture Validator | Validator | Architecture conformance pass/fail |
| Security Validator | Validator | Security control pass/fail |
| Operations Validator | Validator | Operational readiness pass/fail |

## Deterministic Validation

Before agent judgment, run automated checks:

```bash
# Validate planning packet structure
python scripts/ci/check_planning_packet.py --input=planning_packet.md

# Validate agent output schema
python scripts/ci/validate_agent_output.py --input=output.md --schema=architecture-validator
```
