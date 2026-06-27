import { describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateCiPipeline } from "../../src/lib/ci-generator";

function tempDir(): string {
	const dir = join(tmpdir(), `ci-gen-test-${randomUUID()}`);
	mkdirSync(dir, { recursive: true });
	return dir;
}

describe("generateCiPipeline — GitHub Actions", () => {
	test("generates .github/workflows/ci.yml for Java Maven", () => {
		const dir = tempDir();
		const result = generateCiPipeline(dir, {
			language: "java",
			buildTool: "maven",
			repoTool: "gh",
			validators: ["ci", "tests"],
		});

		const ciFile = result.files.find((f) => f.path.includes("ci.yml"));
		expect(ciFile).toBeDefined();
		expect(ciFile?.content).toContain("maven:3.9-eclipse-temurin-21");
		expect(ciFile?.content).toContain("run_hardening_stages.sh");
	});

	test("generates .github/workflows/ci.yml for TypeScript", () => {
		const dir = tempDir();
		const result = generateCiPipeline(dir, {
			language: "typescript",
			repoTool: "gh",
			validators: ["ci"],
		});

		const ciFile = result.files.find((f) => f.path.includes("ci.yml"));
		expect(ciFile).toBeDefined();
		expect(ciFile?.content).toContain("oven/bun:1");
	});

	test("generates stage scripts for active validators", () => {
		const dir = tempDir();
		const result = generateCiPipeline(dir, {
			language: "java",
			buildTool: "maven",
			repoTool: "gh",
			validators: ["ci", "tests", "security"],
		});

		const stageScripts = result.files.filter((f) => f.path.includes("stage_"));
		expect(stageScripts.length).toBeGreaterThanOrEqual(3);
	});

	test("dryRun does not write files", () => {
		const dir = tempDir();
		const result = generateCiPipeline(dir, {
			language: "java",
			repoTool: "gh",
			validators: ["ci"],
			dryRun: true,
		});
		expect(existsSync(join(dir, ".github"))).toBe(false);
	});
});

describe("generateCiPipeline — GitLab CI", () => {
	test("generates .gitlab-ci.yml", () => {
		const dir = tempDir();
		const result = generateCiPipeline(dir, {
			language: "java",
			buildTool: "gradle",
			repoTool: "glab",
			validators: ["ci"],
		});

		const ciFile = result.files.find((f) => f.path.endsWith(".gitlab-ci.yml"));
		expect(ciFile).toBeDefined();
		expect(ciFile?.content).toContain("gradle:8.5-jdk21");
	});
});
