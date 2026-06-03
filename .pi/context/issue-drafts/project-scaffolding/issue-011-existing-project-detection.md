# Issue: Existing project detection

## Epic: EPIC-004 — Project Command & Integration

## Type: Feature

## Priority: Medium

### Description
Add logic to detect existing source trees before generating. When `src/` directory already exists in the target, `project create` shows a warning and skips generation unless `--force` is specified. This prevents accidentally overwriting user code.

### Acceptance Criteria
- [ ] Checks for existing `src/` directory at target path
- [ ] When `src/` exists: prints warning, skips all generation
- [ ] `--force` overrides the guard and proceeds
- [ ] `--dryRun` reports that `src/` would be skipped
- [ ] Message: "Existing project source detected at {path}. Use --force to scaffold alongside existing code."

### Implementation Notes
- File: `src/commands/project.ts`
- Check `fs.existsSync(path.join(targetDir, "src"))`
- Combined with `project.ts` main handler

### Dependencies
- Depends on: Issue #009 (project.ts)

### Estimated Scope
- Files: 1 (`src/commands/project.ts`)
- Lines: ~20-30
- Scope: Simple

### Testing Requirements
- Unit test: returns early when src/ exists
- Unit test: --force bypasses guard
