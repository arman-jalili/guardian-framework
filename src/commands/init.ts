/**
 * Init command for GuardianCLI
 *
 * Scaffolds the agentic framework with interactive prompts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { cancel, intro, isCancel, outro, spinner } from "@clack/prompts";
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
		});

		// Track all scaffolded files
		const scaffoldedFiles: Record<string, { category: FileCategory; content: string }> = {};

		// Scaffold .pi/ directory (always, as source of truth)
		const piDir = path.join(targetDir, PI_DIR);
		scaffoldPiDirectory(piDir, context, validators, workflows, scaffoldedFiles);

		// Generate exports for selected tools
		for (const tool of options.tools) {
			if (tool !== "pi") {
				const exportDir = path.join(targetDir, `.${tool}`);
				generateExport(exportDir, tool, piDir, scaffoldedFiles);
			}
		}

		// Update and write manifest
		updateManifestAfterScaffold(targetDir, manifest, scaffoldedFiles);

		s.stop("Framework scaffolded successfully!");
		showSuccess(`
Scaffolded GuardianCLI framework:
  .pi/         (source of truth)
  ${options.tools
		.filter((t) => t !== "pi")
		.map((t) => `.${t}/`)
		.join("\n  ")}

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
 * Generate export directory from .pi/ source
 */
function generateExport(
	exportDir: string,
	tool: Tool,
	piDir: string,
	scaffoldedFiles: Record<string, { category: FileCategory; content: string }>,
): void {
	// Create directory structure based on tool
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

		// Read source content
		const content = fs.readFileSync(sourcePath, "utf-8");

		// Apply transformation if needed
		const transformed = mapping.transform ? mapping.transform(content) : content;

		// Write to target
		fs.mkdirSync(path.dirname(targetPath), { recursive: true });
		fs.writeFileSync(targetPath, transformed, "utf-8");

		// Track in scaffolded files
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

/**
 * Get export directory structure for tool
 */
function getExportStructure(tool: Tool): string[] {
	switch (tool) {
		case "claude":
			return [
				"context",
				"agents/orchestrators",
				"agents/validators",
				"agents/implementers",
				"workflows",
				"scripts",
			];
		case "opencode":
			return ["context", "prompts", "workflows", "scripts"];
		case "agents":
			return ["agents", "context", "workflows", "scripts"];
		default:
			return [];
	}
}

/**
 * Get export mappings for tool
 */
interface ExportMapping {
	source: string;
	dest: string;
	transform?: (content: string) => string;
}

function getExportMappings(tool: Tool): ExportMapping[] {
	switch (tool) {
		case "claude":
			return [
				{ source: "agent/AGENTS.md", dest: "context/project.md" },
				{ source: "context/patterns.md", dest: "context/patterns.md" },
				{ source: "context/checklists.md", dest: "context/checklists.md" },
				{ source: "context/output-formats.md", dest: "context/output-formats.md" },
				{
					source: "skills/agents/architecture-coordinator.md",
					dest: "agents/orchestrators/architecture-coordinator.md",
				},
				{
					source: "skills/agents/architecture-validator.md",
					dest: "agents/validators/architecture-validator.md",
				},
				{
					source: "skills/agents/security-validator.md",
					dest: "agents/validators/security-validator.md",
				},
				{
					source: "skills/agents/operations-validator.md",
					dest: "agents/validators/operations-validator.md",
				},
				{ source: "skills/agents/test-validator.md", dest: "agents/validators/test-validator.md" },
				{
					source: "skills/agents/integration-validator.md",
					dest: "agents/validators/integration-validator.md",
				},
				{
					source: "skills/agents/ci-mr-validator.md",
					dest: "agents/validators/ci-mr-validator.md",
				},
				{
					source: "skills/agents/code-developer.md",
					dest: "agents/implementers/code-developer.md",
				},
				{ source: "skills/agents/issue-creator.md", dest: "agents/implementers/issue-creator.md" },
				{
					source: "skills/agents/documentation-maintainer.md",
					dest: "agents/implementers/documentation-maintainer.md",
				},
				{ source: "INDEX.md", dest: "INDEX.md" },
			];
		case "opencode":
			return [
				{ source: "agent/AGENTS.md", dest: "context/project.md" },
				{ source: "context/patterns.md", dest: "context/patterns.md" },
				{ source: "context/checklists.md", dest: "context/checklists.md" },
				{ source: "context/output-formats.md", dest: "context/output-formats.md" },
				{ source: "INDEX.md", dest: "INDEX.md" },
				// Agents as .txt prompts
				{
					source: "skills/agents/architecture-coordinator.md",
					dest: "prompts/architecture-coordinator.txt",
					transform: (c) => c.replace(/^---\n.*?\n---\n/, "").trim(),
				},
				{
					source: "skills/agents/code-developer.md",
					dest: "prompts/code-developer.txt",
					transform: (c) => c.replace(/^---\n.*?\n---\n/, "").trim(),
				},
			];
		case "agents":
			return [
				{ source: "agent/AGENTS.md", dest: "context/project.md" },
				{ source: "context/patterns.md", dest: "context/patterns.md" },
				{ source: "context/checklists.md", dest: "context/checklists.md" },
				{ source: "context/output-formats.md", dest: "context/output-formats.md" },
				// Flat agent structure
				{
					source: "skills/agents/architecture-coordinator.md",
					dest: "agents/architecture-coordinator.md",
				},
				{
					source: "skills/agents/architecture-validator.md",
					dest: "agents/architecture-validator.md",
				},
				{ source: "skills/agents/security-validator.md", dest: "agents/security-validator.md" },
				{ source: "skills/agents/operations-validator.md", dest: "agents/operations-validator.md" },
				{ source: "skills/agents/test-validator.md", dest: "agents/test-validator.md" },
				{
					source: "skills/agents/integration-validator.md",
					dest: "agents/integration-validator.md",
				},
				{ source: "skills/agents/ci-mr-validator.md", dest: "agents/ci-mr-validator.md" },
				{ source: "skills/agents/code-developer.md", dest: "agents/code-developer.md" },
				{ source: "skills/agents/issue-creator.md", dest: "agents/issue-creator.md" },
				{
					source: "skills/agents/documentation-maintainer.md",
					dest: "agents/documentation-maintainer.md",
				},
				{ source: "INDEX.md", dest: "INDEX.md" },
			];
		default:
			return [];
	}
}

/**
 * Generate README for export directory
 */
function generateExportReadme(tool: Tool): string {
	return `# GuardianCLI Framework (${tool})

Generated from .pi/ source.

## Quick Reference

See INDEX.md for framework structure.

## Commands

- \`npx guardian-framework-cli generate --tool ${tool}\` — Regenerate from .pi/
- \`npx guardian-framework-cli update\` — Update .pi/ source

---

Generated by GuardianCLI
`;
}

/**
 * Run smart merge update
 */
async function runMerge(targetDir: string): Promise<void> {
	const s = startSpinner("Merging framework...");

	const manifest = readManifest(targetDir);
	if (!manifest) {
		s.stop("No manifest found");
		showError("Cannot merge without manifest. Run init --overwrite instead.");
		return;
	}

	// TODO: Implement smart merge logic
	// - Check checksums for framework files
	// - Preserve user-editable files
	// - Update unchanged framework files

	s.stop("Merge completed (placeholder)");
	showSuccess("Framework merged successfully.");
}

/**
 * Confirm overwrite
 */
async function confirmOverwrite(targetDir: string): Promise<boolean> {
	// Use @clack/prompts directly
	const { confirm } = await import("@clack/prompts");
	const result = await confirm({
		message: `Overwrite existing framework in ${targetDir}?`,
	});

	if (isCancel(result)) {
		return false;
	}

	return result as boolean;
}
