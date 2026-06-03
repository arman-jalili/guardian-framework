# Issue: E2E tests for Java project create

## Epic: EPIC-005 — Testing

## Type: Test

## Priority: High

### Description
Add end-to-end tests that verify the full `guardian project create --lang java --buildTool maven` lifecycle end-to-end, simulating the actual CLI invocation in a temporary directory with a complete `.pi/architecture/` setup. Must verify decomposed interface sub-layers are created correctly.

### Acceptance Criteria
- [ ] Test: full lifecycle with Java Maven project creates `interfaces/http/` and `interfaces/messaging/` directories
- [ ] Test: full lifecycle with Java Gradle project creates equivalent structure
- [ ] Test: full lifecycle with TypeScript project creates `interfaces/http/` and `interfaces/graphql/` directories
- [ ] Test: all source directories created under `src/main/java/com/{group}/{module}/`
- [ ] Test: sub-layer directories are correctly nested (e.g., `src/main/java/com/group/billing/interfaces/http/.gitkeep`)
- [ ] Test: all placeholder files have canonical reference headers
- [ ] Test: pom.xml / build.gradle / package.json have sub-layer-appropriate dependencies

### Implementation Notes
- File: `tests/e2e/project-create-java.test.ts` (new)
- Use temporary directory with `.pi/architecture/modules/` fixtures
- Create minimal sample `.md` files for module discovery

### Dependencies
- Depends on: All implementation complete

### Estimated Scope
- Files: 1 (new test file)
- Lines: ~150-200
- Scope: Moderate
