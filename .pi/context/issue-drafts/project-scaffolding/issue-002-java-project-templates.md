# Issue: Create Java project skeleton templates

## Epic: EPIC-001 — Project Templates & Options

## Type: Feature

## Priority: High

### Description
Create `templates/project/java/` with a minimal Maven/Gradle project skeleton including `pom.xml`, `Dockerfile`, `.gitignore`, `README.md`, and `.gitkeep` placeholders for source directories. Templates use `{{GROUP}}`, `{{MODULES}}`, `{{LAYERS}}`, `{{BUILD_TOOL}}`, `{{CI_STAGES}}` placeholders.

The interface layer is decomposed into sub-layers matching Spring Boot's delivery mechanisms:
- `interfaces/http/` — REST controllers, DTOs, web config
- `interfaces/messaging/` — events, pub/sub, message listeners

### Acceptance Criteria
- [ ] `templates/project/java/` directory created
- [ ] `pom.xml` template with `{{GROUP}}`, `{{PROJECTNAME}}`, `{{VERSION}}` placeholders, including spring-boot-starter-web and spring-boot-starter-amqp/spring-kafka deps
- [ ] `Dockerfile` template with multi-stage build pattern
- [ ] `.gitignore` with Java/Maven/Gradle patterns
- [ ] `README.md` template with project info placeholders
- [ ] Template references `interfaces/http/` and `interfaces/messaging/` as default sub-layers
- [ ] All placeholders use `{{UPPERCASE}}` format matching existing template system

### Implementation Notes
- Directory: `templates/project/java/`
- `pom.xml` should include JUnit 5, JaCoCo, Checkstyle, OWASP dependency-check plugins
- Spring Boot-specific: include spring-boot-starter-web (for http) and spring-boot-starter-amqp (for messaging) in default dependencies
- The structure generator will create the actual sub-layer directories per module × layer entry

### Dependencies
- Depends on: Issue #001 (ProjectCreateOptions interface)

### Estimated Scope
- Files: 6+ (new skeleton files)
- Lines: ~150-200
- Scope: Moderate

### Testing Requirements
- Integration test: templates render without errors with sample context
