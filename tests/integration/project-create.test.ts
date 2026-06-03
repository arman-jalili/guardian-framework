import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { runProjectGenerator } from "../../src/lib/project-generator";
import { generateBuildConfig } from "../../src/lib/build-config";
import { generateCiPipeline } from "../../src/lib/ci-generator";

function tempDir(): string {
	const dir = join(tmpdir(), `proj-int-test-${randomUUID()}`);
	mkdirSync(dir, { recursive: true });
	return dir;
}

describe("Project create integration", () => {
	test("all generators produce consistent output for Java Maven with http+messaging", () => {
		const dir = tempDir();
		const archDir = join(dir, ".pi/architecture");
		mkdirSync(join(archDir, "modules"), { recursive: true });
		writeFileSync(join(archDir, "modules/billing.md"), "# Billing\n\nBilling module", "utf-8");

		const defaults = { layers: ["domain", "application", "infrastructure", "interfaces/http", "interfaces/messaging"] };

		// Step 1: Structure
		const structure = runProjectGenerator(dir, archDir, {
			language: "java",
			groupId: "com.example",
			dryRun: false,
			defaults,
		});

		expect(structure.modules).toContain("Billing");
		expect(structure.layers).toContain("interfaces/http");
		expect(structure.layers).toContain("interfaces/messaging");

		const httpGitkeep = join(dir, "src/main/java/com/example/billing/interfaces/http/.gitkeep");
		expect(existsSync(httpGitkeep)).toBe(true);

		// Step 2: Build config
		const buildConfig = generateBuildConfig(dir, {
			language: "java",
			buildTool: "maven",
			groupId: "com.example",
			projectName: "myapp",
			version: "0.1.0",
			layers: structure.layers,
		});

		const pomPath = join(dir, "pom.xml");
		expect(existsSync(pomPath)).toBe(true);
		const pomContent = readFileSync(pomPath, "utf-8");
		expect(pomContent).toContain("spring-boot-starter-web");
		expect(pomContent).toContain("spring-boot-starter-amqp");

		// Step 3: CI pipeline
		const ci = generateCiPipeline(dir, {
			language: "java",
			buildTool: "maven",
			repoTool: "gh",
			validators: ["ci", "tests", "security"],
		});

		const ciYml = ci.files.find((f) => f.path.includes("ci.yml"));
		expect(ciYml).toBeDefined();
		expect(ciYml!.content).toContain("maven:3.9-eclipse-temurin-21");

		// Verify stage scripts
		const stageScripts = ci.files.filter((f) => f.path.includes("stage_"));
		expect(stageScripts.length).toBeGreaterThanOrEqual(3);
	});

	test("all generators produce consistent output for TypeScript with http+graphql", () => {
		const dir = tempDir();
		const archDir = join(dir, ".pi/architecture");
		mkdirSync(join(archDir, "modules"), { recursive: true });
		writeFileSync(join(archDir, "modules/api.md"), "# API Gateway\n\nAPI module", "utf-8");

		const defaults = { layers: ["domain", "application", "infrastructure", "interfaces/http", "interfaces/graphql"] };

		// Structure
		const structure = runProjectGenerator(dir, archDir, {
			language: "typescript",
			groupId: "com.example",
			dryRun: false,
			defaults,
		});

		// Build config
		const buildConfig = generateBuildConfig(dir, {
			language: "typescript",
			groupId: "com.example",
			projectName: "myapp",
			version: "0.1.0",
			layers: structure.layers,
		});

		const pkg = buildConfig.files.find((f) => f.path.endsWith("package.json"));
		expect(pkg!.content).toContain("graphql-yoga");

		// CI
		const ci = generateCiPipeline(dir, {
			language: "typescript",
			repoTool: "glab",
			validators: ["ci"],
		});

		const ciFile = ci.files.find((f) => f.path.endsWith(".gitlab-ci.yml"));
		expect(ciFile).toBeDefined();
	});
});
