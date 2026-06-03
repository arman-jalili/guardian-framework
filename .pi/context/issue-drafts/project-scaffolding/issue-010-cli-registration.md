# Issue: Register project command in CLI entry point

## Epic: EPIC-004 — Project Command & Integration

## Type: Feature

## Priority: High

### Description
Register the `project` command in `src/index.ts` — add to `parseArgs` options, add help text, add command routing in `runCommand()`. Also add `--groupId` flag for Maven group ID / package prefix.

### Acceptance Criteria
- [ ] `project` command recognized in `parseArgs` routing
- [ ] `--groupId <name>` flag registered as string option
- [ ] Help text updated with `project` subcommands
- [ ] `guardian project create --lang java --buildTool maven --groupId com.myapp` works end-to-end
- [ ] `guardian project create --help` shows relevant options

### Implementation Notes
- File: `src/index.ts`
- Follow existing pattern for `init`, `generate`, `update` commands
- Add `project` to the switch/match in `runCommand()`

### Dependencies
- Depends on: Issue #009 (project.ts CLI handler)

### Estimated Scope
- Files: 1 (`src/index.ts`)
- Lines: ~20-30
- Scope: Simple

### Testing Requirements
- Integration test: `--help` shows project command
