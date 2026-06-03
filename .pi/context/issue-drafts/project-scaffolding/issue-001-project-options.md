# Issue: Create ProjectCreateOptions interface and PROJECT_DEFAULTS

## Epic: EPIC-001 — Project Templates & Options

## Type: Feature

## Priority: High

### Description
Add `ProjectCreateOptions` interface and `PROJECT_DEFAULTS` constant to `src/lib/templates.ts`. These define the typed options for the `guardian project create` command, including language, build tool, groupId, package name, modules, layers, and CI stages.

The `layers` field now contains **decomposed interface sub-layer paths** (e.g., `interfaces/http`, `interfaces/messaging`) rather than a flat `interfaces`. These sub-layers are derived from the project's actual delivery mechanisms — driven by ADRs and module docs, not hardcoded.

### Acceptance Criteria
- [ ] `ProjectCreateOptions` interface defined with fields: `language`, `buildTool?`, `groupId`, `packageName`, `modules: string[]`, `layers: string[]`, `ciStages: string[]`
- [ ] `PROJECT_DEFAULTS` map keyed by `Language` with decomposed interface sub-layers per language
- [ ] Java default layers: `["domain", "application", "infrastructure", "interfaces/http", "interfaces/messaging"]`
- [ ] TypeScript default layers: `["domain", "application", "infrastructure", "interfaces/http", "interfaces/graphql"]`
- [ ] Rust default layers: `["domain", "application", "infrastructure", "interfaces/http", "interfaces/cli"]`
- [ ] Each sub-layer path is stored as a single string entry (e.g., `"interfaces/http"` not separate `"interfaces"` + `"http"`)
- [ ] Existing tests still pass

### Implementation Notes
- File: `src/lib/templates.ts`
- Sub-layer paths use `/` separator (e.g., `"interfaces/http"`) — the structure generator will split on `/` to create nested directories
- Follow existing pattern of `LANGUAGE_DEFAULTS`
- Reuse existing `Language` type

### Dependencies
- None — first issue in epic

### Estimated Scope
- Files: 1 (`src/lib/templates.ts`)
- Lines: ~40
- Scope: Simple

### Testing Requirements
- Unit test: PROJECT_DEFAULTS.java.layers contains `"interfaces/http"` and `"interfaces/messaging"`
- Unit test: PROJECT_DEFAULTS.typescript.layers contains `"interfaces/http"` and `"interfaces/graphql"`
- Unit test: PROJECT_DEFAULTS.rust.layers contains `"interfaces/http"` and `"interfaces/cli"`
