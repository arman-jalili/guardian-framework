#!/usr/bin/env bash
# ============================================================================
# local-ci.sh — Local CI runner with regex-based script discovery
#
# Auto-discovers all .sh and .py scripts in .pi/scripts/ci/ using glob
# patterns. New scripts added to the directory are automatically detected
# and run — no manual wiring needed.
#
# Usage:
#   bash .pi/scripts/local-ci.sh                 # Run all discovered scripts
#   bash .pi/scripts/local-ci.sh --list           # List discovered scripts
#   bash .pi/scripts/local-ci.sh --stage=lint     # Run only scripts matching a stage
#   bash .pi/scripts/local-ci.sh --quick          # Skip slow stages
#   bash .pi/scripts/local-ci.sh --verbose        # Show full script output
#   bash .pi/scripts/local-ci.sh --save           # Save report to .pi/ci/local-ci-report.txt
#
# Canonical Reference: .pi/scripts/local-ci.sh
# ============================================================================

set -euo pipefail

# ── Paths ──────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CI_DIR="${SCRIPT_DIR}/ci"
PI_DIR="${SCRIPT_DIR}/.."

# ── Colors ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Flags ──────────────────────────────────────────────────────────────────
VERBOSE=false
QUICK=false
LIST_ONLY=false
SAVE_REPORT=false
TARGET_STAGE=""

# ── Stage ordering (canonical order for known stage scripts) ───────────────
# Scripts matching these patterns are sorted in this order; unknown scripts
# are appended alphabetically at the end.
declare -a STAGE_ORDER=(
    "stage_docs_policy"
    "check_architecture_conformance"
    "stage_lint"
    "stage_static_analysis"
    "stage_unit"
    "stage_test"
    "stage_integration"
    "stage_security"
    "stage_migration_verify"
    "stage_build"
    "stage_package_build"
    "stage_release_readiness"
)

# ── Meta-runners (scripts that orchestrate other scripts — skip in auto-run)
declare -a META_RUNNERS=(
    "run_hardening_stages.sh"
    "run_preflight.sh"
    "run_stage.sh"
    "stage_remaining.sh"
)

# ── Parse arguments ────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --quick|-q)
            QUICK=true
            shift
            ;;
        --list|-l)
            LIST_ONLY=true
            shift
            ;;
        --save|-s)
            SAVE_REPORT=true
            shift
            ;;
        --stage=*)
            TARGET_STAGE="${1#*=}"
            shift
            ;;
        --stage)
            TARGET_STAGE="$2"
            shift 2
            ;;
        *)
            echo "Unknown flag: $1"
            echo "Usage: bash .pi/scripts/local-ci.sh [--list] [--stage=<name>] [--quick] [--verbose] [--save]"
            exit 1
            ;;
    esac
done

# ═══════════════════════════════════════════════════════════════════════════
# Script Discovery (regex/glob-based)
# ═══════════════════════════════════════════════════════════════════════════

discover_scripts() {
    local scripts=()

    if [[ ! -d "$CI_DIR" ]]; then
        echo -e "${RED}CI directory not found: ${CI_DIR}${NC}"
        return 1
    fi

    # Discover all .sh scripts (glob)
    for f in "${CI_DIR}"/*.sh; do
        [[ -f "$f" ]] || continue
        local name
        name="$(basename "$f")"

        # Skip meta-runners (exact match)
        local is_meta=false
        for meta in "${META_RUNNERS[@]}"; do
            if [[ "$name" == "$meta" ]]; then
                is_meta=true
                break
            fi
        done
        if [[ "$is_meta" == "true" ]]; then
            continue
        fi

        scripts+=("$name")
    done

    # Discover all .py scripts (glob)
    for f in "${CI_DIR}"/*.py; do
        [[ -f "$f" ]] || continue
        scripts+=("$(basename "$f")")
    done

    # Sort: known stages first (in canonical order), then alphabetically
    local sorted_scripts=()
    local remaining_scripts=()

    # Collect known stages in order
    for pattern in "${STAGE_ORDER[@]}"; do
        for s in "${scripts[@]}"; do
            if [[ "$s" == "${pattern}"* ]]; then
                sorted_scripts+=("$s")
            fi
        done
    done

    # Collect remaining (unknown/new) scripts alphabetically
    for s in "${scripts[@]}"; do
        local is_known=false
        for pattern in "${STAGE_ORDER[@]}"; do
            if [[ "$s" == "${pattern}"* ]]; then
                is_known=true
                break
            fi
        done
        if [[ "$is_known" == "false" ]]; then
            remaining_scripts+=("$s")
        fi
    done

    # Sort remaining alphabetically
    IFS=$'\n' remaining_scripts=($(sort <<<"${remaining_scripts[*]}"))
    unset IFS

    # Combine: ordered stages first, then new/unknown scripts
    DISCOVERED_SCRIPTS=("${sorted_scripts[@]}" "${remaining_scripts[@]}")
}

# ═══════════════════════════════════════════════════════════════════════════
# Script metadata extraction (regex-based)
# ═══════════════════════════════════════════════════════════════════════════

extract_description() {
    local script_path="$1"
    local desc=""

    # Extract the first comment line after shebang (# Description or # Stage N: Desc)
    if [[ -f "$script_path" ]]; then
        # Try to get the first meaningful comment line (skip shebang, skip empty # lines)
        desc=$(head -20 "$script_path" | grep -m1 -E '^# (Stage [0-9]+:|[A-Z])' 2>/dev/null || true)
        if [[ -z "$desc" ]]; then
            # Fallback: get the second line after shebang
            desc=$(head -5 "$script_path" | grep -m1 '^# [A-Z]' 2>/dev/null || true)
        fi
        desc="${desc#\# }"
    fi

    echo "${desc:-No description}"
}

# ═══════════════════════════════════════════════════════════════════════════
# Stage matching (regex-based)
# ═══════════════════════════════════════════════════════════════════════════

script_matches_stage() {
    local script_name="$1"
    local stage_name="$2"

    # Match by filename: stage_<name>.sh or check_<name>.sh etc.
    # Normalize: replace underscores with nothing for fuzzy matching
    local normalized_script="${script_name//_/}"
    local normalized_stage="${stage_name//_/}"

    # Direct prefix match (e.g., stage_lint matches --stage=lint)
    if [[ "$script_name" == *"${stage_name}"* ]]; then
        return 0
    fi

    # Normalized match
    if [[ "$normalized_script" == *"${normalized_stage}"* ]]; then
        return 0
    fi

    return 1
}

is_quick_stage() {
    local script_name="$1"

    # Slow stages to skip in quick mode
    case "$script_name" in
        stage_integration*|stage_security*|stage_migration_verify*|stage_package_build*|stage_release_readiness*)
            return 0  # Is a slow stage
            ;;
        *)
            return 1  # Not a slow stage
            ;;
    esac
}

# ═══════════════════════════════════════════════════════════════════════════
# Script execution
# ═══════════════════════════════════════════════════════════════════════════

TOTAL_SCRIPTS=0
PASSED_SCRIPTS=0
FAILED_SCRIPTS=0
SKIPPED_SCRIPTS=0

declare -a SCRIPT_RESULTS=()

run_script() {
    local script_name="$1"
    local script_path="${CI_DIR}/${script_name}"

    ((TOTAL_SCRIPTS++))

    # Determine how to run based on extension
    local runner
    if [[ "$script_name" == *.py ]]; then
        runner="python3"
    else
        runner="bash"
    fi

    # Check if file exists and is readable
    if [[ ! -f "$script_path" ]]; then
        echo -e "  ${YELLOW}⊘ SKIP${NC} — file not found"
        ((SKIPPED_SCRIPTS++))
        SCRIPT_RESULTS+=("SKIP:${script_name}:file not found")
        return 0
    fi

    if [[ ! -r "$script_path" ]]; then
        echo -e "  ${YELLOW}⊘ SKIP${NC} — file not readable"
        ((SKIPPED_SCRIPTS++))
        SCRIPT_RESULTS+=("SKIP:${script_name}:file not readable")
        return 0
    fi

    local output
    local exit_code=0

    # Resolve timeout command (macOS compat: prefers gtimeout, falls back to no timeout)
    local timeout_cmd=""
    if command -v timeout &>/dev/null; then
        timeout_cmd="timeout 300"
    elif command -v gtimeout &>/dev/null; then
        timeout_cmd="gtimeout 300"
    fi

    # Run the script
    if [[ "$VERBOSE" == "true" ]]; then
        if ${timeout_cmd} "$runner" "$script_path" 2>&1; then
            exit_code=0
        else
            exit_code=$?
        fi
    else
        output=$(${timeout_cmd} "$runner" "$script_path" 2>&1) || exit_code=$?
    fi

    # Determine exit code meaning
    case $exit_code in
        0)
            echo -e "  ${GREEN}✓ PASS${NC}"
            ((PASSED_SCRIPTS++))
            SCRIPT_RESULTS+=("PASS:${script_name}:")
            if [[ "$VERBOSE" == "true" ]]; then
                echo ""
            fi
            ;;
        124)
            echo -e "  ${YELLOW}⊘ SKIP${NC} — timed out after 5m"
            ((SKIPPED_SCRIPTS++))
            SCRIPT_RESULTS+=("SKIP:${script_name}:timed out")
            ;;
        *)
            echo -e "  ${RED}✗ FAIL${NC} (exit code: $exit_code)"
            ((FAILED_SCRIPTS++))
            # Show first 5 lines of output on failure
            if [[ -n "${output:-}" ]]; then
                echo -e "    ${RED}$(echo "$output" | head -5)${NC}"
            fi
            SCRIPT_RESULTS+=("FAIL:${script_name}:${output:-no output}")
            ;;
    esac
}

# ═══════════════════════════════════════════════════════════════════════════
# List mode
# ═══════════════════════════════════════════════════════════════════════════

list_scripts() {
    echo ""
    echo -e "${BOLD}Discovered scripts in .pi/scripts/ci/${NC}"
    echo ""

    local i=0
    for script_name in "${DISCOVERED_SCRIPTS[@]}"; do
        ((i++))
        local desc
        desc=$(extract_description "${CI_DIR}/${script_name}")
        local type_tag=""
        if [[ "$script_name" == stage_* ]]; then
            type_tag="${BLUE}[stage]${NC}"
        elif [[ "$script_name" == check_* ]]; then
            type_tag="${CYAN}[check]${NC}"
        elif [[ "$script_name" == validate_* ]]; then
            type_tag="${CYAN}[validate]${NC}"
        else
            type_tag="${YELLOW}[other]${NC}"
        fi
        printf "  %2d. %-45s %s\n" "$i" "$script_name" "$type_tag"
        echo "      ${desc}"
    done

    echo ""
    echo -e "  ${BOLD}Total: ${#DISCOVERED_SCRIPTS[@]} scripts discovered${NC}"
    echo ""

    # Also list meta-runners (not auto-run)
    echo -e "${YELLOW}Meta-runners (not auto-run):${NC}"
    for meta in "${META_RUNNERS[@]}"; do
        if [[ -f "${CI_DIR}/${meta}" ]]; then
            echo "  - ${meta}"
        fi
    done
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════════
# Main runner
# ═══════════════════════════════════════════════════════════════════════════

run_all() {
    local run_count=0

    echo ""
    echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}║           Guardian Local CI — Auto-Discovery Runner          ║${NC}"
    echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  Scripts dir : ${CI_DIR}"
    echo -e "  Discovered  : ${#DISCOVERED_SCRIPTS[@]} scripts"
    if [[ -n "$TARGET_STAGE" ]]; then
        echo -e "  Filter      : --stage=${TARGET_STAGE}"
    fi
    if [[ "$QUICK" == "true" ]]; then
        echo -e "  Mode        : quick (skipping slow stages)"
    fi
    echo ""

    for script_name in "${DISCOVERED_SCRIPTS[@]}"; do
        # Stage filter
        if [[ -n "$TARGET_STAGE" ]]; then
            if ! script_matches_stage "$script_name" "$TARGET_STAGE"; then
                continue
            fi
        fi

        # Quick mode: skip slow stages
        if [[ "$QUICK" == "true" ]]; then
            if is_quick_stage "$script_name"; then
                continue
            fi
        fi

        ((run_count++))

        local desc
        desc=$(extract_description "${CI_DIR}/${script_name}")

        echo -e "  ${BOLD}${script_name}${NC}"
        echo -e "    ${desc}"

        run_script "$script_name"
        echo ""
    done

    if [[ $run_count -eq 0 ]]; then
        echo -e "${YELLOW}No scripts matched the filter '${TARGET_STAGE}'.${NC}"
        echo "Use --list to see all discovered scripts."
        return 0
    fi

    # ── Summary ────────────────────────────────────────────────────────────
    echo ""
    echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}║                    Local CI Summary                          ║${NC}"
    echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    for result in "${SCRIPT_RESULTS[@]}"; do
        IFS=':' read -ra parts <<< "$result"
        local status="${parts[0]}"
        local name="${parts[1]}"

        case "$status" in
            PASS)
                echo -e "  ${GREEN}✓${NC} ${name}"
                ;;
            FAIL)
                echo -e "  ${RED}✗${NC} ${name}"
                ;;
            SKIP)
                echo -e "  ${YELLOW}⊘${NC} ${name}"
                ;;
        esac
    done

    echo ""
    echo -e "  ${GREEN}Passed:   ${PASSED_SCRIPTS}${NC}"
    echo -e "  ${RED}Failed:   ${FAILED_SCRIPTS}${NC}"
    echo -e "  ${YELLOW}Skipped:  ${SKIPPED_SCRIPTS}${NC}"
    echo -e "  ${BOLD}Total:    ${TOTAL_SCRIPTS}${NC}"
    echo ""

    if [[ ${FAILED_SCRIPTS} -gt 0 ]]; then
        echo -e "${RED}✗ Local CI FAILED. ${FAILED_SCRIPTS} script(s) did not pass.${NC}"
        return 1
    fi

    echo -e "${GREEN}✓ All scripts passed.${NC}"
    return 0
}

# ═══════════════════════════════════════════════════════════════════════════
# Entry point
# ═══════════════════════════════════════════════════════════════════════════

main() {
    # Discover scripts using glob/regex
    discover_scripts

    if [[ ${#DISCOVERED_SCRIPTS[@]} -eq 0 ]]; then
        echo -e "${RED}No scripts discovered in ${CI_DIR}${NC}"
        return 1
    fi

    # List mode
    if [[ "$LIST_ONLY" == "true" ]]; then
        list_scripts
        return 0
    fi

    # Run mode
    local exit_code=0
    if run_all; then
        exit_code=0
    else
        exit_code=1
    fi

    # Save report
    if [[ "$SAVE_REPORT" == "true" ]]; then
        local report_dir="${PI_DIR}/ci"
        mkdir -p "$report_dir"
        local report_file="${report_dir}/local-ci-report.txt"

        {
            echo "Guardian Local CI Report"
            echo "Date: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
            echo "Branch: $(git branch --show-current 2>/dev/null || echo 'unknown')"
            echo "Commit: $(git rev-parse HEAD 2>/dev/null || echo 'unknown')"
            echo ""
            echo "Results:"
            for result in "${SCRIPT_RESULTS[@]}"; do
                echo "  $result"
            done
            echo ""
            echo "Passed: ${PASSED_SCRIPTS}, Failed: ${FAILED_SCRIPTS}, Skipped: ${SKIPPED_SCRIPTS}, Total: ${TOTAL_SCRIPTS}"
        } > "$report_file"

        echo -e "Report saved to ${report_file}"
    fi

    return $exit_code
}

main "$@"
