# Issue: Integration tests for project create flow

## Epic: EPIC-005 — Testing

## Type: Test

## Priority: High

### Description
Add integration tests for the full `project create` flow that verify the generators work together correctly, producing a valid project structure with decomposed interface sub-layers in a temporary directory.

### Acceptance Criteria
- [ ] Test: `project create --lang java --buildTool maven` creates `interfaces/http/` and `interfaces/messaging/` directories
- [ ] Test: `project create --lang java --buildTool gradle` creates Gradle build file
- [ ] Test: `project create --lang typescript` creates `interfaces/http/` and `interfaces/graphql/` directories
- [ ] Test: sub-layer directories are nested under `interfaces/` (not flat)
- [ ] Test: generated pom.xml has spring-boot-starter-web dependency for HTTP sub-layer
- [ ] Test: generated pom.xml has spring-boot-starter-amqp dependency for messaging sub-layer
- [ ] Test: generated `.github/workflows/ci.yml` has valid YAML structure
- [ ] Test: generated `.pi/` directory has manifest with tracked files
- [ ] Test: all generators produce consistent output (same project name, group, etc.)

### Implementation Notes
- File: `tests/integration/project-create.test.ts` (new)
- Create temporary directories for each test
- Run generators programmatically (not via CLI)

### Dependencies
- Depends on: EPIC-001, EPIC-002, EPIC-003, EPIC-004

### Estimated Scope
- Files: 1 (new test file)
- Lines: ~180-230
- Scope: Moderate
