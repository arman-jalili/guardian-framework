#!/usr/bin/env bash
# ============================================================================
# validate-security.sh — Automated Security Scanner
#
# Run as: bash .pi/scripts/validate-security.sh [src_dir]
# Exit codes: 0 = PASS, 1 = FAIL
# ============================================================================
set -euo pipefail

SRC_DIR="${1:-src}"
ERRORS=()
WARNINGS=()
PASS_COUNT=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✅ PASS${NC} $1"; ((PASS_COUNT++)); }
fail() { echo -e "${RED}❌ FAIL${NC} $1"; ERRORS+=("$1"); }
warn() { echo -e "${YELLOW}⚠️  WARN${NC} $1"; WARNINGS+=("$1"); }

echo "============================================"
echo "  Security Validation (Automated)"
echo "============================================"
echo ""

# ---------------------------------------------------------------------------
# Hardcoded Secrets
# ---------------------------------------------------------------------------
echo "--- Hardcoded Secrets ---"
SECRETS=$(grep -rnE "(password|secret|api_key|token|api_secret)\s*=\s*[\"'][^\"']{8,}" "$SRC_DIR" 2>/dev/null | grep -v "test" | grep -v "_test\." | grep -v "\.env" || true)
if [ -z "$SECRETS" ]; then
    pass "No hardcoded secrets detected"
else
    fail "Potential hardcoded secrets found:"
    echo "$SECRETS" | head -5
fi

# ---------------------------------------------------------------------------
# Command Injection
# ---------------------------------------------------------------------------
echo ""
echo "--- Command Injection ---"
CMD_INJECT=$(grep -rn "Command::new.*format!\|exec(.*\+\|subprocess.*shell=True" "$SRC_DIR" 2>/dev/null || true)
if [ -z "$CMD_INJECT" ]; then
    pass "No command injection patterns detected"
else
    fail "Potential command injection:"
    echo "$CMD_INJECT" | head -5
fi

# ---------------------------------------------------------------------------
# Path Traversal
# ---------------------------------------------------------------------------
echo ""
echo "--- Path Traversal ---"
PATH_TRAVERSAL=$(grep -rn "\.\./\|\.\.\\\\" "$SRC_DIR" 2>/dev/null | grep -v "test" | grep -v "canonicalize\|starts_with\|validate_path" || true)
if [ -z "$PATH_TRAVERSAL" ]; then
    pass "No path traversal vulnerabilities detected"
else
    warn "Potential path traversal patterns (verify canonicalize + starts_with):"
    echo "$PATH_TRAVERSAL" | head -5
fi

# ---------------------------------------------------------------------------
# Security Audit
# ---------------------------------------------------------------------------
echo ""
echo "--- Dependency Audit ---"
if command -v cargo-audit &> /dev/null; then
    if cargo audit 2>&1; then
        pass "No known vulnerabilities in dependencies"
    else
        fail "Vulnerable dependencies detected"
    fi
else
    warn "cargo-audit not installed, skipping audit"
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

echo -e "${GREEN}All security checks passed.${NC}"
exit 0
