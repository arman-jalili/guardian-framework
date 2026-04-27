#!/usr/bin/env bash
# ============================================================================
# validate-tests.sh — Automated Test Validator
#
# Run as: bash .pi/scripts/validate-tests.sh
# Exit codes: 0 = PASS, 1 = FAIL
# ============================================================================
set -euo pipefail

ERRORS=()
WARNINGS=()
PASS_COUNT=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✅ PASS${NC} $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo -e "${RED}❌ FAIL${NC} $1"; ERRORS+=("$1"); }
warn() { echo -e "${YELLOW}⚠️  WARN${NC} $1"; WARNINGS+=("$1"); }

echo "============================================"
echo "  Test Validation (Automated)"
echo "============================================"
echo ""

# ---------------------------------------------------------------------------
# Unit Tests
# ---------------------------------------------------------------------------
echo "--- Unit Tests ---"
if [test command] 2>/dev/null; then
    pass "All unit tests passed"
else
    fail "Unit tests failed"
fi

# ---------------------------------------------------------------------------
# Architecture Contract Tests
# ---------------------------------------------------------------------------
echo ""
echo "--- Architecture Contracts ---"
if [contract test command] 2>/dev/null; then
    pass "Architecture contracts satisfied"
else
    fail "Architecture contract violations detected"
fi

# ---------------------------------------------------------------------------
# Integration Tests
# ---------------------------------------------------------------------------
echo ""
echo "--- Integration Tests ---"
if [integration test command] 2>/dev/null; then
    pass "All integration tests passed"
else
    fail "Integration tests failed"
fi

# ---------------------------------------------------------------------------
# E2E Tests
# ---------------------------------------------------------------------------
echo ""
echo "--- E2E Tests ---"
if [e2e test command] 2>/dev/null; then
    pass "All E2E tests passed"
else
    fail "E2E tests failed"
fi

# ---------------------------------------------------------------------------
# Coverage
# ---------------------------------------------------------------------------
echo ""
echo "--- Coverage ---"
COVERAGE_OUTPUT=$([coverage command] 2>&1 || true)
COVERAGE_PCT=$(echo "$COVERAGE_OUTPUT" | grep -oP '\d+\.\d+%' | tail -1 | tr -d '%' || echo "0")
if [ "$(echo "$COVERAGE_PCT >= 80" | bc -l 2>/dev/null || echo 0)" -eq 1 ]; then
    pass "Coverage: ${COVERAGE_PCT}% (≥ 80%)"
else
    warn "Coverage: ${COVERAGE_PCT}% (below 80% target)"
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

echo -e "${GREEN}All test validations passed.${NC}"
exit 0
