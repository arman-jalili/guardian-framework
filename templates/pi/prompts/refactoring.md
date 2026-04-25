# Refactoring Workflow

**Scope:** Moderate, Complex
**Optimized for:** Safety — behavior must not change

## Flow

```
Refactor Request
    │
    ▼
┌─────────────────────────────────┐
│ 1. COORDINATOR: Classify scope  │
│    Determine affected modules   │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│ 2. CODE-DEVELOPER: Baseline     │
│    Run all tests, record output │
│    Run all validators, cache    │
│    bash .claude/scripts/validation-cache.sh init <task-id>
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│ 3. ARCHITECTURE-VALIDATOR: Plan │
│    Review refactor approach     │
│    Ensure patterns preserved    │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│ 4. CODE-DEVELOPER: Refactor     │
│    Small commits, one change at │
│    a time                       │
│    Run tests after each change  │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│ 5. AUTOMATED: Verify no regress │
│    • validate-ci.sh             │
│    • validate-tests.sh          │
│    • validate-operations.sh     │
│    Compare with baseline        │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│ 6. ARCHITECTURE-VALIDATOR: Wire │
│    Verify wiring still correct  │
│    • Callers exist              │
│    • No duplicates              │
│    • Modules used               │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│ 7. CI-MR: Create PR + merge     │
└─────────────────────────────────┘
```

## Rules

- **Behavior must not change** — all tests must pass with identical output
- **Small commits** — one logical change per commit for easy revert
- **Baseline first** — record test output before refactoring
- **Wiring verification** — ensure all callers still work after refactor

## Commands

```bash
# Baseline
bash .claude/scripts/validate-ci.sh
bash .claude/scripts/validate-tests.sh
bash .claude/scripts/validate-operations.sh [src_dir]

# Validation cache
bash .claude/scripts/validation-cache.sh init <task-id>
bash .claude/scripts/validation-cache.sh summary <task-id>
```
