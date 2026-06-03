# Issue Groups — Project Scaffolding (Epic 0)

## Group Structure

### Group 1: Project Templates & Options
| Batch | Issues | Branch |
|-------|--------|--------|
| 1 | #24, #23, #25 | `feature/project-templates` |

- **#24** (ProjectCreateOptions + PROJECT_DEFAULTS) — Simple, P1, no deps
- **#23** (Java skeleton templates) — Moderate, P1, depends on #24
- **#25** (TypeScript skeleton templates) — Simple, P2, depends on #24
- Order: #24 → #23 + #25 (parallel after #24)

### Group 2: Structure Generator
| Batch | Issues | Branch |
|-------|--------|--------|
| 2 | #26, #22 | `feature/structure-generator` |

- **#26** (project-generator.ts) — Moderate, P1, depends on #24
- **#22** (Layer discovery logic) — Moderate, P2, depends on #26
- Order: #26 → #22

### Group 3: Build Config + CI Pipeline
| Batch | Issues | Branch |
|-------|--------|--------|
| 3 | #27, #29, #32 | `feature/build-ci-generators` |

- **#27** (build-config.ts) — Moderate, P1, depends on #24
- **#29** (ci-generator.ts) — Moderate, P1, depends on #24
- **#32** (stage_*.sh scripts) — Moderate, P2, depends on #29
- Order: #27 + #29 parallel → #32

### Group 4: Project Command & Integration
| Batch | Issues | Branch |
|-------|--------|--------|
| 4 | #28, #33, #30, #31 | `feature/project-command` |

- **#28** (project.ts CLI handler) — Moderate, P1, depends on #26, #27, #29
- **#33** (CLI registration) — Simple, P1, depends on #28
- **#30** (Existing project detection) — Simple, P2, depends on #28
- **#31** (Init manifest reuse) — Simple, P2, depends on #28
- Order: #28 → #33, #30, #31 parallel

### Group 5: Testing
| Batch | Issues | Branch |
|-------|--------|--------|
| 5 | #35, #37, #34, #38, #36, #39 | `feature/project-testing` |

- All depend on implementation complete
- Order: unit tests → integration → E2E

## Implementation Order
```
Group 1 → Group 2 + Group 3 (parallel) → Group 4 → Group 5
```
