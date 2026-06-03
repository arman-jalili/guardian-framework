# Project Scaffolding (Epic 0) Architecture

<!--
Canonical Reference: .pi/architecture/modules/project-scaffolding-epic0.md
Blueprint Source: Guardian Framework v2.2
Generated: NEVER (this is the source)
-->

## Overview

A `guardian project create` command that scaffolds a greenfield project's source directories, build configuration, CI pipeline, and Guardian integration — all generated FROM the architecture decisions, not before them. This is Epic 0: the first thing run after domain exploration and architecture decisions are made, before any implementation begins.

For existing projects the command detects existing `src/` directories and becomes a verification/no-op.

## Responsibilities

- Generate language-specific source directory trees from `.pi/architecture/modules/*.md` module boundaries and layer decisions
- Create build configuration (`pom.xml` / `build.gradle`) with test, coverage, and lint plugins matching the chosen build tool
- Generate `.github/workflows/ci.yml` with Guardian's hardening pipeline pre-wired
- Create `.pi/scripts/ci/stage_*.sh` scaffolding scripts matching validators the architecture requires
- Insert `.gitkeep` files and placeholder source files with canonical reference headers pointing to the correct architecture module
- Detect existing source trees and skip/no-op gracefully

## Components

| Component | File Path | Purpose | Canonical Section |
|-----------|-----------|---------|-------------------|
| Project Command | src/commands/project.ts | CLI handler for `guardian project create` | #project-command |
| Project Templates | templates/project/ | Language-specific project skeletons | #project-templates |
| Structure Generator | src/lib/project-generator.ts | Reads architecture modules, emits directory tree | #structure-generator |
| CI Pipeline Generator | src/lib/ci-generator.ts | Generates stage scripts from validator config | #ci-generator |
| Build Config Generator | src/lib/build-config.ts | Generates pom.xml / build.gradle from build tool + language | #build-config |
| ProjectOptions Interface | src/lib/templates.ts | ProjectCreateOptions type + defaults | #project-options |

---

## Component Details

### Project Command

**Purpose:** CLI entry point for `guardian project create`. Reads `.pi/architecture/`, validates context, delegates to generators.

**Implementation File:** `src/commands/project.ts`

**Canonical Reference:** `.pi/architecture/modules/project-scaffolding-epic0.md#project-command`

**Dependencies:**
- Template System (project templates)
- Init Command (reuses manifest creation, extension scaffolding)
- Core Libraries (logger, manifest, workflow-config)

**Interface:**
```typescript
export async function runProjectCreate(
  targetDir: string,
  options: {
    language: Language;
    buildTool?: "maven" | "gradle";
    dryRun?: boolean;
    force?: boolean;
  },
): Promise<void>;
```

### Project Templates

**Purpose:** Per-language project skeletons that the structure generator renders with architecture-specific context.

**Directory:** `templates/project/{language}/`

**Structure:**
```
templates/project/java/
├── src/main/java/com/{{GROUP}}/shared/domain/.gitkeep
├── pom.xml
├── Dockerfile
├── .gitignore
└── README.md
```

Each language gets a minimal skeleton with placeholders:
- `{{GROUP}}` — Maven group / package prefix (from architecture config)
- `{{MODULES}}` — Module names (from .pi/architecture/modules/*.md)
- `{{LAYERS}}` — Layer directories (from ADR decisions)
- `{{BUILD_TOOL}}` — Maven or Gradle
- `{{CI_STAGES}}` — Validator scripts to run in CI

### Structure Generator

**Purpose:** Reads `.pi/architecture/modules/*.md` for module names and `.pi/architecture/decisions/*.md` for layer decisions, then generates the directory tree.

**Implementation File:** `src/lib/project-generator.ts`

**Canonical Reference:** `.pi/architecture/modules/project-scaffolding-epic0.md#structure-generator`

**Data Flow:**
```
1. Discover modules: find .pi/architecture/modules/*.md
2. Extract module names from each file's # Title
3. Read ADRs for layer structure (hexagonal = domain/app/infra/interfaces,
   clean = use-cases/entities/gateways/presenters)
4. Generate: src/{lang}/{group}/{module}/{layer}/.gitkeep
5. Generate placeholder file with canonical reference header
```

**Layer Discovery:**
- ADR tags or explicit `layers` field in the architecture module doc determine the layer directories
- The interface layer is always decomposed into sub-layers matching the project's delivery mechanisms — this forces explicit decisions about how the system communicates
- Default layers (language-agnostic):
  ```
  domain/
  application/
  infrastructure/
  interfaces/
    ├── http/        (REST, gRPC)
    ├── graphql/     (if GraphQL is in the stack)
    ├── messaging/   (events, pub/sub, queues)
    └── cli/         (CLI commands, scheduled tasks)
  ```
- Default for Java Spring Boot: `domain/`, `application/`, `infrastructure/`, `interfaces/http/`, `interfaces/messaging/`
- Default for TypeScript: `domain/`, `application/`, `infrastructure/`, `interfaces/http/`, `interfaces/graphql/`
- Default for Rust: `domain/`, `application/`, `infrastructure/`, `interfaces/http/`, `interfaces/cli/`
- The ADR or architecture module doc can add or remove sub-layers (e.g., no GraphQL? drop `interfaces/graphql/`)

### CI Pipeline Generator

**Purpose:** Reads the project's validator configuration and generates the CI pipeline config with the hardening pipeline pre-wired. Platform matches the `repoTool` setting from init (`gh` → GitHub Actions, `glab` → GitLab CI).

**Implementation File:** `src/lib/ci-generator.ts`

**Canonical Reference:** `.pi/architecture/modules/project-scaffolding-epic0.md#ci-generator`

**Produces:**

For `gh` (GitHub):
```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run hardening pipeline
        run: bash .pi/scripts/ci/run_hardening_stages.sh
```

For `glab` (GitLab):
```yaml
# .gitlab-ci.yml
stages:
  - validate

validate:
  stage: validate
  image: maven:3.9-eclipse-temurin-21
  script:
    - bash .pi/scripts/ci/run_hardening_stages.sh
  only:
    - branches
```

Also generates `stage_*.sh` scripts in `.pi/scripts/ci/` for each active validator.

### Build Config Generator

**Purpose:** Generates `pom.xml` or `build.gradle` with the plugins and dependencies needed for the chosen tech stack.

**Implementation File:** `src/lib/build-config.ts`

**Canonical Reference:** `.pi/architecture/modules/project-scaffolding-epic0.md#build-config`

**Generated:** pom.xml includes test runner (JUnit 5), coverage (JaCoCo), lint (Checkstyle/PMD), security audit (OWASP Dependency Check).

### ProjectOptions Interface

**Purpose:** Type definition and defaults for project scaffolding options.

**Implementation File:** `src/lib/templates.ts`

**Canonical Reference:** `.pi/architecture/modules/project-scaffolding-epic0.md#project-options`

```typescript
export interface ProjectCreateOptions {
  language: Language;
  buildTool?: "maven" | "gradle";
  groupId: string;
  packageName: string;
  modules: string[];
  layers: string[];
  ciStages: string[];
}

export const PROJECT_DEFAULTS: Record<Language, Partial<ProjectCreateOptions>> = {
  // ...
};
```

---

## Data Flow

```
User runs: guardian project create --lang java --buildTool maven
     │
     ▼
project.ts reads .pi/architecture/modules/*.md
     │
     ├──→ Extract module names: [billing, notifications, shared]
     │
     ▼
project.ts reads .pi/architecture/decisions/ for layer structure
     │
     ├──→ ADR says: hexagonal → domain, application, infrastructure, interfaces
     │
     ▼
project-generator.ts emits directory tree
     │
     ├──→ src/main/java/com/{group}/billing/domain/.gitkeep
     ├──→ src/main/java/com/{group}/billing/application/.gitkeep
     ├──→ src/main/java/com/{group}/billing/infrastructure/.gitkeep
     ├──→ src/main/java/com/{group}/billing/interfaces/http/.gitkeep
     ├──→ src/main/java/com/{group}/billing/interfaces/messaging/.gitkeep
     ├──→ ... (all modules × all layers × sub-layers)
     │
     ▼
build-config.ts generates pom.xml with JaCoCo, JUnit 5, Checkstyle
     │
     ▼
ci-generator.ts generates .github/workflows/ci.yml + stage scripts
     │
     ▼
Guardian checks for existing src/ → skip if present (existing project)
```

---

## Dependencies

### Depends On
- **Init Command**: Manifest creation, workflow config loading
- **Template System**: Template rendering, placeholder substitution, language defaults
- **Core Libraries**: Logger, manifest, retry

### Used By
- **Init Command** (indirectly — `project create` can call init's helpers for `.pi/` scaffolding)
- **Architect Extension** (generated source paths are referenced by architect's issue templates)

---

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| Overwriting existing source files | `--dryRun` flag, `--force` required to overwrite, existing `src/` detection |
| Template injection | Template path sanitization, no dynamic template loading from user input |

---

## Testing Requirements

| Test Type | Coverage Target | Files |
|-----------|-----------------|-------|
| Unit | 90% | tests/unit/project-generator.test.ts, tests/unit/ci-generator.test.ts |
| Integration | 100% of generation paths | tests/integration/project-create.test.ts |
| E2E | Full lifecycle | tests/e2e/project-create-java.test.ts, tests/e2e/project-create-existing.test.ts |

---

## Change Log References

| Date | Change | Section | Status |
|------|--------|---------|--------|
| 2026-06-03 | Initial module creation | all | pending |

---

*Last updated: 2026-06-03*
*Module version: 0.1.0*
