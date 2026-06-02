# Epic: Java & Spring Boot Language Support

## Milestone Title: Java & Spring Boot Language Support

### Description
Add Java as a first-class Guardian language with Spring Boot conventions. This brings Guardian's language coverage to 5 languages (TypeScript, Rust, Python, Go, Java) and enables Java/Spring Boot teams to use Guardian's token-optimized agentic scaffolding.

### Goals
- Register Java in Guardian's `SUPPORTED_LANGUAGES` with Maven and Gradle build defaults
- Provide Java & Spring Boot code patterns, conventions, and templates for AI agents
- Add interactive build-tool selection (Maven/Gradle) to the init flow
- Generate 7 language-specific validators adapted for Java toolchains
- Enforce Spring Boot conventions via annotation validators and TOML declarative rules
- Deliver comprehensive test coverage (unit, integration, E2E)

### Sub-Epics Included
1. **EPIC-001: Java Language Registration & Patterns** — 2 issues
2. **EPIC-002: Build Tool Selection & Init Integration** — 3 issues
3. **EPIC-003: Validator Scripts & Spring Enforcement** — 4 issues
4. **EPIC-004: Testing & Documentation** — 4 issues

### Architecture Reference
- `.pi/architecture/modules/java-spring-support.md`
- ADR-003: Template-Based Generation
- ADR-004: Multi-Export Model

### Timeline
- Start: 2026-06-02
- Target Completion: TBD

### Success Metrics
- Java appears in `guardian info` language list after init
- `guardian init --lang java` scaffolds all expected files
- 7 language-specific validator scripts created and functional
- Annotation validators correctly flag missing `@Transactional`
- All tests pass (unit: 90%+, integration: 100% of scripts, E2E: full lifecycle)
