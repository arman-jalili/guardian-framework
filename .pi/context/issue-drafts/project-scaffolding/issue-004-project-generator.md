# Issue: Create project-generator.ts — Structure Generator

## Epic: EPIC-002 — Structure Generator

## Type: Feature

## Priority: High

### Description
Create `src/lib/project-generator.ts` that reads `.pi/architecture/modules/*.md` for module names, reads ADRs for layer structure decisions, and emits a source directory tree with `.gitkeep` files and placeholder source files with canonical reference headers.

The interface layer is always decomposed into **sub-layers** (e.g., `interfaces/http/`, `interfaces/messaging/`, `interfaces/graphql/`, `interfaces/cli/`) driven by the project's actual delivery mechanisms. Sub-layer paths come from `ProjectCreateOptions.layers` (e.g., `"interfaces/http"`) and are split on `/` to create nested directories.

### Acceptance Criteria
- [ ] Discovers modules by reading `.pi/architecture/modules/*.md` (parses `# Title` for names)
- [ ] Reads architecture decisions for layer structure (hexagonal vs clean)
- [ ] Layer entries with `/` are treated as nested paths (e.g., `"interfaces/http"` → `interfaces/http/`)
- [ ] Generates: `src/{lang}/{group}/{module}/{layer}/.gitkeep` for each module × layer path
- [ ] Example output for Java: `src/main/java/com/{group}/billing/interfaces/http/.gitkeep`
- [ ] Generates placeholder `.java`/`.ts` files with canonical reference headers
- [ ] Accepts options: `language`, `buildTool`, `groupId`, `packageName`, `dryRun`
- [ ] `dryRun` prints planned tree without writing
- [ ] Returns list of created file paths

### Implementation Notes
- File: `src/lib/project-generator.ts` (new)
- Use `node:fs` for directory/file creation
- Module discovery: parse .md files with regex for `# Title` heading
- Layer discovery: use `layers` from options (set by `project.ts` based on ADR/doc analysis)
- For each layer path containing `/`, use `path.dirname()` / `path.basename()` or simply `mkdir -p` the full path
- Canonical reference: `// Canonical Reference: .pi/architecture/modules/{module}.md`

### Dependencies
- Depends on: EPIC-001 (ProjectCreateOptions + templates)

### Estimated Scope
- Files: 1 (new `src/lib/project-generator.ts`)
- Lines: ~200-300
- Scope: Moderate

### Testing Requirements
- Unit test: correct tree structure for Java with 2 modules and `interfaces/http` + `interfaces/messaging` sub-layers
- Unit test: correct tree structure for TypeScript with `interfaces/http` + `interfaces/graphql` sub-layers
- Unit test: dryRun returns plan without writing
- Unit test: handles empty architecture directory gracefully
