#!/usr/bin/env bash
# ============================================================================
# validate-ci.sh — Automated CI/MR Validator
#
# Run as: bash .pi/scripts/validate-ci.sh
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
echo "  CI/MR Validation (Automated)"
echo "============================================"
echo ""

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
echo "--- Build ---"
if python -m build 2>/dev/null; then
    pass "Build succeeded"
else
    fail "Build failed"
fi

# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------
echo ""
echo "--- Tests ---"
if pytest 2>/dev/null; then
    pass "All tests passed"
else
    fail "Tests failed"
fi

# ---------------------------------------------------------------------------
# Lint
# ---------------------------------------------------------------------------
echo ""
echo "--- Lint ---"
if ruff check . 2>/dev/null; then
    pass "Lint passed"
else
    fail "Lint failed"
fi

# ---------------------------------------------------------------------------
# Format
# ---------------------------------------------------------------------------
echo ""
echo "--- Format ---"
if ruff format --check . 2>/dev/null; then
    pass "Format check passed"
else
    fail "Format check failed"
fi

# ---------------------------------------------------------------------------
# Security Audit
# ---------------------------------------------------------------------------
echo ""
echo "--- Security Audit ---"
if pip-audit 2>/dev/null; then
    pass "Security audit passed"
else
    fail "Security audit failed"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "============================================"
echo "  Summary"
echo "============================================"
echo -e "  Passed:   ${GREEN}${PASS_COUNT}${NC}"
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

echo -e "${GREEN}All CI checks passed. Ready for merge review.${NC}"
exit 0
