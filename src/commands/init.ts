/**
 * Init command for GuardianCLI
 *
 * Scaffolds the agentic framework with interactive prompts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { confirm, isCancel } from "@clack/prompts";
import {
	generateExportReadme,
	getExportMappings,
	getExportStructure,
} from "../lib/export-mappings.js";
import {
	type FileCategory,
	type GuardianManifest,
	MANIFEST_FILE,
	categorizeFile,
	createManifest,
	manifestExists,
	readManifest,
	updateManifestAfterScaffold,
	writeManifest,
} from "../lib/manifest.js";
import {
	askExistingFrameworkAction,
	runInitPrompts,
	showError,
	showSuccess,
	startSpinner,
} from "../lib/prompts.js";
import {
	type Language,
	type RepoTool,
	type TemplateContext,
	type Tool,
	type Validator,
	type Workflow,
	filterValidators,
	filterWorkflows,
	getDefaultContext,
	getPiTemplateFiles,
	getValidatorScripts,
	getWorkflowPrompts,
	readLanguagePatterns,
	readTemplate,
	renderTemplate,
	templatesExist,
} from "../lib/templates.js";

/**
 * Scaffold directory paths
 */
const PI_DIR = ".pi";
const CLAUDE_DIR = ".claude";
const OPENCODE_DIR = ".opencode";
const AGENTS_DIR = ".agents";

/**
 * Run init command
 */
export async function runInit(targetDir: string = process.cwd()): Promise<void> {
	// Check if templates exist
	if (!templatesExist()) {
		showError("Templates not found. Ensure templates/pi/ exists.");
		return;
	}

	// Check for existing framework
	if (manifestExists(targetDir)) {
		const action = await askExistingFrameworkAction();
		if (!action || action === "cancel") {
			showSuccess("No changes made.");
			return;
		}

		if (action === "merge") {
			await runMerge(targetDir);
			return;
		}

		// action === "overwrite"
		const confirmed = await confirmOverwrite(targetDir);
		if (!confirmed) {
			showSuccess("No changes made.");
			return;
		}
	}

	// Run interactive prompts
	const options = await runInitPrompts();
	if (!options) {
		return; // Cancelled
	}

	// Scaffold the framework
	await scaffoldFramework(targetDir, options);
}

/**
 * Scaffold the framework based on options
 */
async function scaffoldFramework(
	targetDir: string,
	options: {
		tools: Tool[];
		language: Language;
		repoTool: RepoTool;
		validators: Validator[];
		workflows: Workflow[];
		projectName: string;
		projectVersion: string;
		projectType: string;
		repository: string;
	},
): Promise<void> {
	const s = startSpinner("Scaffolding framework...");

	try {
		// Get template context with language defaults and repo tool
		const context: TemplateContext = {
			...getDefaultContext(options.language, options.projectName, options.repoTool),
			projectVersion: options.projectVersion,
			projectType: options.projectType,
			repository: options.repository,
			repoTool: options.repoTool,
		};

		// Filter validators and workflows
		const validators = filterValidators(options.validators);
		const workflows = filterWorkflows(options.workflows);

		// Create manifest
		const manifest = createManifest({
			tools: options.tools,
			language: options.language,
			repoTool: options.repoTool,
			validators,
			workflows,
			templateContext: context,
		});

		// Track all scaffolded files
		const scaffoldedFiles: Record<string, { category: FileCategory; content: string }> = {};

		// Scaffold .pi/ directory (always, as source of truth)
		const piDir = path.join(targetDir, PI_DIR);
		scaffoldPiDirectory(piDir, context, validators, workflows, scaffoldedFiles);

		// Generate exports for selected tools
		for (const tool of options.tools) {
			const exportDir =
				tool === "pi" ? path.join(targetDir, AGENTS_DIR) : path.join(targetDir, `.${tool}`);

			// Create directory structure
			const structure = getExportStructure(tool);
			for (const dir of structure) {
				fs.mkdirSync(path.join(exportDir, dir), { recursive: true });
			}

			// Map pi files to export files
			const mappings = getExportMappings(tool);
			for (const mapping of mappings) {
				const sourcePath = path.join(piDir, mapping.source);
				const targetPath = path.join(exportDir, mapping.dest);

				if (!fs.existsSync(sourcePath)) {
					continue;
				}

				const content = fs.readFileSync(sourcePath, "utf-8");
				const transformed = mapping.transform ? mapping.transform(content) : content;
				fs.mkdirSync(path.dirname(targetPath), { recursive: true });
				fs.writeFileSync(targetPath, transformed, "utf-8");

				const manifestPath = `.${tool}/${mapping.dest}`;
				scaffoldedFiles[manifestPath] = { category: "generated", content: transformed };
			}

			// Generate README for export
			const readmePath = path.join(exportDir, "README.md");
			const readmeContent = generateExportReadme(tool);
			fs.writeFileSync(readmePath, readmeContent, "utf-8");
			scaffoldedFiles[`.${tool}/README.md`] = {
				category: "generated",
				content: readmeContent,
			};
		}

		// Update and write manifest
		updateManifestAfterScaffold(targetDir, manifest, scaffoldedFiles);

		s.stop("Framework scaffolded successfully!");
		const exportPaths = options.tools.map((t) =>
			t === "pi" ? ".agents/skills/ (pi skills)" : `.${t}/`,
		);
		showSuccess(`
Scaffolded GuardianCLI framework:
  .pi/         (source of truth)
  ${exportPaths.join("\n  ")}

Next steps:
  1. Edit .pi/agent/AGENTS.md to customize project context
  2. Edit .pi/scripts/*.sh to set build/test/lint commands
  3. Run: npx guardian-framework-cli generate (after editing .pi/)
`);
	} catch (error) {
		s.stop("Scaffold failed!");
		showError(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
	}
}

/**
 * Scaffold .pi/ directory
 */
function scaffoldPiDirectory(
	piDir: string,
	context: TemplateContext,
	validators: Validator[],
	workflows: Workflow[],
	scaffoldedFiles: Record<string, { category: FileCategory; content: string }>,
): void {
	// Create directory structure
	const directories = [
		"agent",
		"context",
		"skills/agents",
		"skills/validators",
		"prompts",
		"scripts",
		"extensions",
	];

	for (const dir of directories) {
		const fullPath = path.join(piDir, dir);
		fs.mkdirSync(fullPath, { recursive: true });
	}

	// Get all template files
	const templateFiles = getPiTemplateFiles();

	// Scaffold each file
	for (const relativePath of templateFiles) {
		const targetPath = path.join(piDir, relativePath);

		// Skip if it's a template file that should be filtered
		if (shouldSkipFile(relativePath, validators, workflows)) {
			continue;
		}

		// Read and render template
		const content = readTemplate(relativePath);
		const rendered = renderTemplate(content, context);

		// Write file
		fs.mkdirSync(path.dirname(targetPath), { recursive: true });
		fs.writeFileSync(targetPath, rendered, "utf-8");

		// Track in scaffolded files
		const manifestPath = `${PI_DIR}/${relativePath}`;
		const category = categorizeFile(relativePath);
		scaffoldedFiles[manifestPath] = { category, content: rendered };
	}

	// Add language patterns to context/patterns.md
	const patternsPath = path.join(piDir, "context/patterns.md");
	const patternsContent = readLanguagePatterns(context.language);
	const renderedPatterns = renderTemplate(patternsContent, context);
	fs.writeFileSync(patternsPath, renderedPatterns, "utf-8");
	scaffoldedFiles[`${PI_DIR}/context/patterns.md`] = {
		category: "user",
		content: renderedPatterns,
	};

	// Write INDEX.md and README.md
	const indexPath = path.join(piDir, "INDEX.md");
	const indexContent = readTemplate("INDEX.md");
	fs.writeFileSync(indexPath, indexContent, "utf-8");
	scaffoldedFiles[`${PI_DIR}/INDEX.md`] = {
		category: "framework",
		content: indexContent,
	};

	const readmePath = path.join(piDir, "README.md");
	const readmeContent = readTemplate("README.md");
	fs.writeFileSync(readmePath, readmeContent, "utf-8");
	scaffoldedFiles[`${PI_DIR}/README.md`] = {
		category: "framework",
		content: readmeContent,
	};
}

/**
 * Check if file should be skipped based on validator/workflow selection
 */
function shouldSkipFile(
	relativePath: string,
	validators: Validator[],
	workflows: Workflow[],
): boolean {
	// Filter scripts based on validators
	if (relativePath.startsWith("scripts/validate-")) {
		const validatorName = relativePath.replace("scripts/validate-", "").replace(".sh", "");
		if (!validators.includes(validatorName as Validator)) {
			return true;
		}
	}

	// Filter workflow prompts
	if (relativePath.startsWith("prompts/")) {
		const workflowName = relativePath.replace("prompts/", "").replace(".md", "");
		if (!workflows.includes(workflowName as Workflow)) {
			return true;
		}
	}

	return false;
}

/**
 * Run smart merge update
 */
async function runMerge(targetDir: string): Promise<void> {
	const manifest = readManifest(targetDir);
	if (!manifest) {
		showError("Cannot merge without manifest. Run init --overwrite instead.");
		return;
	}

	// Delegate to the update command with --force to apply changes
	// without interactive confirmation (user already confirmed via prompt)
	const { runUpdate } = await import("./update.js");
	await runUpdate(targetDir, { dryRun: false, force: true, regenerate: true });
}

/**
 * Confirm overwrite
 */
async function confirmOverwrite(targetDir: string): Promise<boolean> {
	const result = await confirm({
		message: `Overwrite existing framework in ${targetDir}?`,
	});

	if (isCancel(result)) {
		return false;
	}

	return result as boolean;
}
