#!/usr/bin/env bash
# ============================================================================
# create-mr.sh — Create Merge Request/PR for Issue Implementation
#
# Run as: bash .pi/scripts/create-mr.sh <branch-name> [issue-list]
# ============================================================================
set -euo pipefail

BRANCH_NAME="${1:-}"
ISSUE_LIST="${2:-}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "============================================"
echo "  Create Merge Request"
echo "============================================"
echo ""

# ---------------------------------------------------------------------------
# Validate Input
# ---------------------------------------------------------------------------
if [ -z "$BRANCH_NAME" ]; then
    # Try to detect from current branch
    BRANCH_NAME=$(git branch --show-current)
    if [ -z "$BRANCH_NAME" ] || [ "$BRANCH_NAME" = "main" ]; then
        echo -e "${RED}❌ Branch name required${NC}"
        echo "Usage: create-mr.sh <branch-name> [issue-list]"
        echo "  issue-list: comma-separated (e.g., 123,124,125)"
        exit 1
    fi
    echo "Using current branch: $BRANCH_NAME"
fi

# ---------------------------------------------------------------------------
# Check Git State
# ---------------------------------------------------------------------------
if ! git rev-parse --is-inside-work-tree &> /dev/null; then
    echo -e "${RED}❌ Not in a git repository${NC}"
    exit 1
fi

# Check branch exists
if ! git show-ref --verify --quiet refs/heads/"$BRANCH_NAME"; then
    echo -e "${RED}❌ Branch not found: $BRANCH_NAME${NC}"
    exit 1
fi

# ---------------------------------------------------------------------------
# Check GitHub CLI
# ---------------------------------------------------------------------------
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI (gh) not installed${NC}"
    exit 1
fi

# ---------------------------------------------------------------------------
# Check Commits
# ---------------------------------------------------------------------------
# Switch to branch
git checkout "$BRANCH_NAME" 2>/dev/null || true

# Check for commits ahead of base
BASE_BRANCH="main"
COMMITS_AHEAD=$(git rev-list --count "origin/$BASE_BRANCH"..HEAD 2>/dev/null || echo "0")

if [ "$COMMITS_AHEAD" -eq 0 ]; then
    echo -e "${RED}❌ No commits to merge${NC}"
    echo "  Make commits before creating MR"
    exit 1
fi

echo "Commits ahead: $COMMITS_AHEAD"
git log --oneline "origin/$BASE_BRANCH"..HEAD | head -10

# ---------------------------------------------------------------------------
# Run Pre-MR Validation
# ---------------------------------------------------------------------------
echo ""
echo "--- Pre-MR Validation ---"

if [ -f ".pi/scripts/validate-ci.sh" ]; then
    bash .pi/scripts/validate-ci.sh || {
        echo -e "${RED}❌ CI validation failed${NC}"
        echo "Fix issues before creating MR"
        exit 1
    }
else
    echo -e "${YELLOW}⚠️  CI script not found, running basic checks${NC}"
    cargo build && cargo test --all && cargo clippy -- -D warnings || {
        echo -e "${RED}❌ Basic checks failed${NC}"
        exit 1
    }
fi

# ---------------------------------------------------------------------------
# Push Branch
# ---------------------------------------------------------------------------
echo ""
echo "Pushing branch..."
git push -u origin "$BRANCH_NAME" 2>&1 || {
    echo -e "${RED}❌ Push failed${NC}"
    exit 1
}

# ---------------------------------------------------------------------------
# Generate PR Body
# ---------------------------------------------------------------------------
PR_BODY_FILE=".claude/plans/$BRANCH_NAME-pr-body.md"

# Extract commits for description
COMMIT_LOG=$(git log --oneline "origin/$BASE_BRANCH"..HEAD)

cat > "$PR_BODY_FILE" << EOF
## Summary

Implements the following issues:

EOF

# Add issue references
if [ -n "$ISSUE_LIST" ]; then
    for ISSUE in $(echo "$ISSUE_LIST" | tr ',' ' '); do
        ISSUE_TITLE=$(gh issue view "$ISSUE" --json title -q '.title' 2>/dev/null || echo "Issue #$ISSUE")
        echo "- Fixes #$ISSUE — $ISSUE_TITLE" >> "$PR_BODY_FILE"
    done
else
    echo "_(Add issue references manually)_" >> "$PR_BODY_FILE"
fi

cat >> "$PR_BODY_FILE" << EOF

## Changes

$COMMIT_LOG

## Test Plan

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Documentation updated

## Checklist

- [ ] \`cargo build\` succeeds
- [ ] \`cargo test --all\` passes
- [ ] \`cargo clippy -- -D warnings\` passes
- [ ] \`cargo fmt --check\` passes
- [ ] Security audit passed

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF

# ---------------------------------------------------------------------------
# Create PR
# ---------------------------------------------------------------------------
echo ""
echo "Creating PR..."

# Generate title from branch name
PR_TITLE=$(echo "$BRANCH_NAME" | sed 's/feature\|priority\|issue\///' | sed 's/-/ /g')
if [ -n "$ISSUE_LIST" ]; then
    PR_TITLE="feat: implement issues #$ISSUE_LIST"
fi

PR_URL=$(gh pr create \
    --title "$PR_TITLE" \
    --body-file "$PR_BODY_FILE" \
    --base "$BASE_BRANCH" \
    --draft 2>&1) || {
    echo -e "${YELLOW}⚠️  PR creation may have failed or already exists${NC}"
    # Check if PR already exists
    PR_URL=$(gh pr view --json url -q '.url' 2>/dev/null || echo "")
}

echo -e "${GREEN}✅ PR created/opened${NC}"
echo "URL: $PR_URL"

# ---------------------------------------------------------------------------
# Comment on Issues
# ---------------------------------------------------------------------------
if [ -n "$ISSUE_LIST" ]; then
    PR_NUMBER=$(echo "$PR_URL" | grep -oE '[0-9]+' | tail -1)
    for ISSUE in $(echo "$ISSUE_LIST" | tr ',' ' '); do
        gh issue comment "$ISSUE" --body "Implementation in progress: PR #$PR_NUMBER" 2>/dev/null || true
    done
fi

echo ""
echo "============================================"
echo "  Next Steps"
echo "============================================"
echo "1. Wait for CI pipeline to complete"
echo "2. Run: .pi/scripts/mr-validation.sh"
echo "3. Address any feedback"
echo "4. Merge when green"

exit 0