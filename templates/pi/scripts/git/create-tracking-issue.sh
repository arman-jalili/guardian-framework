#!/usr/bin/env bash
# Git Wrapper: Create Tracking Issue
#
# Creates a tracking issue on GitHub or GitLab that tracks epic progress.
# Posts to the issue body as each step completes.
#
# Usage: bash .pi/scripts/git/create-tracking-issue.sh \
#   --title "Epic: Auth Module v2" \
#   --body "Tracking issue content" \
#   --labels "epic,tracking"
#
# Environment variables:
#   GITHUB_TOKEN / GITLAB_TOKEN — API token
#   GITHUB_REPO / GITLAB_PROJECT_ID — repo/project identifier
#   GIT_PLATFORM — "github" or "gitlab" (auto-detected)

set -euo pipefail

detect_platform() {
    if [[ -n "${GIT_PLATFORM:-}" ]]; then
        echo "$GIT_PLATFORM"
    elif command -v gh &>/dev/null && gh auth status &>/dev/null 2>&1; then
        echo "github"
    elif command -v glab &>/dev/null && glab auth status &>/dev/null 2>&1; then
        echo "gitlab"
    else
        echo "none"
    fi
}

TITLE=""
BODY=""
LABELS=""
MILESTONE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --title) TITLE="$2"; shift 2 ;;
        --body) BODY="$2"; shift 2 ;;
        --labels) LABELS="$2"; shift 2 ;;
        --milestone) MILESTONE="$2"; shift 2 ;;
        *) shift ;;
    esac
done

PLATFORM=$(detect_platform)

if [[ "$PLATFORM" == "none" ]]; then
    echo "No git platform detected. Set GITHUB_TOKEN or GITLAB_TOKEN, or install gh/glab CLI."
    echo "Creating local tracking file instead."
    mkdir -p .pi/.tracking
    TRACKING_FILE=".pi/.tracking/issue-$(date +%s).md"
    cat > "$TRACKING_FILE" << EOF
# $TITLE

$BODY

Labels: $LABELS
Milestone: $MILESTONE
Created: $(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF
    echo "TRACKING_ID=local:$(basename "$TRACKING_FILE")"
    exit 0
fi

case "$PLATFORM" in
    github)
        CMD="gh issue create"
        [[ -n "$TITLE" ]] && CMD="$CMD --title $(printf '%q' "$TITLE")"
        [[ -n "$BODY" ]] && CMD="$CMD --body $(printf '%q' "$BODY")"
        [[ -n "$LABELS" ]] && CMD="$CMD --label $LABELS"
        [[ -n "$MILESTONE" ]] && CMD="$CMD --milestone $MILESTONE"

        ISSUE_URL=$(eval "$CMD" 2>/dev/null)
        ISSUE_NUMBER=$(echo "$ISSUE_URL" | grep -oP '\d+$' || echo "$ISSUE_URL")
        echo "TRACKING_ID=$ISSUE_NUMBER"
        echo "TRACKING_URL=$ISSUE_URL"
        ;;

    gitlab)
        CMD="glab issue create"
        [[ -n "$TITLE" ]] && CMD="$CMD --title $(printf '%q' "$TITLE")"
        [[ -n "$BODY" ]] && CMD="$CMD --description $(printf '%q' "$BODY")"
        [[ -n "$LABELS" ]] && CMD="$CMD --label $LABELS"
        [[ -n "$MILESTONE" ]] && CMD="$CMD --milestone $MILESTONE"

        ISSUE_URL=$(eval "$CMD" 2>/dev/null)
        ISSUE_NUMBER=$(echo "$ISSUE_URL" | grep -oP '\d+$' || echo "$ISSUE_URL")
        echo "TRACKING_ID=$ISSUE_NUMBER"
        echo "TRACKING_URL=$ISSUE_URL"
        ;;
esac
