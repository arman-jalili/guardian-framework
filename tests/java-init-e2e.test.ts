/**
 * E2E tests for Java init lifecycle.
 *
 * Tests are isolated in temporary directories.
 * Tests verify scaffolding outputs, not the full CLI execution.
 */

import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

// Import the actual modules being tested
import { getDefaultContext, SUPPORTED_LANGUAGES, readLanguagePatterns } from "../src/lib/templates";
import { createManifest } from "../src/lib/manifest";

const TEST_DIR = join(tmpdir(), `java-e2e-test-${randomUUID()}`);
const PI_DIR = join(TEST_DIR, ".pi");

describe("Java E2E: Init lifecycle", () => {
	beforeAll(() => {
		// Create test directory
		mkdirSync(PI_DIR, { recursive: true });
		mkdirSync(join(PI_DIR, "context"), { recursive: true });
	});

	afterAll(() => {
		// Cleanup
		try {
			rmSync(TEST_DIR, { recursive: true, force: true });
		} catch {
			// ignore cleanup errors
		}
	});

	test("Java is a supported language", () => {
		expect(SUPPORTED_LANGUAGES.includes("java")).toBe(true);
	});

	test("Maven defaults are correct", () => {
		const ctx = getDefaultContext("java", "e2e-test", "gh", "maven");
		expect(ctx.buildCommand).toBe("mvn clean compile -q");
		expect(ctx.testCommand).toBe("mvn test -q");
		expect(ctx.lintCommand).toBe("mvn checkstyle:check -q");
		expect(ctx.formatCommand).toBe("mvn spotless:apply");
	});

	test("Gradle defaults are correct", () => {
		const ctx = getDefaultContext("java", "e2e-test", "gh", "gradle");
		expect(ctx.buildCommand).toBe("gradle build -q");
		expect(ctx.testCommand).toBe("gradle test -q");
		expect(ctx.lintCommand).toBe("gradle checkstyleMain -q");
		expect(ctx.formatCommand).toBe("gradle spotlessApply");
	});

	test("Manifest created with Java language and buildTool", () => {
		const context = getDefaultContext("java", "e2e-test", "gh", "maven");
		const manifest = createManifest({
			tools: ["pi"],
			language: "java",
			buildTool: "maven",
			repoTool: "gh",
			validators: ["ci", "tests"],
			workflows: ["feature"],
			templateContext: context,
		});

		expect(manifest.language).toBe("java");
		expect(manifest.templateContext?.buildTool).toBe("maven");
		expect(manifest.tools).toContain("pi");
	});

	test("Java patterns file is loadable", () => {
		const result = readLanguagePatterns("java");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toContain("Spring Boot");
			expect(result.value).toContain("@Service");
			expect(result.value).toContain("@Transactional");
			expect(result.value).toContain("Clean Architecture");
		}
	});

	test("Java patterns include both Maven and Gradle build commands", () => {
		const result = readLanguagePatterns("java");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value).toContain("mvn clean compile");
			expect(result.value).toContain("gradle build");
		}
	});

	test("Default context defaults Java to Maven when no buildTool", () => {
		const ctx = getDefaultContext("java", "e2e-test", "gh");
		expect(ctx.buildCommand).toBe("mvn clean compile -q");
	});

	test("Template context for Java has all required fields", () => {
		const ctx = getDefaultContext("java", "e2e-test", "gh", "maven");
		expect(ctx.projectName).toBe("e2e-test");
		expect(ctx.language).toBe("java");
		expect(ctx.buildTool).toBe("maven");
		expect(ctx.buildCommand).toBeDefined();
		expect(ctx.testCommand).toBeDefined();
		expect(ctx.lintCommand).toBeDefined();
		expect(ctx.formatCommand).toBeDefined();
		expect(ctx.formatCheckCommand).toBeDefined();
		expect(ctx.securityAuditCommand).toBeDefined();
		expect(ctx.errorHandlingPattern).toBeDefined();
		expect(ctx.tracingPattern).toBeDefined();
		expect(ctx.cancellationPattern).toBeDefined();
		expect(ctx.atomicWritePattern).toBeDefined();
	});
});

// Helper function for cleanup
function rmSync(path: string, options?: { recursive?: boolean; force?: boolean }) {
	try {
		const fs = require("node:fs");
		fs.rmSync(path, options);
	} catch {
		// ignore
	}
}
