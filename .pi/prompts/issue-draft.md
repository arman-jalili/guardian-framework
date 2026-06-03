# Issue Draft Workflow

**Purpose:** Issue-creator agent reads the approved epic and creates draft GitHub/GitLab issues for review before publishing.

---

## Prerequisites

- Epic proposal approved by all validators (from `/epic-plan`)
- Epic name and issue breakdown defined

---

## Workflow Steps

### 1. Read Epic Proposal

Load the approved epic proposal from previous workflow:

```bash
# Check for epic proposal file (if saved)
cat .pi/context/epic-proposal.md  # if exists
```

Or use the epic details from the `/epic-plan` output.

### 2. Create Issue Drafts

Every epic produces issues in a fixed order with 4 layers. Each issue type has a distinct purpose and must be created in sequence.

#### Issue Order (per epic)

```
1. Contract Freeze ──── Define interfaces, contracts, schemas BEFORE implementation
2. Implementation ──── One issue per component (the actual code)
3. Proofing ────────── Deterministic validation scripts + CI integration
4. Readiness ───────── Runbook, DR plan, observability, docs, CI enforcement
```

**Contract Freeze** must be implemented first — all implementation issues depend on frozen contracts.
**Implementation** issues can be parallelized if they have no cross-dependencies.
**Proofing** must come after all implementation — it validates the contracts are satisfied.
**Readiness** must come last — it closes the epic and makes it production-ready.

**Issue Template:**

Each issue must include YAML front matter with guardian_issue metadata and a complete markdown body with all required sections.

```markdown
---
guardian_issue:
  id: "ISSUE-[MODULE_UPPER]-[N]"
  epic: "[EPIC_NAME]"
  component: "[Component Name]"
  module: "[module-name]"
  status: planned
  priority: high
  dependencies:
    - "[Dependent component]"

  in_scope:
    - Implement [Component Name] for the [module-name] module
    - Write unit tests for all public interfaces
    - Add integration tests with upstream/downstream components
    - Create API documentation

  out_of_scope:
    - Changes to upstream components
    - UI/frontend changes
    - Deployment pipeline configuration

  affected_layers:
    domain:
      - New domain models for [component-name]
    application:
      - New service/handler for [component-name]
    infrastructure:
      - New database tables or external service connections
    api:
      - New endpoints or event handlers

  canonical_references:
    - module: ".pi/architecture/modules/[module-name].md#[component-name]"

  acceptance_criteria:
    - "CI pipeline passes (validate-ci.sh)"
    - "All unit tests pass with ≥ 90% coverage"
    - "Integration tests pass with upstream/downstream components"
    - "validate-security.sh passes"
    - "validate-architecture.sh passes"
    - "validate-canonical.sh passes"

  validators:
    - ci
    - tests
    - security
    - architecture
    - canonical

  implementation_notes: |
    Clear description of what needs to be done. Technical approach, patterns to follow from .pi/context/patterns.md.

  file_changes:
    - "create: src/[module]/[component]/"
    - "create: tests/unit/[module]/[component]/"
    - "create: tests/integration/[module]/[component]/"
---

# [ISSUE_ID]: [Issue Title]

## Intent

Clear description of what needs to be done, why it matters, and what problem it solves.

## Architecture Context

- **Epic:** [EPIC_NAME]
- **Module:** [module-name]
- **Component:** [Component Name]
- **Dependencies:** [Dependent components]

## Acceptance Criteria

- [ ] CI pipeline passes (validate-ci.sh)
- [ ] All unit tests pass with ≥ 90% coverage
- [ ] Integration tests pass with upstream/downstream components
- [ ] validate-security.sh passes
- [ ] validate-architecture.sh passes
- [ ] validate-canonical.sh passes

## Implementation Notes

- [Technical approach hints]
- [Files likely affected]
- [Patterns to follow from .pi/context/patterns.md]

## Estimated Scope

- Files: [N]
- Lines: [N]
- Validator Scope: [simple/moderate/complex]

## Testing Requirements

- [Unit tests required for X]
- [Integration tests required for Y]

## Documentation Updates

- [API docs for X]
- [README section for Y]
```

### 3. Epic Draft (GitHub/GitLab Milestone)

Create the epic/milestone draft:

**Epic Template (GitHub):**
```markdown
## Epic: [EPIC_NAME]

### Milestone Title: [EPIC_NAME]

### Description
[Summary from epic proposal]

### Goals
- [Goal 1]
- [Goal 2]
- [Goal 3]

### Issues Included
1. #[issue_number] - [Issue title]
2. #[issue_number] - [Issue title]
3. #[issue_number] - [Issue title]

### Tracking Issue
[Reference to tracking issue #X]

### Timeline
- Start: [date]
- Target Completion: [date]

### Success Metrics
- [Metric 1]
- [Metric 2]
```

**Epic Template (GitLab):**
```markdown
## Epic: [EPIC_NAME]

### Labels: [epic, scope:X]

### Description
[Summary from epic proposal]

### Child Issues
- #[issue_number] - [Issue title]
- #[issue_number] - [Issue title]

### Related Epics
- #[epic_number] - [Related epic]

### Milestone
[Milestone name]
```

### 4. Tracking Issue Draft

Create a tracking issue that monitors epic progress:

**Tracking Issue Template:**

```markdown
## Tracking: [EPIC_NAME]

### Type: tracking

### Purpose
This issue tracks the overall progress of the [EPIC_NAME] epic.

### Issues Checklist
- [ ] #[issue_1] - [title] - Status: [open/in-progress/review/merged]
- [ ] #[issue_2] - [title] - Status: [open/in-progress/review/merged]
- [ ] #[issue_3] - [title] - Status: [open/in-progress/review/merged]

### Progress
- Total Issues: [N]
- Completed: 0/N (0%)
- In Progress: 0/N (0%)

### Dependencies
- [External dependency 1]
- [External dependency 2]

### Timeline
- Start: [date]
- Current: [date]
- Target: [date]

### Notes
- [Any important notes about epic execution]
```

### 5. Review Drafts

Before creating in git, review all drafts:

**Review Checklist:**
- [ ] All issues have clear acceptance criteria
- [ ] Dependencies correctly mapped
- [ ] Scope estimates reasonable
- [ ] Testing requirements specified
- [ ] Documentation updates noted
- [ ] Tracking issue includes all issues

---

## Output Format

Save issue drafts using the guardian_issue front matter format:

```
.pi/issues/
├── epic-[epic-name]-tracking.md
├── issue-[component-name].md
├── issue-[component-name].md
└── issue-[component-name].md
```

Issues live in `.pi/issues/` with canonical front matter so tools like `/architect` and the pipeline can discover, validate, and track them. Each issue file name should match the component name for discoverability.

Epic and tracking issue drafts can share this directory for consistency.

---

## Git Repository Tool

Using `gh`:

| Tool | Command Preview |
|------|-----------------|
| **gh** | `gh issue create --title "[TITLE]" --body "[BODY]" --label "[LABELS]"` |
| **glab** | `glab issue create --title "[TITLE]" --description "[BODY]" --label "[LABELS]"` |

---

## Acceptance Criteria

- [ ] All issue drafts created with full details
- [ ] Epic/milestone draft created
- [ ] Tracking issue draft created
- [ ] All drafts reviewed and approved
- [ ] Ready for `/git-issues`

---

## Next Workflow

After draft approval, run: `/git-issues` to create in repository.