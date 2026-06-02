# Tracking: Java & Spring Boot Language Support

## Type: Tracking

### Purpose
This issue tracks the overall progress of the Java & Spring Boot Language Support epic.

### Issues Checklist

#### EPIC-001: Java Language Registration & Patterns
- [ ] #10 - Register Java in SUPPORTED_LANGUAGES — Status: open
- [ ] #12 - Create java-patterns.md — Status: open

#### EPIC-002: Build Tool Selection & Init Integration
- [ ] #11 - Add buildTool prompt (Maven/Gradle) to init flow — Status: open
- [ ] #9 - Store buildTool in manifest and template context — Status: open
- [ ] #8 - Scaffold Java templates during init — Status: open

#### EPIC-003: Validator Scripts & Spring Enforcement
- [ ] #7 - Create 7 language-specific Java validator scripts — Status: open
- [ ] #14 - Create validate-annotations.sh — Status: open
- [ ] #16 - Create validate-spring-architecture.sh — Status: open (depends on #14)
- [ ] #13 - Create spring.toml declarative rules — Status: open
- [ ] #21 - Update validation-runner.ts and shouldSkipFile for Java scripts — Status: open

#### EPIC-004: Testing & Documentation
- [ ] #19 - Unit tests for Java support — Status: open
- [ ] #17 - Integration tests for Java validators — Status: open
- [ ] #18 - E2E tests for Java init lifecycle — Status: open
- [ ] #15 - Documentation updates — Status: open

### Progress
- Total Issues: 14
- Completed: 0/14 (0%)
- In Progress: 0/14 (0%)

### Dependencies
- None — Java support is self-contained within existing Guardian modules

### Implementation Order
1. EPIC-001 (#10, #12) — Language registration first
2. EPIC-002 (#11, #9, #8) — Build tool & init integration
3. EPIC-003 (#7, #14, #16, #13, #21) — Validator scripts & enforcement (order: #14 before #16, #21 after #8)
4. EPIC-004 (#19, #17, #18, #15) — Testing & docs last
