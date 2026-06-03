# Tracking: Project Scaffolding (Epic 0)

## Purpose
This issue tracks the overall progress of the Project Scaffolding epic.

## Issues Checklist

### EPIC-001: Project Templates & Options
- [ ] `#ISSUE-001` - ProjectCreateOptions interface + PROJECT_DEFAULTS
- [ ] `#ISSUE-002` - Java project skeleton templates
- [ ] `#ISSUE-003` - TypeScript project skeleton templates

### EPIC-002: Structure Generator
- [ ] `#ISSUE-004` - project-generator.ts — Structure Generator
- [ ] `#ISSUE-005` - Layer discovery logic

### EPIC-003: Build Config + CI Generator
- [ ] `#ISSUE-006` - build-config.ts — Build Config Generator
- [ ] `#ISSUE-007` - ci-generator.ts — CI Pipeline Generator
- [ ] `#ISSUE-008` - stage_*.sh scaffolding scripts

### EPIC-004: Project Command & Integration
- [ ] `#ISSUE-009` - project.ts CLI handler
- [ ] `#ISSUE-010` - Register project command in CLI entry point
- [ ] `#ISSUE-011` - Existing project detection
- [ ] `#ISSUE-012` - Reuse init manifest helpers

### EPIC-005: Testing
- [ ] `#ISSUE-013` - Unit tests for project-generator.ts
- [ ] `#ISSUE-014` - Unit tests for ci-generator.ts
- [ ] `#ISSUE-015` - Unit tests for build-config.ts
- [ ] `#ISSUE-016` - Integration tests for project create flow
- [ ] `#ISSUE-017` - E2E tests for Java project create
- [ ] `#ISSUE-018` - E2E test for existing project detection

### Progress
- Total Issues: 18
- Completed: 0/18 (0%)
- In Progress: 0/18 (0%)

### Dependencies
- EPIC-001 → EPIC-002 → EPIC-004
- EPIC-001 → EPIC-003 → EPIC-004
- EPIC-005 after all implementation

### Implementation Order
1. EPIC-001 (#1, #2, #3) — Templates first
2. EPIC-002 (#4, #5) — Structure generator
3. EPIC-003 (#6, #7, #8) — Build config + CI (parallel with EPIC-002)
4. EPIC-004 (#9, #10, #11, #12) — Command integration
5. EPIC-005 (#13-18) — Tests last
