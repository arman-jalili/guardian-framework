# Issue: Create ci-generator.ts — CI Pipeline Generator

## Epic: EPIC-003 — Build Config + CI Generator

## Type: Feature

## Priority: High

### Description
Create `src/lib/ci-generator.ts` that reads the project's validator configuration and generates the CI pipeline config with the hardening pipeline pre-wired. Platform matches `repoTool` setting (gh → GitHub Actions, glab → GitLab CI).

### Acceptance Criteria
- [ ] Generates `.github/workflows/ci.yml` for GitHub (when repoTool="gh")
- [ ] Generates `.gitlab-ci.yml` for GitLab (when repoTool="glab")
- [ ] CI pipeline runs: `bash .pi/scripts/ci/run_hardening_stages.sh`
- [ ] Sets correct runner image based on language (maven:3.9-eclipse-temurin-21 for Java, node:20 for TypeScript)
- [ ] Respects `buildTool` for runner image selection
- [ ] `dryRun` prints pipeline YAML without writing
- [ ] Handles unsupported repoTool gracefully

### Implementation Notes
- File: `src/lib/ci-generator.ts` (new)
- Use template rendering for YAML generation
- YAML can be generated via string templates (no YAML library needed for simple pipelines)

### Dependencies
- Depends on: EPIC-001 (project options)

### Estimated Scope
- Files: 1 (new `src/lib/ci-generator.ts`)
- Lines: ~150-200
- Scope: Moderate

### Testing Requirements
- Unit test: GitHub Actions YAML has correct jobs
- Unit test: GitLab CI YAML has correct stages
- Unit test: correct runner image for Java Maven
- Unit test: correct runner image for Java Gradle
- Unit test: correct runner image for TypeScript
