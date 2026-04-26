# Epic Plan Workflow

**Purpose:** Architecture coordinator analyzes the codebase and proposes the best logical slice for the next epic, then validates with architecture, security, and operations validators.

---

## Workflow Steps

### 1. Architecture Analysis

As **architecture-coordinator**, analyze the current codebase:

```bash
# Understand current architecture
find . -type f -name "*.ts" -o -name "*.js" -o -name "*.go" -o -name "*.rs" -o -name "*.py" | head -50
cat CLAUDE.md  # or .pi/agent/AGENTS.md
cat README.md
```

**Analysis Checklist:**
- [ ] Identify current architecture patterns
- [ ] Map component dependencies
- [ ] Find areas of high complexity
- [ ] Identify technical debt areas
- [ ] Review recent change patterns (git log)

### 2. Epic Slicing

Based on the analysis, propose the best logical slice for the next epic:

**Slicing Criteria:**
- **Cohesion:** Issues in the epic should be related
- **Independence:** Epic should be implementable without blocking other work
- **Value:** Epic should deliver measurable user value
- **Risk:** Balance risk across epics (don't cluster high-risk items)

**Output Format:**

```markdown
## Epic Proposal: [EPIC_NAME]

### Summary
[2-3 sentence description of what this epic accomplishes]

### Architecture Slice
[Which part of the architecture this epic touches]

### Estimated Scope
- Files: [X]
- Lines: [Y]
- Validators Required: [list]

### Issue Breakdown
1. **[Issue 1 Title]** - [Description] - Scope: [simple/moderate/complex]
2. **[Issue 2 Title]** - [Description] - Scope: [simple/moderate/complex]
3. **[Issue 3 Title]** - [Description] - Scope: [simple/moderate/complex]

### Dependencies
- [List any dependencies on other epics or external factors]

### Risk Assessment
- **Architecture Risk:** [Low/Medium/High]
- **Security Risk:** [Low/Medium/High]
- **Operations Risk:** [Low/Medium/High]
```

### 3. Validator Review

Invoke validators to check the epic proposal:

**Architecture Validator:**
```
/architecture-validator

Review epic proposal for:
1. Architecture pattern compliance
2. Component boundary correctness
3. Dependency direction (should flow inward)
4. Interface stability
```

**Security Validator:**
```
/security-validator

Review epic proposal for:
1. Data flow security
2. Authentication/authorization changes
3. External service interactions
4. Sensitive data handling
```

**Operations Validator:**
```
/operations-validator

Review epic proposal for:
1. Observability impact
2. Deployment complexity
3. Rollback strategy
4. Performance implications
```

### 4. Validator Response Format

Each validator outputs:

```markdown
## [Validator Name] Review

### Status: ✅ APPROVED / ⚠️ CONDITIONAL / ❌ REJECTED

### Findings
- [Finding 1]
- [Finding 2]

### Recommendations
- [Recommendation 1]
- [Recommendation 2]

### Required Changes (if CONDITIONAL/REJECTED)
- [Change 1]
- [Change 2]
```

### 5. Decision

As **architecture-coordinator**:

- If **all APPROVED:** Proceed to `/issue-draft`
- If **any CONDITIONAL:** Address recommendations, re-validate
- If **any REJECTED:** Revise epic proposal, re-validate

---

## Acceptance Criteria

- [ ] Architecture analysis documented
- [ ] Epic proposal with issue breakdown created
- [ ] All three validators reviewed
- [ ] All validators APPROVED or addressed CONDITIONAL findings
- [ ] Epic proposal ready for `/issue-draft`

---

## Git Repository Tool

Use the configured repository tool (`{{REPOTOOL}}`):

- **gh** (GitHub): `gh issue list`, `gh issue create`, `gh issue view`
- **glab** (GitLab): `glab issue list`, `glab issue create`, `glab issue view`

---

## Next Workflow

After approval, run: `/issue-draft`