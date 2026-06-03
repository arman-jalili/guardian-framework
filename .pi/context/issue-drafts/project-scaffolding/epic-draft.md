# Epic: Project Scaffolding (Epic 0)

## Milestone Title: Project Scaffolding

### Description
A `guardian project create` command that scaffolds a greenfield project's source directories, build configuration, CI pipeline, and Guardian integration — all generated FROM the architecture decisions, not before them.

### Goals
- Generate language-specific source directory trees from `.pi/architecture/modules/*.md` module boundaries
- Create build configuration (pom.xml / build.gradle) with test, coverage, and lint plugins
- Generate CI pipeline (GitHub Actions / GitLab CI) with hardening pipeline pre-wired
- Create `.pi/scripts/ci/stage_*.sh` scaffolding scripts
- Insert `.gitkeep` files and placeholder source files with canonical reference headers
- Detect existing source trees and skip/no-op gracefully

### Sub-Epics Included
1. **EPIC-001: Project Templates & Options** — 3 issues
2. **EPIC-002: Structure Generator** — 2 issues
3. **EPIC-003: Build Config + CI Generator** — 3 issues
4. **EPIC-004: Project Command & Integration** — 4 issues
5. **EPIC-005: Testing** — 6 issues

### Architecture Reference
- `.pi/architecture/modules/project-scaffolding-epic0.md`
- ADR-003: Template-Based Generation

### Timeline
- Start: 2026-06-03
- Target Completion: TBD

### Success Metrics
- `guardian project create --lang java --buildTool maven` generates full source tree
- Generated pom.xml compiles with JUnit 5, JaCoCo, Checkstyle, OWASP
- CI pipeline runs hardening stages
- Existing project detection works (no-op when src/ exists)
