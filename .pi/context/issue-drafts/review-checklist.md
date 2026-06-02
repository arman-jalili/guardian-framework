# Issue Draft Review Checklist

## Epic: Java & Spring Boot Language Support

### General Review
- [x] All issues have clear acceptance criteria
- [x] Dependencies correctly mapped
- [x] Scope estimates reasonable
- [x] Testing requirements specified
- [x] Documentation updates noted
- [x] Tracking issue includes all issues
- [x] Epic draft created

### Draft Files Created

| # | File | Issue# | Status | Fixes Applied |
|---|------|--------|--------|---------------|
| 1 | `issue-001-java-language-registration.md` | #10 | ✅ | — |
| 2 | `issue-002-java-patterns.md` | #12 | ✅ | — |
| 3 | `issue-003-buildtool-prompt.md` | #11 | ✅ Fixed | Added `src/index.ts` arg parser change |
| 4 | `issue-004-buildtool-manifest.md` | #9 | ✅ Fixed | Added TemplateContext interface + getDefaultContext() details |
| 5 | `issue-005-java-template-scaffolding.md` | #8 | ✅ | — |
| 6 | `issue-006-language-validators.md` | #7 | ✅ | — |
| 7 | `issue-007-validate-annotations.md` | #14 | ✅ | — |
| 8 | `issue-008-validate-spring-architecture.md` | #16 | ✅ Fixed | Now depends on #14, mentions shared conventions |
| 9 | `issue-009-spring-toml-rules.md` | #13 | ✅ | — |
| 10 | `issue-010-unit-tests.md` | #19 | ✅ | — |
| 11 | `issue-011-integration-tests.md` | #17 | ✅ | — |
| 12 | `issue-012-e2e-tests.md` | #18 | ✅ | — |
| 13 | `issue-013-documentation.md` | #15 | ✅ | — |
| 14 | `issue-014-validator-runner-skip-logic.md` | #21 | ✅ NEW | Added for validation-runner.ts + shouldSkipFile |

### Dependency Graph
```
#10 (Register Java) ──────────────┐
                                  ├── #11 (BuildTool Prompt + arg parser) ──┐
#12 (Java Patterns) ──────────────┤                                        │
                                  │                                        ├── #8 (Scaffold Templates) ──┐
                                  ├── #9 (TemplateContext/Manifest) ───────┘                            │
                                  │                                                                     ├── #7 (7 Validators) ──┐
                                  │                                                                     │                       ├── #19 (Unit Tests)
                                  │                                                                     ├── #14 (Annotations) ──┤
                                  │                                                                     │                       ├── #17 (Integration)
                                  │                                                                     ├── #16 (Architecture) ─┤
                                  │                                                                     │   ↑ depends on #14    └── #18 (E2E Tests)
                                  │                                                                     ├── #13 (TOML) ────────┘
                                  │                                                                     └── #21 (ValidatorRunner/SkipLogic)
                                  │                                                                         ↑ depends on #8, #7
                                  └── #15 (Docs) [last]
```

### Scope Summary
| Sub-Epic | Issues | Est. Files | Est. Lines | Scope |
|----------|--------|-----------|-----------|-------|
| EPIC-001: Registration & Patterns | 2 | 2 | ~350 | Moderate |
| EPIC-002: Build Tool & Init | 3 | 5 | ~200 | Moderate |
| EPIC-003: Validators & Enforcement | 5 | 11 | ~850 | Large |
| EPIC-004: Testing & Docs | 4 | 5+ | ~500 | Moderate |
| **Total** | **14** | **23+** | **~1900** | **Large** |

### Ready for Git Issues?
- [x] All issue drafts created with full details
- [x] Epic/milestone draft created
- [x] Tracking issue draft created (updated with #21)
- [x] All drafts reviewed and approved
- [x] GitHub issues created (#7-#21)
- [x] Dependency comments added to all issues
