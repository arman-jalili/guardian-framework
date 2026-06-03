# Batch Plan: Project Templates & Options

**Branch:** `feature/project-templates`
**Issues:** #24, #23, #25

---

## Issue #24 — ProjectCreateOptions + PROJECT_DEFAULTS

**File:** `src/lib/templates.ts`

### Changes
1. Add `ProjectCreateOptions` interface:
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
```
2. Add `PROJECT_DEFAULTS` map with decomposed interface sub-layers:
```typescript
export const PROJECT_DEFAULTS: Record<Language, Partial<ProjectCreateOptions>> = {
  java: { layers: ["domain", "application", "infrastructure", "interfaces/http", "interfaces/messaging"] },
  typescript: { layers: ["domain", "application", "infrastructure", "interfaces/http", "interfaces/graphql"] },
  rust: { layers: ["domain", "application", "infrastructure", "interfaces/http", "interfaces/cli"] },
  python: { layers: ["domain", "application", "infrastructure", "interfaces/http"] },
  go: { layers: ["domain", "application", "infrastructure", "interfaces/http"] },
};
```

---

## Issue #23 — Java skeleton templates

**Files:** `templates/project/java/` (new directory with 6+ files)

### Files to create
- `templates/project/java/pom.xml` — with placeholders, spring-boot-starter-web, spring-boot-starter-amqp
- `templates/project/java/Dockerfile` — multi-stage build
- `templates/project/java/.gitignore` — Java/Maven/Gradle patterns
- `templates/project/java/README.md` — project info

### Placeholders
`{{GROUP}}`, `{{PROJECTNAME}}`, `{{VERSION}}`, `{{BUILD_TOOL}}`, `{{LAYERS}}`, `{{MODULES}}`

---

## Issue #25 — TypeScript skeleton templates

**Files:** `templates/project/typescript/` (new directory with 6+ files)

### Files to create
- `templates/project/typescript/package.json` — with vitest, biome, Hono, graphql-yoga
- `templates/project/typescript/tsconfig.json` — strict mode
- `templates/project/typescript/Dockerfile`
- `templates/project/typescript/.gitignore` — Node/Bun patterns
- `templates/project/typescript/README.md`

---

## Validation
```bash
bun test
```
