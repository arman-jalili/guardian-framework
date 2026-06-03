/**
 * Project Command — CLI handler for `guardian project create`
 *
 * Reads architecture modules, invokes the structure generator, build config
 * generator, and CI generator in sequence.
 *
 * Canonical Reference: .pi/architecture/modules/project-scaffolding-epic0.md#project-command
 * Last Sync: 2026-06-03
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { Language } from "../lib/templates.js";
import { PROJECT_DEFAULTS, SUPPORTED_LANGUAGES } from "../lib/templates.js";
import { runProjectGenerator } from "../lib/project-generator.js";
import { generateBuildConfig } from "../lib/build-config.js";
import { generateCiPipeline } from "../lib/ci-generator.js";
import { showError, showSuccess } from "../lib/prompts.js";

export interface ProjectCreateOptions {
	language: Language;
	buildTool?: "maven" | "gradle";
	groupId: string;
	repoTool: "gh" | "glab";
	validators: string[];
	dryRun?: boolean;
	force?: boolean;
}

const PI_DIR = ".pi";

/**
 * Check if a project already has source files.
 */
function existingProjectDetected(targetDir: string): boolean {
	const srcDir = path.join(targetDir, "src");
	return fs.existsSync(srcDir);
}

/**
 * Main handler for `guardian project create`.
 */
export async function runProjectCreate(
	targetDir: string,
	options: ProjectCreateOptions,
): Promise<void> {
	const { language, buildTool, groupId, repoTool, validators, dryRun, force } = options;

	// Validate language
	if (!SUPPORTED_LANGUAGES.includes(language)) {
		showError(`Unsupported language: ${language}. Supported: ${SUPPORTED_LANGUAGES.join(", ")}`);
		return;
	}

	// Check for existing project (Issue #30)
	if (!force && existingProjectDetected(targetDir)) {
		console.log(`\n⚠️  Existing project source detected at ${targetDir}/src/.`);
		console.log("   Use --force to scaffold alongside existing code, or run in a different directory.\n");
		return;
	}

	const archDir = path.join(targetDir, PI_DIR, "architecture");

	if (!fs.existsSync(archDir)) {
		console.log(`\nℹ️  No .pi/architecture/ directory found. Using defaults.\n`);
	}

	// Resolve defaults
	const defaults = PROJECT_DEFAULTS[language] ?? {};

	if (dryRun) {
		console.log("\n📋 Dry Run — Project Scaffolding Plan\n");
		console.log(`  Language:    ${language}`);
		console.log(`  Build Tool:  ${buildTool ?? "maven (default)"}`);
		console.log(`  Group ID:    ${groupId}`);
		console.log(`  Repo Tool:   ${repoTool}`);
		console.log(`  Validators:  ${validators.join(", ")}`);
		console.log("");
	}

	// Step 1: Generate source directory structure
	console.log(dryRun ? "📋 [DRY-RUN] Generating project structure..." : "📁 Generating project structure...");
	const structurePlan = runProjectGenerator(targetDir, archDir, {
		language,
		groupId,
		buildTool,
		dryRun,
		defaults,
	});

	if (dryRun) {
		console.log("  Modules:");
		for (const mod of structurePlan.modules) {
			console.log(`    - ${mod}`);
		}
		console.log("  Layers:");
		for (const layer of structurePlan.layers) {
			console.log(`    - ${layer}`);
		}
		console.log(`  Files to create: ${structurePlan.files.length}\n`);
	} else {
		console.log(`  ✅ ${structurePlan.files.length} files created (${structurePlan.modules.length} modules × ${structurePlan.layers.length} layers)\n`);
	}

	// Step 2: Generate build configuration
	console.log(dryRun ? "📋 [DRY-RUN] Generating build configuration..." : "📄 Generating build configuration...");
	const buildPlan = generateBuildConfig(targetDir, {
		language,
		buildTool: buildTool ?? "maven",
		groupId,
		projectName: path.basename(targetDir),
		version: "0.1.0",
		layers: structurePlan.layers,
		dryRun,
	});

	if (dryRun) {
		for (const file of buildPlan.files) {
			console.log(`  - ${path.relative(targetDir, file.path)}`);
		}
		console.log("");
	} else {
		console.log(`  ✅ ${buildPlan.files.length} build config files created\n`);
	}

	// Step 3: Generate CI pipeline
	console.log(dryRun ? "📋 [DRY-RUN] Generating CI pipeline..." : "🔧 Generating CI pipeline...");
	const ciPlan = generateCiPipeline(targetDir, {
		language,
		buildTool: buildTool ?? "maven",
		repoTool,
		validators,
		dryRun,
	});

	if (dryRun) {
		for (const file of ciPlan.files) {
			console.log(`  - ${path.relative(targetDir, file.path)}`);
		}
		console.log("\n📋 Dry run complete. Pass --dryRun to see this plan before creating files.\n");
	} else {
		console.log(`  ✅ ${ciPlan.files.length} CI pipeline files created\n`);
		showSuccess(`Project scaffolding complete for ${language} project.`);
	}
}
