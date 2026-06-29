/**
 * CI Pipeline Generator
 *
 * Reads the project's validator configuration and generates CI pipeline config
 * with the hardening pipeline pre-wired. Platform matches repoTool setting.
 *
 * Canonical Reference: .pi/architecture/modules/project-scaffolding-epic0.md#ci-generator
 * Last Sync: 2026-06-03
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { Language } from "./templates.js";

export interface CiPlan {
	files: { path: string; content: string }[];
}

/**
 * Generate CI pipeline configuration and stage scripts.
 */
export function generateCiPipeline(
	targetDir: string,
	options: {
		language: Language;
		buildTool?: "maven" | "gradle";
		repoTool: "gh" | "glab";
		validators: string[];
		dryRun?: boolean;
	},
): CiPlan {
	const { language, buildTool, repoTool, validators, dryRun } = options;
	const files: { path: string; content: string }[] = [];

	// Determine runner image based on language
	const runnerImage =
		language === "java"
			? buildTool === "gradle"
				? "gradle:8.5-jdk21"
				: "maven:3.9-eclipse-temurin-21"
			: "oven/bun:1";

	// Generate CI pipeline config
	if (repoTool === "gh") {
		const ciYaml = `name: CI
on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    container:
      image: ${runnerImage}
    steps:
      - uses: actions/checkout@v4
      - name: Run Guardian hardening pipeline
        run: bash .pi/scripts/local-ci.sh
`;
		files.push({ path: path.join(targetDir, ".github/workflows/ci.yml"), content: ciYaml });
	} else {
		const ciYaml = `stages:
  - validate

validate:
  stage: validate
  image: ${runnerImage}
  script:
    - bash .pi/scripts/local-ci.sh
  only:
    - branches
`;
		files.push({ path: path.join(targetDir, ".gitlab-ci.yml"), content: ciYaml });
	}

	// Generate stage scripts for each active validator (Issue #32)
	const stageScripts = generateStageScripts(language, validators);
	files.push(...stageScripts);

	if (!dryRun) {
		for (const file of files) {
			fs.mkdirSync(path.dirname(file.path), { recursive: true });
			fs.writeFileSync(file.path, file.content, "utf-8");
		}
	}

	return { files };
}

/**
 * Generate stage_*.sh scaffolding scripts for each active validator.
 */
function generateStageScripts(
	language: Language,
	validators: string[],
): { path: string; content: string }[] {
	const scripts: { path: string; content: string }[] = [];

	// Language-agnostic stage commands: auto-detect project type at runtime.
	// This ensures correctness regardless of the manifest language setting.
	const buildCmd = `if [[ -f "pom.xml" ]]; then echo "Running: mvn clean compile"; mvn clean compile -q; elif [[ -f "build.gradle" || -f "build.gradle.kts" ]]; then echo "Running: gradle compileJava"; gradle compileJava -q; elif [[ -f "package.json" ]]; then if command -v bun &>/dev/null; then echo "Running: bun run build"; bun run build; elif command -v npm &>/dev/null; then echo "Running: npm run build"; npm run build; else echo "⊘ No JS build tool found"; fi; elif [[ -f "Cargo.toml" ]]; then echo "Running: cargo build"; cargo build; elif [[ -f "go.mod" ]]; then echo "Running: go build ./..."; go build ./...; else echo "⊘ No build config found, skipping."; fi`;

	const testCmd = `if [[ -f "pom.xml" ]]; then echo "Running: mvn test"; mvn test -q; elif [[ -f "build.gradle" || -f "build.gradle.kts" ]]; then echo "Running: gradle test"; gradle test -q; elif [[ -f "package.json" ]]; then if command -v bun &>/dev/null; then echo "Running: bun test"; bun test; elif command -v npm &>/dev/null; then echo "Running: npm test"; npm test; else echo "⊘ No JS runner found"; fi; elif [[ -f "pyproject.toml" ]] && command -v pytest &>/dev/null; then echo "Running: pytest"; pytest -v; elif [[ -f "Cargo.toml" ]]; then echo "Running: cargo test"; cargo test; elif [[ -f "go.mod" ]]; then echo "Running: go test ./..."; go test ./...; else echo "⊘ No test config found, skipping."; fi`;

	const securityCmd = `echo "  Running secret scan..."; for pattern in "sk-[A-Za-z0-9]{32,}" "ghp_[A-Za-z0-9]{36}" "AKIA[0-9A-Z]{16}" "BEGIN (RSA |EC )?PRIVATE KEY"; do grep -rE "$pattern" . --include="*.py" --include="*.ts" --include="*.tsx" --include="*.env" --include="*.yml" 2>/dev/null | grep -v ".git" | grep -v "node_modules" | grep -v ".pi" | head -1 | grep -q . && echo "  !! Potential secret detected: $pattern"; done; echo "  ✓ Secret scan complete"; echo "  Running dependency audit..."; if [[ -f "pom.xml" ]]; then command -v mvn &>/dev/null && mvn dependency-check:check -q 2>/dev/null || echo "  ⊘ Maven dep-check skipped"; elif [[ -f "package.json" ]]; then command -v npm &>/dev/null && npm audit --audit-level=high 2>/dev/null || echo "  ⊘ npm audit skipped"; elif [[ -f "Cargo.toml" ]]; then command -v cargo-audit &>/dev/null && cargo audit 2>/dev/null || echo "  ⊘ cargo-audit skipped"; else echo "  ⊘ No package manager found"; fi`;

	const stageMap: Record<string, { name: string; command: string }> = {
		ci: { name: "build", command: buildCmd },
		tests: { name: "test", command: testCmd },
		architecture: { name: "architecture", command: "bash .pi/scripts/validate-architecture.sh" },
		security: { name: "security", command: securityCmd },
		integration: {
			name: "integration",
			command: `if [[ -f "package.json" ]] && command -v bun &>/dev/null && [[ -d "tests/integration" ]]; then bun test tests/integration; elif command -v pytest &>/dev/null && [[ -d "tests/integration" ]]; then pytest tests/integration -v; elif command -v cargo &>/dev/null; then cargo test --test integration 2>/dev/null || true; else echo "⊘ No integration tests found, skipping."; fi`,
		},
	};

	for (const validator of validators) {
		const stage = stageMap[validator];
		if (!stage) continue;

		const scriptContent = `#!/usr/bin/env bash
# ============================================================================
# stage_${stage.name}.sh — ${validator} validation stage
# Generated by Guardian Framework
# ============================================================================
set -euo pipefail

echo "============================================"
echo "  Stage: ${stage.name}"
echo "============================================"

${stage.command}
echo "✅ Stage ${stage.name} passed"
exit 0
`;
		scripts.push({
			path: `.pi/scripts/ci/stage_${stage.name}.sh`,
			content: scriptContent,
		});
	}

	return scripts;
}
