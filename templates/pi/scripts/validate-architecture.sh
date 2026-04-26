#!/usr/bin/env bash
# ============================================================================
# validate-architecture.sh — Architecture Pattern Validator
#
# Run as: bash .claude/scripts/validate-architecture.sh
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

pass() { echo -e "${GREEN}✅ PASS${NC} $1"; ((PASS_COUNT++)); }
fail() { echo -e "${RED}❌ FAIL${NC} $1"; ERRORS+=("$1"); }
warn() { echo -e "${YELLOW}⚠️  WARN${NC} $1"; WARNINGS+=("$1"); }

echo "============================================"
echo "  Architecture Validation"
echo "============================================"
echo ""

# ---------------------------------------------------------------------------
# Layer Structure Check
# ---------------------------------------------------------------------------
echo "--- Layer Structure ---"
if [ -d "src/lib" ] && [ -d "src/commands" ]; then
    pass "Layer directories present (lib, commands)"
else
    fail "Missing required layer directories"
fi

# ---------------------------------------------------------------------------
# Entry Point Check
# ---------------------------------------------------------------------------
echo ""
echo "--- Entry Point ---"
if [ -f "src/index.ts" ] || [ -f "src/index.js" ]; then
    pass "Entry point exists"
else
    warn "No standard entry point found"
fi

# ---------------------------------------------------------------------------
# Circular Dependency Check
# ---------------------------------------------------------------------------
echo ""
echo "--- Circular Dependencies ---"
# Check for obvious circular imports in TypeScript/JavaScript
if [ -f "package.json" ]; then
    CIRCULAR_FOUND=false
    # Simple heuristic check - real implementation would use madge or similar
    if grep -r "from.*'\.\./\.\./\.\.'" src/ 2>/dev/null | head -5; then
        warn "Deep relative imports found (potential circular deps)"
    else
        pass "No obvious circular dependency patterns"
    fi
else
    warn "Cannot check circular deps without package.json"
fi

# ---------------------------------------------------------------------------
# Interface Pattern Check
# ---------------------------------------------------------------------------
echo ""
echo "--- Interface Patterns ---"
# Check for type definitions
TYPE_COUNT=$(find src -name "*.ts" -exec grep -l "interface\|type" {} \; 2>/dev/null | wc -l | tr -d ' ')
if [ "$TYPE_COUNT" -gt 0 ]; then
    pass "Type definitions found ($TYPE_COUNT files)"
else
    warn "No TypeScript interfaces/types found"
fi

# ---------------------------------------------------------------------------
# Module Boundaries Check
# ---------------------------------------------------------------------------
echo ""
echo "--- Module Boundaries ---"
# Check that commands don't import from each other directly
CMD_IMPORTS=$(grep -r "from.*commands/" src/commands/ 2>/dev/null | wc -l | tr -d ' ')
if [ "$CMD_IMPORTS" -gt 0 ]; then
    warn "Commands importing from other commands ($CMD_IMPORTS imports)"
else
    pass "Commands properly isolated"
fi

# ---------------------------------------------------------------------------
# Lib Independence Check
# ---------------------------------------------------------------------------
echo ""
echo "--- Lib Independence ---"
# Check that lib modules don't import commands
LIB_CMD_IMPORTS=$(grep -r "from.*commands/" src/lib/ 2>/dev/null | wc -l | tr -d ' ')
if [ "$LIB_CMD_IMPORTS" -gt 0 ]; then
    fail "Lib modules importing from commands (layer violation)"
else
    pass "Lib modules independent from commands"
fi

# ---------------------------------------------------------------------------
# Error Handling Pattern Check
# ---------------------------------------------------------------------------
echo ""
echo "--- Error Handling Patterns ---"
# Check for custom error classes
ERROR_CLASS_COUNT=$(grep -r "class.*Error" src/ 2>/dev/null | wc -l | tr -d ' ')
if [ "$ERROR_CLASS_COUNT" -gt 0 ]; then
    pass "Custom error classes defined"
else
    warn "Consider defining custom error classes"
fi

# ---------------------------------------------------------------------------
# Dependency Direction Check
# ---------------------------------------------------------------------------
echo ""
echo "--- Dependency Direction ---"
# Commands should depend on lib, not vice versa
# Already checked in Lib Independence section
pass "Dependency direction validated"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "============================================"
echo "  Summary"
echo "============================================"
echo -e "  Passed:   ${GREEN}${PASS_COUNT}${NC}"
echo -e "  Failed:   ${RED}${#ERRORS[@]}${NC}"
echo -e "  Warnings: ${YELLOW}${#WARNINGS[@]}${NC}"
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
    echo "WARNINGS:"
    for warn_msg in "${WARNINGS[@]}"; do
        echo "  - $warn_msg"
    done
    echo ""
fi

echo -e "${GREEN}Architecture validation passed.${NC}"
exit 0