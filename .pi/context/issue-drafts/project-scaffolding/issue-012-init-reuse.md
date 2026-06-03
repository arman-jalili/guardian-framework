# Issue: Reuse init manifest creation helpers

## Epic: EPIC-004 — Project Command & Integration

## Type: Feature

## Priority: Medium

### Description
When `project create` generates source files, it should also scaffold the `.pi/` directory if not already present. Reuse the existing `init.ts` manifest creation helpers to set up Guardian's framework scaffolding alongside the generated project source.

### Acceptance Criteria
- [ ] `project create` calls init's manifest creation after generating source
- [ ] `.pi/` directory scaffolded with default Guardian configuration matching the selected language
- [ ] `guardian-manifest.json` created tracking generated files
- [ ] No duplicate scaffolding when `.pi/` already exists
- [ ] `--dryRun` shows that `.pi/` scaffolding would happen

### Implementation Notes
- File: `src/commands/project.ts`
- Import and call `createManifest()` from `src/lib/manifest.ts`
- Import and call scaffold helpers from `init.ts`
- Reference: `src/commands/init.ts` for existing flow

### Dependencies
- Depends on: Issue #009 (project.ts handler)

### Estimated Scope
- Files: 1 (`src/commands/project.ts`)
- Lines: ~40-60
- Scope: Simple

### Testing Requirements
- Unit test: manifest created after generation
- Unit test: manifest skipped if .pi/ already exists
