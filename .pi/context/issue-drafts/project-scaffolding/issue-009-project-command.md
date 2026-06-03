# Issue: Create project.ts — Project Command CLI Handler

## Epic: EPIC-004 — Project Command & Integration

## Type: Feature

## Priority: High

### Description
Create `src/commands/project.ts` as the CLI handler for `guardian project create`. This reads architecture modules, invokes the structure generator, build config generator, and CI generator in sequence. Supports `--dryRun`, `--lang`, `--buildTool`, `--force` flags.

### Acceptance Criteria
- [ ] `runProjectCreate()` function with typed options parameter
- [ ] Reads `.pi/architecture/modules/*.md` for module discovery
- [ ] Reads `.pi/architecture/decisions/` for layer discovery
- [ ] Calls project-generator.ts → build-config.ts → ci-generator.ts in sequence
- [ ] Passes `dryRun` flag through to all generators
- [ ] `--force` flag overrides existing-project guard
- [ ] Prints summary of created files on success
- [ ] Handles missing `.pi/architecture/` gracefully (error message)
- [ ] Existing project detection: check for `src/` directory, skip/no-op unless `--force`

### Implementation Notes
- File: `src/commands/project.ts` (new)
- Import generators from `src/lib/`
- Follow existing command pattern (init.ts, generate.ts, etc.)

### Dependencies
- Depends on: EPIC-002 (project-generator), EPIC-003 (build-config, ci-generator)

### Estimated Scope
- Files: 1 (new `src/commands/project.ts`)
- Lines: ~150-200
- Scope: Moderate

### Testing Requirements
- Unit test: calls all generators in correct order
- Unit test: dryRun propagates to all generators
- Unit test: existing src/ detection works
