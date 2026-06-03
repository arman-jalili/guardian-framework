# Issue: Create build-config.ts — Build Config Generator

## Epic: EPIC-003 — Build Config + CI Generator

## Type: Feature

## Priority: High

### Description
Create `src/lib/build-config.ts` that generates language-appropriate build configuration files from templates. For Java: `pom.xml` or `build.gradle` with JUnit 5, JaCoCo, Checkstyle/PMD, OWASP Dependency Check. Dependencies should match the selected interface sub-layers (e.g., spring-boot-starter-web for `interfaces/http`, spring-boot-starter-amqp for `interfaces/messaging`).

### Acceptance Criteria
- [ ] Java Maven: generates `pom.xml` with spring-boot-starter-parent, JUnit 5, JaCoCo, Checkstyle, OWASP plugins
- [ ] Java Maven: includes spring-boot-starter-web when `interfaces/http` is in layers
- [ ] Java Maven: includes spring-boot-starter-amqp or spring-kafka when `interfaces/messaging` is in layers
- [ ] Java Gradle: generates `build.gradle` with equivalent plugins
- [ ] TypeScript: generates `package.json` with vitest/jest, biome/ESLint, prettier
- [ ] TypeScript: includes Hono/Elysia when `interfaces/http` is in layers
- [ ] TypeScript: includes graphql-yoga when `interfaces/graphql` is in layers
- [ ] Template placeholders: `{{GROUP}}`, `{{ARTIFACT}}`, `{{VERSION}}`, `{{PROJECTNAME}}`
- [ ] Respects `buildTool` option for Java (Maven vs Gradle)
- [ ] `dryRun` prints without writing
- [ ] Handles unsupported language gracefully (warn, skip)

### Implementation Notes
- File: `src/lib/build-config.ts` (new)
- Use template rendering (`renderTemplate`) for file generation
- Reference existing `LANGUAGE_DEFAULTS` for tool-specific commands
- The `layers` array from options drives which extra dependencies are added

### Dependencies
- Depends on: EPIC-001 (project templates + options)

### Estimated Scope
- Files: 1 (new `src/lib/build-config.ts`)
- Lines: ~250-350
- Scope: Moderate

### Testing Requirements
- Unit test: generated pom.xml has spring-boot-starter-web when `interfaces/http` in layers
- Unit test: generated pom.xml has spring-boot-starter-amqp when `interfaces/messaging` in layers
- Unit test: generated pom.xml does NOT have spring-boot-starter-amqp when messaging not in layers
- Unit test: generated package.json has graphql-yoga when `interfaces/graphql` in layers
- Unit test: dryRun returns paths without writing
