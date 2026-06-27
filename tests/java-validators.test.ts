import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const JAVA_VALIDATORS_DIR = "templates/pi/scripts/languages/java";

describe("Java validator scripts exist", () => {
	const expectedScripts = [
		"validate-ci.sh",
		"validate-tests.sh",
		"validate-architecture.sh",
		"validate-security.sh",
		"validate-canonical.sh",
		"validate-operations.sh",
		"validate-integration.sh",
	];

	for (const script of expectedScripts) {
		test(`${script} exists in Java validators directory`, () => {
			const path = join(JAVA_VALIDATORS_DIR, script);
			expect(existsSync(path)).toBe(true);
		});

		test(`${script} has bash shebang`, () => {
			const path = join(JAVA_VALIDATORS_DIR, script);
			const content = readFileSync(path, "utf-8");
			expect(content.startsWith("#!/usr/bin/env bash")).toBe(true);
		});

		test(`${script} has pass/fail functions`, () => {
			const path = join(JAVA_VALIDATORS_DIR, script);
			const content = readFileSync(path, "utf-8");
			expect(content).toContain("pass()");
			expect(content).toContain("fail()");
		});
	}
});

describe("validate-annotations.sh exists", () => {
	test("validate-annotations.sh exists", () => {
		const path = join(JAVA_VALIDATORS_DIR, "validate-annotations.sh");
		expect(existsSync(path)).toBe(true);
	});

	test("validate-annotations.sh has @Transactional check", () => {
		const content = readFileSync(join(JAVA_VALIDATORS_DIR, "validate-annotations.sh"), "utf-8");
		expect(content).toContain("@Transactional");
	});

	test("validate-annotations.sh has field injection check", () => {
		const content = readFileSync(join(JAVA_VALIDATORS_DIR, "validate-annotations.sh"), "utf-8");
		expect(content).toContain("@Autowired");
	});

	test("validate-annotations.sh has layering check", () => {
		const content = readFileSync(join(JAVA_VALIDATORS_DIR, "validate-annotations.sh"), "utf-8");
		expect(content).toContain("layering");
	});
});

describe("validate-spring-architecture.sh exists", () => {
	test("validate-spring-architecture.sh exists", () => {
		const path = join(JAVA_VALIDATORS_DIR, "validate-spring-architecture.sh");
		expect(existsSync(path)).toBe(true);
	});

	test("validate-spring-architecture.sh has domain ring check", () => {
		const content = readFileSync(
			join(JAVA_VALIDATORS_DIR, "validate-spring-architecture.sh"),
			"utf-8",
		);
		expect(content).toContain("Domain");
		expect(content).toContain("ring");
	});

	test("validate-spring-architecture.sh has application ring check", () => {
		const content = readFileSync(
			join(JAVA_VALIDATORS_DIR, "validate-spring-architecture.sh"),
			"utf-8",
		);
		expect(content).toContain("Application ring");
	});

	test("validate-spring-architecture.sh has web ring check", () => {
		const content = readFileSync(
			join(JAVA_VALIDATORS_DIR, "validate-spring-architecture.sh"),
			"utf-8",
		);
		expect(content).toContain("Web ring");
	});
});

describe("spring.toml exists", () => {
	test("spring.toml exists in validators", () => {
		const path = "templates/pi/validators/spring.toml";
		expect(existsSync(path)).toBe(true);
	});

	test("spring.toml has schema_version", () => {
		const content = readFileSync("templates/pi/validators/spring.toml", "utf-8");
		expect(content).toContain("schema_version");
	});

	test("spring.toml has filter definitions", () => {
		const content = readFileSync("templates/pi/validators/spring.toml", "utf-8");
		expect(content).toContain("[filters.");
	});

	test("spring.toml has inline tests", () => {
		const content = readFileSync("templates/pi/validators/spring.toml", "utf-8");
		expect(content).toContain("[[tests.");
	});
});

describe("Java validation-runner integration", () => {
	test("validation-runner.ts references language-specific directory", () => {
		const content = readFileSync(".pi/extensions/validation-runner.ts", "utf-8");
		expect(content).toContain("languages");
	});

	test("validation-runner.ts has getLanguageValidators function", () => {
		const content = readFileSync(".pi/extensions/validation-runner.ts", "utf-8");
		expect(content).toContain("getLanguageValidators");
	});

	test("validation-runner.ts reads manifest for language", () => {
		const content = readFileSync(".pi/extensions/validation-runner.ts", "utf-8");
		expect(content).toContain("getProjectLanguage");
	});
});

describe("shouldSkipFile filters language scripts", () => {
	test("init.ts shouldSkipFile has language parameter", () => {
		const content = readFileSync("src/commands/init.ts", "utf-8");
		expect(content).toContain("langScriptMatch");
	});

	test("init.ts shouldSkipFile checks language match before skipping", () => {
		const content = readFileSync("src/commands/init.ts", "utf-8");
		expect(content).toContain("langScriptMatch");
		expect(content).toContain("scriptLanguage");
	});
});
