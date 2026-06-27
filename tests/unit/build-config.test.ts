import { describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateBuildConfig } from "../../src/lib/build-config";

function tempDir(): string {
	const dir = join(tmpdir(), `build-config-test-${randomUUID()}`);
	mkdirSync(dir, { recursive: true });
	return dir;
}

describe("generateBuildConfig — Java Maven", () => {
	test("generates pom.xml with spring-boot-starter-web for http sub-layer", () => {
		const dir = tempDir();
		const result = generateBuildConfig(dir, {
			language: "java",
			buildTool: "maven",
			groupId: "com.example",
			projectName: "myapp",
			version: "0.1.0",
			layers: ["domain", "application", "infrastructure", "interfaces/http"],
		});

		const pom = result.files.find((f) => f.path.endsWith("pom.xml"));
		expect(pom).toBeDefined();
		expect(pom?.content).toContain("spring-boot-starter-web");
	});

	test("generates pom.xml with messaging dep when interfaces/messaging in layers", () => {
		const dir = tempDir();
		const result = generateBuildConfig(dir, {
			language: "java",
			buildTool: "maven",
			groupId: "com.example",
			projectName: "myapp",
			version: "0.1.0",
			layers: ["domain", "application", "infrastructure", "interfaces/messaging"],
		});

		const pom = result.files.find((f) => f.path.endsWith("pom.xml"));
		expect(pom?.content).toContain("spring-boot-starter-amqp");
	});

	test("does not include messaging dep when not in layers", () => {
		const dir = tempDir();
		const result = generateBuildConfig(dir, {
			language: "java",
			buildTool: "maven",
			groupId: "com.example",
			projectName: "myapp",
			version: "0.1.0",
			layers: ["domain", "application", "interfaces/http"],
		});

		const pom = result.files.find((f) => f.path.endsWith("pom.xml"));
		expect(pom?.content).not.toContain("spring-boot-starter-amqp");
	});

	test("dryRun does not write files", () => {
		const dir = tempDir();
		const result = generateBuildConfig(dir, {
			language: "java",
			buildTool: "maven",
			groupId: "com.example",
			projectName: "myapp",
			version: "0.1.0",
			layers: ["domain"],
			dryRun: true,
		});
		expect(existsSync(join(dir, "pom.xml"))).toBe(false);
	});
});

describe("generateBuildConfig — Java Gradle", () => {
	test("generates build.gradle with correct group and version", () => {
		const dir = tempDir();
		const result = generateBuildConfig(dir, {
			language: "java",
			buildTool: "gradle",
			groupId: "com.example",
			projectName: "myapp",
			version: "0.1.0",
			layers: ["domain", "application", "interfaces/http"],
		});

		const gradle = result.files.find((f) => f.path.endsWith("build.gradle"));
		expect(gradle).toBeDefined();
		expect(gradle?.content).toContain("com.example");
	});
});

describe("generateBuildConfig — TypeScript", () => {
	test("generates package.json with graphql-yoga when interfaces/graphql in layers", () => {
		const dir = tempDir();
		const result = generateBuildConfig(dir, {
			language: "typescript",
			groupId: "com.example",
			projectName: "myapp",
			version: "0.1.0",
			layers: ["domain", "application", "interfaces/http", "interfaces/graphql"],
		});

		const pkg = result.files.find((f) => f.path.endsWith("package.json"));
		expect(pkg).toBeDefined();
		expect(pkg?.content).toContain("graphql-yoga");
	});

	test("does not include graphql-yoga when graphql not in layers", () => {
		const dir = tempDir();
		const result = generateBuildConfig(dir, {
			language: "typescript",
			groupId: "com.example",
			projectName: "myapp",
			version: "0.1.0",
			layers: ["domain", "application", "interfaces/http"],
		});

		const pkg = result.files.find((f) => f.path.endsWith("package.json"));
		expect(pkg?.content).not.toContain("graphql-yoga");
	});
});
