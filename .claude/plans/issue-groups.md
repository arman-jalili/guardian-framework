# Issue Groups — Java & Spring Boot Language Support

## Group Structure

### Group 1: Language Registration & Patterns
| Batch | Issues | Branch |
|-------|--------|--------|
| 1 | #10, #12 | `feature/java-registration` |

- **#10** (Register Java in SUPPORTED_LANGUAGES) — P1, Simple, no deps
- **#12** (Create java-patterns.md) — P1, Moderate, no deps
- Can be implemented in parallel (different files)

### Group 2: Build Tool Selection & Init Integration
| Batch | Issues | Branch |
|-------|--------|--------|
| 2 | #11, #9, #8 | `feature/java-buildtool-init` |

- **#11** (Add buildTool prompt + arg parser) — P1, Simple, depends on #10
- **#9** (Store buildTool in TemplateContext/manifest) — P2, Simple, depends on #11
- **#8** (Scaffold Java templates) — P1, Moderate, depends on #11, #9

### Group 3: Validator Scripts & Pipeline Integration
| Batch | Issues | Branch |
|-------|--------|--------|
| 3 | #21, #7, #14 | `feature/java-validators` |

- **#21** (validation-runner.ts + shouldSkipFile) — P1, Simple, depends on #8
- **#7** (7 language-specific validators) — P1, Moderate, depends on #8
- **#14** (validate-annotations.sh) — P1, Moderate, depends on #8
- #21, #7, #14 can be implemented in parallel

### Group 4: Enforcement & TOML Rules
| Batch | Issues | Branch |
|-------|--------|--------|
| 4 | #13, #16 | `feature/java-enforcement` |

- **#13** (spring.toml rules) — P2, Moderate, depends on #8, independent of others
- **#16** (validate-spring-architecture.sh) — P2, Simple, depends on #14

### Group 5: Testing & Documentation
| Batch | Issues | Branch |
|-------|--------|--------|
| 5 | #19, #17, #18, #15 | `feature/java-testing` |

- All depend on implementation being complete
- Order: #19 → #17 → #18 → #15

## Implementation Order

```
Group 1 (registration) ──→ Group 2 (build tool) ──→ Group 3 (validators) ──→ Group 4 (enforcement) ──→ Group 5 (tests)
```

## Starting Point

**Group 1** has no dependencies and is ready now.
