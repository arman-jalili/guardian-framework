import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createManifest } from "../src/lib/manifest";
import {
	AVAILABLE_VALIDATORS,
	getDefaultContext,
	getValidatorScripts,
	renderTemplate,
} from "../src/lib/templates";

describe("template rendering", () => {
	test("renders command placeholders used by shell templates", () => {
		const context = getDefaultContext("rust", "demo", "gh");

		const rendered = renderTemplate("[build command]\n[test command]\n[audit command]", context);

		expect(rendered).toContain("cargo build");
		expect(rendered).toContain("cargo test --all");
		expect(rendered).toContain("cargo audit");
		expect(rendered).not.toContain("[build command]");
		expect(rendered).not.toContain("[test command]");
		expect(rendered).not.toContain("[audit command]");
	});

	test("uses plural tests validator to match validate-tests.sh", () => {
		expect(AVAILABLE_VALIDATORS).toContain("tests");
		expect(AVAILABLE_VALIDATORS).not.toContain("test");
		expect(getValidatorScripts(["ci", "tests", "architecture"])).toEqual([
			"validate-ci.sh",
			"validate-tests.sh",
			"validate-architecture.sh",
		]);
	});

	test("manifest preserves scaffold template context for future updates", () => {
		const context = getDefaultContext("rust", "demo-cli", "gh");
		const manifest = createManifest({
			language: "rust",
			repoTool: "gh",
			templateContext: context,
			tools: ["pi"],
			validators: ["ci", "tests"],
			workflows: ["feature-development"],
		});

		expect(manifest.templateContext?.projectName).toBe("demo-cli");
		expect(manifest.templateContext?.buildCommand).toBe("cargo build");
	});

	test("pi extension templates are self-contained", () => {
		const coordinator = readFileSync("templates/pi/extensions/coordinator.ts", "utf-8");
		const validationRunner = readFileSync("templates/pi/extensions/validation-runner.ts", "utf-8");

		expect(coordinator).not.toContain("@mariozechner/pi-coding-agent");
		expect(coordinator).not.toContain("typebox");
		expect(validationRunner).not.toContain("@mariozechner/pi-coding-agent");
		expect(validationRunner).not.toContain("typebox");
		expect(validationRunner).toContain("guardian_scope");
		expect(validationRunner).toContain("VALIDATORS");
	});

	test("pi templates do not point agents at generated script folders", () => {
		const featureWorkflow = readFileSync("templates/pi/prompts/feature-development.md", "utf-8");
		const createMrScript = readFileSync("templates/pi/scripts/create-mr.sh", "utf-8");

		expect(featureWorkflow).not.toContain(".claude/scripts");
		expect(featureWorkflow).not.toContain(".opencode/scripts");
		expect(createMrScript).not.toContain(".claude/scripts");
		expect(createMrScript).toContain(".pi/scripts/validate-ci.sh");
	});
});
