#!/usr/bin/env bash
# ============================================================================
# validate-canonical.sh — Canonical Reference Validator
#
# Run as: bash .pi/scripts/validate-canonical.sh
# Exit codes: 0 = PASS, 1 = FAIL
#
# Validates that implementation files have proper canonical references
# pointing to architecture documentation (.pi/architecture/)
# ============================================================================
set -euo pipefail

ERRORS=()
WARNINGS=()
PASS_COUNT=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

pass() { echo -e "${GREEN}✅ PASS${NC} $1"; ((PASS_COUNT++)); }
fail() { echo -e "${RED}❌ FAIL${NC} $1"; ERRORS+=("$1"); }
warn() { echo -e "${YELLOW}⚠️  WARN${NC} $1"; WARNINGS+=("$1"); }
info() { echo -e "${BLUE}ℹ️  INFO${NC} $1"; }

echo "============================================"
echo "  Canonical Reference Validation"
echo "============================================"
echo ""

# ---------------------------------------------------------------------------
# Architecture Documentation Check
# ---------------------------------------------------------------------------
echo "--- Architecture Documentation ---"

# Check architecture directories exist
for dir in architecture/modules architecture/diagrams architecture/decisions; do
  if [ -d ".pi/$dir" ]; then
    pass ".pi/$dir directory exists"
  else
    warn ".pi/$dir directory missing (create for architecture docs)"
  fi
done

# Check CHANGELOG exists
if [ -f ".pi/architecture/CHANGELOG.md" ]; then
  pass "Architecture CHANGELOG.md exists"

  # Check for pending changes
  PENDING=$(grep -c "Status.*pending" .pi/architecture/CHANGELOG.md 2>/dev/null || echo "0")
  if [ "$PENDING" -gt 0 ]; then
    warn "$PENDING architecture changes pending sync - check CHANGELOG.md"
  else
    pass "No pending architecture changes"
  fi
else
  fail "Architecture CHANGELOG.md missing (required for change tracking)"
fi

# ---------------------------------------------------------------------------
# Check Blueprint Files
# ---------------------------------------------------------------------------
echo ""
echo "--- Blueprint Files (.pi/) ---"

for file in .pi/**/*.md .pi/*.md; do
  if [ -f "$file" ]; then
    # Skip architecture files - they are source, not generated
    if [[ "$file" == *".pi/architecture/"* ]]; then
      if grep -q "Canonical Reference:" "$file" 2>/dev/null; then
        ref=$(grep "Canonical Reference:" "$file" | head -1 | grep -o '.pi/[^"]*' | head -1)
        if [ "$ref" = "$file" ] || [ "$ref" = "${file#./}" ]; then
          pass "$file has correct self-reference"
        fi
      fi
      continue
    fi

    # Blueprint files are SOURCE, not generated - should NOT have "Generated:" header
    if grep -q "Generated:" "$file" 2>/dev/null; then
      if grep -q "Generated: NEVER" "$file" 2>/dev/null; then
        pass "$file correctly marked as source"
      else
        warn "$file has Generated header but is blueprint (should be source)"
      fi
    fi
  fi
done

# ---------------------------------------------------------------------------
# Check Generated Exports
# ---------------------------------------------------------------------------
echo ""
echo "--- Generated Exports (.claude/, .opencode/) ---"

for file in .claude/**/*.md .claude/*.md .opencode/**/*.md .opencode/*.md; do
  if [ -f "$file" ]; then
    # Generated files must have canonical reference pointing to blueprint
    if grep -q "Canonical Reference:" "$file" 2>/dev/null; then
      ref=$(grep "Canonical Reference:" "$file" | head -1 | grep -o '.pi/[^"]*' | head -1)
      if [ -n "$ref" ]; then
        if [ -f "$ref" ]; then
          # Check that DO NOT EDIT directive exists
          if grep -q "DO NOT EDIT" "$file" 2>/dev/null; then
            pass "$file → $ref (valid reference)"
          else
            warn "$file has reference but missing DO NOT EDIT directive"
          fi
        else
          fail "$file references non-existent blueprint: $ref"
        fi
      else
        fail "$file has canonical reference but could not extract .pi/ path"
      fi
    else
      warn "$file missing canonical reference header"
    fi
  fi
done

# ---------------------------------------------------------------------------
# Check Implementation Files
# ---------------------------------------------------------------------------
echo ""
echo "--- Implementation Files (src/) ---"

# Find source files
for file in src/**/*.ts src/**/*.js src/**/*.tsx src/**/*.jsx src/**/*.py src/**/*.go src/**/*.rs; do
  if [ -f "$file" ]; then
    # Implementation files should reference architecture modules
    if grep -q "Canonical Reference:" "$file" 2>/dev/null; then
      # Extract the reference
      ref=$(grep "Canonical Reference:" "$file" | head -1)

      # Check if it points to architecture module
      if echo "$ref" | grep -q "architecture/modules"; then
        # Extract module path
        ref_path=$(echo "$ref" | grep -o '.pi/architecture/modules/[^:#]*' | head -1)

        if [ -n "$ref_path" ]; then
          if [ -f "$ref_path" ]; then
            # Check if there's a specific section reference
            if echo "$ref" | grep -q "#"; then
              section=$(echo "$ref" | grep -o '#[^"]*' | head -1 | sed 's/^#//')
              if grep -q "##.*$section" "$ref_path" 2>/dev/null || grep -q "###.*$section" "$ref_path" 2>/dev/null; then
                pass "$file → architecture/modules/$section (valid)"
              else
                warn "$file → $ref_path#$section (section may not exist)"
              fi
            else
              pass "$file → $ref_path (architecture module exists)"
            fi
          else
            fail "$file references non-existent architecture module: $ref_path"
          fi
        fi
      elif echo "$ref" | grep -q ".pi/"; then
        # Reference to other blueprint section (patterns, etc) - also valid
        ref_path=$(echo "$ref" | grep -o '.pi/[^:#]*' | head -1)
        if [ -f "$ref_path" ]; then
          pass "$file → $ref_path (blueprint reference)"
        else
          fail "$file references non-existent blueprint: $ref_path"
        fi
      else
        warn "$file has canonical reference but not pointing to architecture: $ref"
      fi
    else
      # Track files without canonical reference
      info "$file missing canonical reference (consider adding architecture ref)"
    fi
  fi
done

# ---------------------------------------------------------------------------
# Coverage Statistics
# ---------------------------------------------------------------------------
echo ""
echo "--- Coverage Statistics ---"

# Count blueprint files
BLUEPRINT_COUNT=$(find .pi -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
echo "Blueprint files: $BLUEPRINT_COUNT"

# Count generated files with canonical refs
GEN_WITH_REF=0
GEN_TOTAL=0
for file in .claude/**/*.md .opencode/**/*.md; do
  if [ -f "$file" ]; then
    ((GEN_TOTAL++))
    if grep -q "Canonical Reference:" "$file" 2>/dev/null; then
      ((GEN_WITH_REF++))
    fi
  fi
done

if [ "$GEN_TOTAL" -gt 0 ]; then
  COVERAGE=$((GEN_WITH_REF * 100 / GEN_TOTAL))
  echo "Generated files with canonical ref: $GEN_WITH_REF/$GEN_TOTAL ($COVERAGE%)"
fi

# Count implementation files with canonical refs
SRC_WITH_REF=0
SRC_TOTAL=0
for file in src/**/*.ts src/**/*.js src/**/*.py src/**/*.go src/**/*.rs; do
  if [ -f "$file" ]; then
    ((SRC_TOTAL++))
    if grep -q "Canonical Reference:" "$file" 2>/dev/null; then
      ((SRC_WITH_REF++))
    fi
  fi
done

if [ "$SRC_TOTAL" -gt 0 ]; then
  SRC_COVERAGE=$((SRC_WITH_REF * 100 / SRC_TOTAL))
  echo "Implementation files with canonical ref: $SRC_WITH_REF/$SRC_TOTAL ($SRC_COVERAGE%)"

  if [ "$SRC_COVERAGE" -lt 50 ]; then
    warn "Low canonical reference coverage ($SRC_COVERAGE%) - consider adding references"
  fi
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
    echo "WARNINGS (recommend fixing):"
    for warn_msg in "${WARNINGS[@]}"; do
        echo "  - $warn_msg"
    done
    echo ""
fi

echo -e "${GREEN}Canonical reference validation passed.${NC}"
echo ""
echo "Canonical Reference Format Guide:"
echo "  Architecture:     'Canonical Reference: .pi/architecture/modules/[module].md#[section]'"
echo "  Blueprint source: 'Canonical Reference: .pi/[path]/file.md (self)'"
echo "  Generated files:  'Canonical Reference: .pi/[source].md + DO NOT EDIT'"
echo "  Implementation:   'Canonical Reference: .pi/architecture/modules/[module].md#[section]'"
echo ""
echo "Architecture Change Tracking:"
echo "  - Check .pi/architecture/CHANGELOG.md for pending changes"
echo "  - Run /blueprint-update after implementing architecture changes"
exit 0