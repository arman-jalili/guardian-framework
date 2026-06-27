import { describe, expect, test } from "bun:test";
import { SUPPORTED_LANGUAGES, getDefaultContext, renderTemplate } from "../src/lib/templates";

describe("Java language registration", () => {
	test("Java is in SUPPORTED_LANGUAGES", () => {
		expect(SUPPORTED_LANGUAGES).toContain("java");
	});

	test("TypeScript still supported after Java addition", () => {
		expect(SUPPORTED_LANGUAGES).toContain("typescript");
	});

	test("Rust still supported after Java addition", () => {
		expect(SUPPORTED_LANGUAGES).toContain("rust");
	});
});

describe("Java LANGUAGE_DEFAULTS", () => {
	test("getDefaultContext with Java language returns Maven commands", () => {
		const ctx = getDefaultContext("java", "my-java-project", "gh");
		expect(ctx.buildCommand).toBe("mvn clean compile -q");
		expect(ctx.testCommand).toBe("mvn test -q");
		expect(ctx.lintCommand).toBe("mvn checkstyle:check -q");
		expect(ctx.formatCommand).toBe("mvn spotless:apply");
		expect(ctx.formatCheckCommand).toBe("mvn spotless:check");
		expect(ctx.securityAuditCommand).toBe("mvn dependency-check:check");
	});

	test("Java context includes Spring Boot patterns", () => {
		const ctx = getDefaultContext("java", "my-java-project", "gh");
		expect(ctx.errorHandlingPattern).toContain("@ControllerAdvice");
		expect(ctx.tracingPattern).toContain("Micrometer");
		expect(ctx.cancellationPattern).toContain("@Async");
		expect(ctx.atomicWritePattern).toContain("CrudRepository");
	});
});

describe("Java build tool selection", () => {
	test("getDefaultContext with Gradle returns Gradle commands", () => {
		const ctx = getDefaultContext("java", "my-java-project", "gh", "gradle");
		expect(ctx.buildCommand).toBe("gradle build -q");
		expect(ctx.testCommand).toBe("gradle test -q");
		expect(ctx.lintCommand).toBe("gradle checkstyleMain -q");
		expect(ctx.formatCommand).toBe("gradle spotlessApply");
		expect(ctx.formatCheckCommand).toBe("gradle spotlessCheck");
		expect(ctx.securityAuditCommand).toBe("gradle dependencyCheck");
	});

	test("getDefaultContext with Maven returns Maven commands", () => {
		const ctx = getDefaultContext("java", "my-java-project", "gh", "maven");
		expect(ctx.buildCommand).toBe("mvn clean compile -q");
		expect(ctx.testCommand).toBe("mvn test -q");
	});

	test("getDefaultContext defaults Java to Maven when buildTool not specified", () => {
		const ctx = getDefaultContext("java", "my-java-project", "gh");
		expect(ctx.buildCommand).toBe("mvn clean compile -q");
	});

	test("getDefaultContext with TypeScript ignores buildTool parameter", () => {
		const ctx = getDefaultContext("typescript", "my-ts-project", "gh", "gradle");
		expect(ctx.buildCommand).toBe("bun build ./src/index.ts --outdir ./dist");
	});
});

describe("buildTool in TemplateContext", () => {
	test("buildTool field is present with value for Java", () => {
		const ctx = getDefaultContext("java", "my-java-project", "gh", "gradle");
		expect((ctx as Record<string, unknown>).buildTool).toBe("gradle");
	});

	test("buildTool field is present with 'maven' when defaulted", () => {
		const ctx = getDefaultContext("java", "my-java-project", "gh");
		expect((ctx as Record<string, unknown>).buildTool).toBe("maven");
	});

	test("buildTool is undefined for non-Java languages", () => {
		const ctx = getDefaultContext("typescript", "my-ts-project", "gh");
		expect((ctx as Record<string, unknown>).buildTool).toBeUndefined();
	});
});

describe("template placeholder substitution with buildTool", () => {
	test("buildTool appears in template context for Maven", () => {
		const ctx = getDefaultContext("java", "my-java-project", "gh", "maven");
		expect((ctx as Record<string, unknown>).buildTool).toBe("maven");
	});

	test("buildTool appears in template context for Gradle", () => {
		const ctx = getDefaultContext("java", "my-java-project", "gh", "gradle");
		expect((ctx as Record<string, unknown>).buildTool).toBe("gradle");
	});

	test("buildCommand resolves correctly for Maven via context", () => {
		const ctx = getDefaultContext("java", "my-java-project", "gh", "maven");
		expect(ctx.buildCommand).toBe("mvn clean compile -q");
	});

	test("buildCommand resolves correctly for Gradle via context", () => {
		const ctx = getDefaultContext("java", "my-java-project", "gh", "gradle");
		expect(ctx.buildCommand).toBe("gradle build -q");
	});
});
