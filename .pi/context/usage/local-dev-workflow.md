# Guardian — Local Developer Workflow

> **Fast feedback before CI.** Run the preflight engine locally to catch issues before you commit, push, or create an MR.

---

## Quick Start

```bash
# Run the local preflight subset of CI checks
bash .pi/scripts/ci/run_preflight.sh

# Run a specific CI stage
bash .pi/scripts/ci/run_stage.sh docs_policy
bash .pi/scripts/ci/run_stage.sh architecture_conformance
bash .pi/scripts/ci/run_stage.sh security
bash .pi/scripts/ci/run_stage.sh release_readiness

# Validate agent output
bash .pi/scripts/ci/validate_agent_output.sh --input=validator_output.md --schema=architecture-validator

# Check staged files only (pre-commit)
git add .
bash .pi/scripts/ci/run_preflight.sh --staged

# JSON output (for CI/agent integration)
bash .pi/scripts/ci/run_preflight.sh --json > preflight_report.json
```

---

## Preflight Engine

### What It Does

The preflight engine (`.pi/scripts/ci/run_preflight.sh`) runs the applicable local checks before you commit. It:

1. **Detects changed files** — Only runs checks affected by your changes
2. **Runs in stages** — Mirrors the 10-stage CI structure
3. **Generates report** — Produces `preflight_report.json` for agent consumption
4. **Fast feedback** — Catches issues before CI runs

### Commands

| Command | Effect |
|---------|--------|
| `./run_preflight.sh` | Run all checks |
| `./run_preflight.sh --staged` | Check staged files only (pre-commit) |
| `./run_preflight.sh --stage=security` | Run only security stage |
| `./run_preflight.sh --json` | JSON output for CI/agent integration |
| `./run_preflight.sh --verbose` | Verbose output with full check details |

### Output Format

**Human-readable (default):**

```
[INFO] Changed files:
  - templates/pi/extensions/architect.ts
  - docs/guardian-architect-usage.md

[INFO] Running stage: static_analysis
  [PASS] tsc --noEmit (3s)
  [PASS] biome check (5s)
  [PASS] check_import_boundaries.sh (2s)

[INFO] Running stage: lint
  [PASS] biome check (5s)
  [PASS] biome format --check (2s)

================================
PREFLIGHT SUMMARY
================================
Total checks:  16
Passed:        16
Failed:        0
Skipped:       0
Duration:      45s
Report:        preflight_report.json
================================
✅ Preflight passed
```

**Machine-readable (JSON):**

```json
{
  "timestamp": "2026-05-17T12:00:00Z",
  "mode": "staged",
  "stages_run": ["docs_policy", "static_analysis", "lint", "security"],
  "summary": {
    "total": 16,
    "passed": 14,
    "failed": 2,
    "skipped": 0
  },
  "duration_seconds": 45,
  "results": [
    {
      "name": "biome check",
      "status": "pass",
      "message": "",
      "duration": 5
    }
  ],
  "status": "fail"
}
```

### Pre-commit Integration

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash
set -e
echo "Running preflight checks..."
bash .pi/scripts/ci/run_preflight.sh --staged
```

Make it executable:

```bash
chmod +x .git/hooks/pre-commit
```

---

## CI Stage Runner

Run individual CI stages locally:

```bash
# Run a specific stage
bash .pi/scripts/ci/run_stage.sh docs_policy
bash .pi/scripts/ci/run_stage.sh architecture_conformance
bash .pi/scripts/ci/run_stage.sh lint
bash .pi/scripts/ci/run_stage.sh static_analysis
bash .pi/scripts/ci/run_stage.sh unit
bash .pi/scripts/ci/run_stage.sh integration
bash .pi/scripts/ci/run_stage.sh security
bash .pi/scripts/ci/run_stage.sh migration_verify
bash .pi/scripts/ci/run_stage.sh package_build
bash .pi/scripts/ci/run_stage.sh release_readiness
```

---

## CI Stage Equivalents

| CI Stage | Local Command | Services Required |
|----------|---------------|-------------------|
| **docs_policy** | `./run_stage.sh docs_policy` | None |
| **architecture_conformance** | `./run_stage.sh architecture_conformance` | None |
| **lint** | `./run_stage.sh lint` | None |
| **static_analysis** | `./run_stage.sh static_analysis` | None |
| **unit** | `./run_stage.sh unit` | None |
| **integration** | `./run_stage.sh integration` | PostgreSQL, Redis |
| **security** | `./run_stage.sh security` | None |
| **migration_verify** | `./run_stage.sh migration_verify` | PostgreSQL |
| **package_build** | `./run_stage.sh package_build` | Docker |
| **release_readiness** | `./run_stage.sh release_readiness` | None |

---

## Agent Integration

Agents consume preflight reports to focus on non-scriptable judgment.

### Workflow

```
1. Developer runs: bash .pi/scripts/ci/run_preflight.sh --json
2. Report generated: preflight_report.json
3. Agent invoked with report as context
4. Agent focuses on judgment rules only
5. Agent output validated: bash .pi/scripts/ci/validate_agent_output.sh
```

### Example Agent Prompt

```markdown
## Context

Preflight validation completed. Report:

```json
{
  "status": "pass",
  "stages_run": ["static_analysis", "lint"],
  "summary": {"passed": 6, "failed": 0}
}
```

## Task

All deterministic checks passed. Focus on:
- Architecture judgment (rules 1-9, 12-16, 18-20)
- Scope-fit assessment
- Evidence quality
- Recommendation prioritization

Do NOT re-check:
- Lint (already validated by biome)
- Type errors (already validated by tsc)
- File structure (already validated by check_file_structure.sh)
```

---

## Validation Scripts

### validate_agent_output.sh

Validates agent-generated output for schema compliance, consistency, and completeness.

```bash
# Validate architecture validator output
bash .pi/scripts/ci/validate_agent_output.sh \
  --input=architecture_validator_output.md \
  --schema=architecture-validator

# Validate epic plan
bash .pi/scripts/ci/validate_agent_output.sh \
  --input=epic_plan.md \
  --schema=epic-plan

# Validate issue draft
bash .pi/scripts/ci/validate_agent_output.sh \
  --input=issue_draft.md \
  --schema=issue-draft

# JSON output
bash .pi/scripts/ci/validate_agent_output.sh \
  --input=output.md \
  --json
```

**Checks:**
- ✅ Required sections present
- ✅ No internal contradictions
- ✅ Decision consistency
- ✅ Acceptance criteria evaluated
- ✅ Canonical references verified

---

## Service Detection

Scripts automatically detect available services and skip dependent checks:

```
[INFO] PostgreSQL available - running migration checks

[WARN] Redis not available - skipping integration tests
[WARN] Run in CI or start Redis locally: docker run -d redis:7
```

### Local Service Setup

For full local testing:

```bash
# PostgreSQL
docker run -d \
  --name guardian-postgres \
  -e POSTGRES_PASSWORD=test \
  -p 5432:5432 \
  postgres:16

# Redis
docker run -d \
  --name guardian-redis \
  -p 6379:6379 \
  redis:7

# Run integration tests
bash .pi/scripts/ci/run_stage.sh integration
```

---

## IDE Integration

### VS Code Tasks

Add to `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Run Guardian Preflight",
      "type": "shell",
      "command": "bash .pi/scripts/ci/run_preflight.sh",
      "group": "test",
      "presentation": {
        "reveal": "always"
      }
    },
    {
      "label": "Run Guardian Security Checks",
      "type": "shell",
      "command": "bash .pi/scripts/ci/run_stage.sh security",
      "group": "test"
    },
    {
      "label": "Run Guardian Architecture Conformance",
      "type": "shell",
      "command": "bash .pi/scripts/ci/run_stage.sh architecture_conformance",
      "group": "test"
    }
  ]
}
```

---

## Metrics

Track your local validation success rate:

```bash
# Check preflight status
bash .pi/scripts/ci/run_preflight.sh --json | jq '.status'

# Track failures
bash .pi/scripts/ci/run_preflight.sh --json | jq '.summary.failed'

# View full report
cat preflight_report.json | jq .
```

**Target:** >95% pass rate before first push.

---

## Troubleshooting

### Script Not Found

```
✗ Script not found: .pi/scripts/ci/check_mr_traceability.sh
```

**Fix:** Run `guardian init` or ensure `.pi/scripts/ci/` exists with the required scripts.

### Permission Denied

```
bash: .pi/scripts/ci/run_preflight.sh: Permission denied
```

**Fix:**

```bash
chmod +x .pi/scripts/ci/*.sh
```

### No Test Runner Found

```
⊘ No test runner found
```

**Fix:** Install the test runner for your language:
- Python: `pip install pytest`
- TypeScript: `npm install -g bun` or use `npm test`
- Rust: `rustup component add rust-src`
- Go: `go install`

### PostgreSQL Not Available

```
[WARN] PostgreSQL not available - skipping migration checks
```

**Fix:**

```bash
docker run -d --name postgres -e POSTGRES_PASSWORD=test -p 5432:5432 postgres:16
```

---

## See Also

- [guardian-architect-usage.md](guardian-architect-usage.md) — Complete Guardian Architect guide
- [guardian-framework-design.md](guardian-framework-design.md) — Design specification
- [architecture.md](architecture.md) — Architecture document
