import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import {
	discoverModules,
	resolveLayers,
	generateProjectStructure,
	runProjectGenerator,
} from "../../src/lib/project-generator";

function tempDir(): string {
	const dir = join(tmpdir(), `project-gen-test-${randomUUID()}`);
	mkdirSync(dir, { recursive: true });
	return dir;
}

function createModuleDoc(dir: string, name: string, content: string): void {
	const modulesDir = join(dir, "modules");
	mkdirSync(modulesDir, { recursive: true });
	writeFileSync(join(modulesDir, name), content, "utf-8");
}

function createAdr(dir: string, name: string, content: string): void {
	const decisionsDir = join(dir, "decisions");
	mkdirSync(decisionsDir, { recursive: true });
	writeFileSync(join(decisionsDir, name), content, "utf-8");
}

describe("discoverModules", () => {
	test("parses module names from # Title headings", () => {
		const dir = tempDir();
		createModuleDoc(dir, "billing.md", "# Billing Module\n\nSome content");
		createModuleDoc(dir, "notifications.md", "# Notifications\n\nContent");
		createModuleDoc(dir, "module-template.md", "# Template"); // Should be skipped

		const modules = discoverModules(dir);
		expect(modules).toContain("Billing Module");
		expect(modules).toContain("Notifications");
		expect(modules).not.toContain("Template");
	});

	test("returns empty array when no modules directory", () => {
		const modules = discoverModules("/nonexistent");
		expect(modules).toEqual([]);
	});
});

describe("resolveLayers", () => {
	const defaults = { layers: ["domain", "application", "infrastructure", "interfaces/http"] };

	test("falls back to defaults when no ADRs", () => {
		const dir = tempDir();
		const layers = resolveLayers(dir, "typescript", defaults);
		expect(layers).toContain("domain");
		expect(layers).toContain("interfaces/http");
	});

	test("detects REST/HTTP from ADR", () => {
		const dir = tempDir();
		createAdr(dir, "adr-001.md", "# ADR-001\n\nWe will use REST APIs with HTTP/2");
		const layers = resolveLayers(dir, "java", defaults);
		expect(layers).toContain("interfaces/http");
	});

	test("detects GraphQL from ADR", () => {
		const dir = tempDir();
		createAdr(dir, "adr-002.md", "# ADR-002\n\nWe expose a GraphQL endpoint");
		const layers = resolveLayers(dir, "typescript", defaults);
		expect(layers).toContain("interfaces/graphql");
	});

	test("detects messaging from ADR", () => {
		const dir = tempDir();
		createAdr(dir, "adr-003.md", "# ADR-003\n\nEvent-driven messaging with Kafka");
		const layers = resolveLayers(dir, "java", defaults);
		expect(layers).toContain("interfaces/messaging");
	});

	test("detects CLI from ADR", () => {
		const dir = tempDir();
		createAdr(dir, "adr-004.md", "# ADR-004\n\nCLI commands for admin tasks");
		const layers = resolveLayers(dir, "rust", defaults);
		expect(layers).toContain("interfaces/cli");
	});

	test("explicit module doc layers field overrides ADR detection", () => {
		const dir = tempDir();
		createModuleDoc(dir, "billing.md", "# Billing\nlayers: [\"domain\", \"application\", \"infrastructure\", \"interfaces/http\"]");
		createAdr(dir, "adr-001.md", "# ADR-001\n\nGraphQL API"); // Should be ignored
		const layers = resolveLayers(dir, "java", defaults);
		expect(layers).toContain("interfaces/http");
		expect(layers).not.toContain("interfaces/graphql");
	});

	test("ADR mentioning only REST does NOT produce graphql", () => {
		const dir = tempDir();
		createAdr(dir, "adr-001.md", "# ADR-001\n\nREST APIs");
		const layers = resolveLayers(dir, "typescript", defaults);
		expect(layers).toContain("interfaces/http");
		expect(layers).not.toContain("interfaces/graphql");
	});
});

describe("generateProjectStructure", () => {
	test("creates nested directories for sub-layer paths", () => {
		const dir = tempDir();
		const result = generateProjectStructure(dir, {
			language: "java",
			groupId: "com.example",
			modules: ["billing"],
			layers: ["domain", "interfaces/http", "interfaces/messaging"],
		});

		const httpGitkeep = join(dir, "src/main/java/com/example/billing/interfaces/http/.gitkeep");
		const msgGitkeep = join(dir, "src/main/java/com/example/billing/interfaces/messaging/.gitkeep");

		expect(existsSync(httpGitkeep)).toBe(true);
		expect(existsSync(msgGitkeep)).toBe(true);
		expect(result.files.length).toBeGreaterThan(0);
	});

	test("creates for TypeScript with correct path prefix", () => {
		const dir = tempDir();
		const result = generateProjectStructure(dir, {
			language: "typescript",
			groupId: "com.example",
			modules: ["api"],
			layers: ["domain", "interfaces/http", "interfaces/graphql"],
		});

		const httpGitkeep = join(dir, "src/com/example/api/interfaces/http/.gitkeep");
		expect(existsSync(httpGitkeep)).toBe(true);
	});

	test("dryRun does not write files", () => {
		const dir = tempDir();
		const result = generateProjectStructure(dir, {
			language: "java",
			groupId: "com.example",
			modules: ["billing"],
			layers: ["domain"],
			dryRun: true,
		});

		expect(result.files.length).toBeGreaterThan(0);
		expect(existsSync(join(dir, "src"))).toBe(false);
	});

	test("creates placeholder source files with canonical references", () => {
		const dir = tempDir();
		const result = generateProjectStructure(dir, {
			language: "java",
			groupId: "com.example",
			modules: ["Billing"],
			layers: ["domain"],
		});

		const placeholder = result.files.find((f) => f.path.endsWith(".java"));
		expect(placeholder?.content).toContain("Canonical Reference");
	});
});

describe("runProjectGenerator", () => {
	test("uses sample modules in dry-run mode", () => {
		const dir = tempDir();
		const result = runProjectGenerator(dir, dir, {
			language: "java",
			groupId: "com.example",
			dryRun: true,
			defaults: { layers: ["domain", "interfaces/http"] },
		});
		expect(result.modules).toContain("billing");
	});
});
