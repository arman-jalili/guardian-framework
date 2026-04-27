#!/usr/bin/env bash
# ============================================================================
# validate-operations.sh — Automated Operations Validator
#
# Replaces LLM-based operations-validator for routine checks.
# Run as: bash .pi/scripts/validate-operations.sh [src_dir]
#
# Exit codes: 0 = PASS, 1 = FAIL
# ============================================================================
set -euo pipefail

SRC_DIR="${1:-src}"
ERRORS=()
WARNINGS=()
PASS_COUNT=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✅ PASS${NC} $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo -e "${RED}❌ FAIL${NC} $1"; ERRORS+=("$1"); }
warn() { echo -e "${YELLOW}⚠️  WARN${NC} $1"; WARNINGS+=("$1"); }

echo "============================================"
echo "  Operations Validation (Automated)"
echo "============================================"
echo ""

# ---------------------------------------------------------------------------
# 1. Tracing Coverage — public functions should have instrumentation
# ---------------------------------------------------------------------------
echo "--- Tracing Coverage ---"
if grep -rq "#\[instrument\]" "$SRC_DIR" 2>/dev/null; then
    COUNT=$(grep -r "#\[instrument\]" "$SRC_DIR" 2>/dev/null | wc -l | tr -d ' ')
    pass "Found $COUNT instrumented functions"
else
    warn "No #[instrument] attributes found (may be intentional for small projects)"
fi

# ---------------------------------------------------------------------------
# 2. Cancellation Handling — async code should check cancellation
# ---------------------------------------------------------------------------
echo ""
echo "--- Cancellation Handling ---"
if grep -rq "cancel_token\|CancellationToken\|is_cancelled\|cancelled()" "$SRC_DIR" 2>/dev/null; then
    COUNT=$(grep -r "cancel_token\|CancellationToken\|is_cancelled\|cancelled()" "$SRC_DIR" 2>/dev/null | wc -l | tr -d ' ')
    pass "Found $COUNT cancellation references"
else
    warn "No cancellation handling found (may be intentional for sync-only projects)"
fi

# ---------------------------------------------------------------------------
# 3. Atomic Writes — persistent writes should use write-rename pattern
# ---------------------------------------------------------------------------
echo ""
echo "--- Atomic Writes ---"
if grep -rq "fs::rename\|os.rename\|File.Move\|atomic_write\|tempfile" "$SRC_DIR" 2>/dev/null; then
    pass "Atomic write pattern detected"
else
    warn "No atomic write pattern detected (verify if file persistence is used)"
fi

# ---------------------------------------------------------------------------
# 4. No Unwrap in Production Code
# ---------------------------------------------------------------------------
echo ""
echo "--- No unwrap() in Production ---"
UNWRAPS=$(grep -rn "\.unwrap()" "$SRC_DIR" 2>/dev/null | grep -v "#\[cfg(test)\]" | grep -v "test" | grep -v "_test\." || true)
if [ -z "$UNWRAPS" ]; then
    pass "No unwrap() in production code"
else
    fail "Found unwrap() in production code:"
    echo "$UNWRAPS" | head -5
fi

# ---------------------------------------------------------------------------
# 5. No O(N²) Patterns (language-agnostic: look for nested iteration over same collection)
# ---------------------------------------------------------------------------
echo ""
echo "--- Performance: No Obvious O(N²) ---"
# This is a heuristic — catches .iter().filter().collect() inside loops
if grep -rq "\.iter()\.filter\|\.iter()\.find\|\.iter()\.any\|\.iter()\.position" "$SRC_DIR" 2>/dev/null; then
    COUNT=$(grep -rn "\.iter()\.filter\|\.iter()\.find" "$SRC_DIR" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$COUNT" -gt 10 ]; then
        warn "Found $COUNT .iter().filter/find calls — verify none are in hot paths (O(N) where O(1) expected)"
    else
        pass "Iterative operations within normal range ($COUNT occurrences)"
    fi
else
    pass "No obvious O(N²) patterns detected"
fi

# ---------------------------------------------------------------------------
# 6. Resource Management — check for Drop/Dispose/cleanup patterns
# ---------------------------------------------------------------------------
echo ""
echo "--- Resource Management ---"
if grep -rq "impl Drop\|impl.*Drop\|__del__\|Dispose\|cleanup\|teardown" "$SRC_DIR" 2>/dev/null; then
    pass "Resource cleanup patterns detected"
else
    warn "No explicit resource cleanup found (may use RAII or GC)"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "============================================"
echo "  Summary"
echo "============================================"
echo -e "  Passed:   ${GREEN}${PASS_COUNT}${NC}"
echo -e "  Warnings: ${YELLOW}${#WARNINGS[@]}${NC}"
echo -e "  Failed:   ${RED}${#ERRORS[@]}${NC}"
echo ""

if [ ${#ERRORS[@]} -gt 0 ]; then
    echo "FAILURES:"
    for err in "${ERRORS[@]}"; do
        echo "  - $err"
    done
    echo ""
    exit 1
fi

if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo "WARNINGS (non-blocking):"
    for w in "${WARNINGS[@]}"; do
        echo "  - $w"
    done
    echo ""
fi

echo -e "${GREEN}All operations checks passed.${NC}"
exit 0
