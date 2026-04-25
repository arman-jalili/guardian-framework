#!/usr/bin/env bash
# ============================================================================
# merge-mr.sh — Merge MR and Close Implemented Issues
#
# Run as: bash .claude/scripts/merge-mr.sh [pr-number] [issue-list]
# ============================================================================
set -euo pipefail

PR_NUMBER="${1:-}"
ISSUE_LIST="${2:-}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "============================================"
echo "  Merge MR and Close Issues"
echo "============================================"
echo ""

# ---------------------------------------------------------------------------
# Check GitHub CLI
# ---------------------------------------------------------------------------
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI (gh) not installed${NC}"
    exit 1
fi

# ---------------------------------------------------------------------------
# Get PR Number
# ---------------------------------------------------------------------------
if [ -z "$PR_NUMBER" ]; then
    PR_NUMBER=$(gh pr view --json number -q '.number' 2>/dev/null || echo "")
    if [ -z "$PR_NUMBER" ]; then
        echo -e "${RED}❌ PR number required${NC}"
        exit 1
    fi
fi

# ---------------------------------------------------------------------------
# Validate PR Status
# ---------------------------------------------------------------------------
PR_INFO=$(gh pr view "$PR_NUMBER" --json state,mergeable,statusCheckRollup 2>/dev/null)
PR_STATE=$(echo "$PR_INFO" | jq -r '.state')
PR_MERGEABLE=$(echo "$PR_INFO" | jq -r '.mergeable')

echo "PR #$PR_NUMBER"
echo "State: $PR_STATE"
echo "Mergeable: $PR_MERGEABLE"
echo ""

if [ "$PR_STATE" != "OPEN" ]; then
    echo -e "${YELLOW}⚠️  PR is not open (state: $PR_STATE)${NC}"
    exit 0
fi

if [ "$PR_MERGEABLE" != "MERGEABLE" ]; then
    echo -e "${RED}❌ PR is not mergeable${NC}"
    echo "Run: .claude/scripts/mr-validation.sh first"
    exit 1
fi

# ---------------------------------------------------------------------------
# Run Final Validation
# ---------------------------------------------------------------------------
echo "--- Final Validation ---"

if [ -f ".claude/scripts/mr-validation.sh" ]; then
    bash .claude/scripts/mr-validation.sh "$PR_NUMBER" || {
        echo -e "${RED}❌ MR validation failed${NC}"
        exit 1
    }
fi

# ---------------------------------------------------------------------------
# Merge PR
# ---------------------------------------------------------------------------
echo ""
echo "Merging PR..."

gh pr merge "$PR_NUMBER" \
    --squash \
    --delete-branch \
    --body "Merged after validation passed" 2>&1 || {
    echo -e "${YELLOW}⚠️  Merge may require approval${NC}"
    echo "  Check: gh pr view $PR_NUMBER"
    exit 0
}

echo -e "${GREEN}✅ PR merged${NC}"

# ---------------------------------------------------------------------------
# Close Issues
# ---------------------------------------------------------------------------
if [ -n "$ISSUE_LIST" ]; then
    echo ""
    echo "--- Closing Issues ---"

    for ISSUE in $(echo "$ISSUE_LIST" | tr ',' ' '); do
        echo "Closing #$ISSUE..."
        gh issue close "$ISSUE" \
            --comment "Implemented in PR #$PR_NUMBER" 2>/dev/null || {
            warn "Could not close #$ISSUE"
        }
    done
fi

# ---------------------------------------------------------------------------
# Return to Main
# ---------------------------------------------------------------------------
echo ""
echo "Returning to main branch..."
git checkout main 2>/dev/null || true
git pull origin main 2>/dev/null || true

echo ""
echo "============================================"
echo "  Complete"
echo "============================================"
echo -e "${GREEN}PR #$PR_NUMBER merged${NC}"
if [ -n "$ISSUE_LIST" ]; then
    echo "Issues closed: $ISSUE_LIST"
fi

exit 0