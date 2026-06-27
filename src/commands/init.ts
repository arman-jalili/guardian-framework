/**
 * Canonical Reference: .pi/architecture/modules/init-command.md#interactive-prompts
 * Implements: ADR-001, ADR-003, ADR-004
 * Last Sync: 2026-05-31

 * Init command for Guardian
 *
 * Scaffolds the agentic framework with interactive prompts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { confirm, isCancel } from "@clack/prompts";
import {
	FRAMEWORK_VERSION,
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
	AVAILABLE_VALIDATORS,
	AVAILABLE_WORKFLOWS,
	type Language,
	type RepoTool,
	TEMPLATE_DIR,
	type TemplateContext,
	type Tool,
	getDefaultContext,
	getPiTemplateFiles,
	getValidatorScripts,
	getWorkflowPrompts,
	readLanguagePatterns,
	readTemplate,
	renderTemplate,
	templatesExist,
} from "../lib/templates.js";
import { generateExport } from "./generate.js";

/**
 * Canonical Reference: .pi/architecture/modules/init-command.md#interactive-prompts
 * Implements: ADR-001, ADR-003, ADR-004
 * Last Sync: 2026-05-31

 * Scaffold directory paths
 */
const PI_DIR = ".pi";
const CLAUDE_DIR = ".claude";
const OPENCODE_DIR = ".opencode";
const AGENTS_DIR = ".agents";

/**
 * Canonical Reference: .pi/architecture/modules/init-command.md#interactive-prompts
 * Implements: ADR-001, ADR-003, ADR-004
 * Last Sync: 2026-05-31

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
 * Canonical Reference: .pi/architecture/modules/init-command.md#interactive-prompts
 * Implements: ADR-001, ADR-003, ADR-004
 * Last Sync: 2026-05-31

 * Scaffold the framework based on options
 */
async function scaffoldFramework(
	targetDir: string,
	options: {
		tools: Tool[];
		language: Language;
		buildTool?: "maven" | "gradle";
		repoTool: RepoTool;
		archMode: "strict" | "simplified";
		projectName: string;
		projectVersion: string;
		repository: string;
		groupId: string;
		domainDescription: string;
	},
): Promise<void> {
	const s = startSpinner("Scaffolding framework...");

	try {
		// Scaffold all validators and workflows by default
		const validators = [...AVAILABLE_VALIDATORS];
		const workflows = [...AVAILABLE_WORKFLOWS];

		// Get template context with language defaults and repo tool
		const context: TemplateContext = {
			...getDefaultContext(
				options.language,
				options.projectName,
				options.repoTool,
				options.buildTool,
				options.groupId,
			),
			projectVersion: options.projectVersion,
			repository: options.repository,
			repoTool: options.repoTool,
			groupId: options.groupId,
			domainDescription: options.domainDescription,
		};

		// Create manifest
		const manifest = createManifest({
			tools: options.tools,
			language: options.language,
			repoTool: options.repoTool,
			archMode: options.archMode,
			groupId: options.groupId,
			validators,
			workflows,
			templateContext: context,
		});

		// Track all scaffolded files
		const scaffoldedFiles: Record<string, { category: FileCategory; content: string }> = {};

		// Scaffold .pi/ directory (always, as source of truth)
		const piDir = path.join(targetDir, PI_DIR);
		const scaffoldErrors = scaffoldPiDirectory(piDir, context, scaffoldedFiles);

		// Generate exports for selected tools by delegating to generateExport
		const generatedFiles: Record<string, { category: FileCategory; content: string }> = {};
		for (const tool of options.tools) {
			const exportDir =
				tool === "pi" ? path.join(targetDir, AGENTS_DIR) : path.join(targetDir, `.${tool}`);
			generateExport(exportDir, tool, piDir, manifest, generatedFiles);
		}

		// Merge generated files into scaffoldedFiles for manifest tracking
		for (const [filePath, record] of Object.entries(generatedFiles)) {
			scaffoldedFiles[filePath] = record;
		}

		// Generate .gitignore at project root
		const gitignorePath = path.join(targetDir, ".gitignore");
		const gitignoreTemplatePath = path.join(TEMPLATE_DIR, ".gitignore");
		if (fs.existsSync(gitignoreTemplatePath)) {
			const gitignoreContent = fs.readFileSync(gitignoreTemplatePath, "utf-8");
			await fs.promises.writeFile(gitignorePath, gitignoreContent);
			scaffoldedFiles[".gitignore"] = { category: "framework", content: gitignoreContent };
		}

		// Generate WORKFLOW.md at project root
		const workflowPath = path.join(targetDir, "WORKFLOW.md");
		const workflowTemplatePath = path.join(TEMPLATE_DIR, "workflow.md");
		if (fs.existsSync(workflowTemplatePath)) {
			let workflowContent = fs.readFileSync(workflowTemplatePath, "utf-8");
			workflowContent = workflowContent
				.replace(/\[Project Name\]/g, options.projectName)
				.replace(/\[FrameworkVersion\]/g, FRAMEWORK_VERSION)
				.replace(/\[Date\]/g, new Date().toISOString().split("T")[0]);
			await fs.promises.writeFile(workflowPath, workflowContent);
			scaffoldedFiles["WORKFLOW.md"] = { category: "framework", content: workflowContent };
		}

		if (scaffoldErrors.length > 0) {
			console.warn(
				`\n⚠️  Some template files failed to scaffold:\n  ${scaffoldErrors.join("\n  ")}`,
			);
		}

		// Update and write manifest
		updateManifestAfterScaffold(targetDir, manifest, scaffoldedFiles);

		s.stop("Framework scaffolded successfully!");
		const exportPaths = options.tools.map((t) =>
			t === "pi" ? ".agents/skills/ (pi skills)" : `.${t}/`,
		);
		showSuccess(`
Scaffolded Guardian framework:
  .pi/         (source of truth)
  ${exportPaths.join("\n  ")}
  .gitignore   (comprehensive language-agnostic defaults)
  WORKFLOW.md  (entry point for agents + humans)

Next steps:
  1. Open WORKFLOW.md — it's your entry point
  2. Edit .pi/agent/AGENTS.md to customize project context (replace [bracketed] placeholders)
  3. Run: bash .pi/scripts/ci/run_preflight.sh (before committing)
`);
	} catch (error) {
		s.stop("Scaffold failed!");
		showError(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
	}
}

/**
 * Canonical Reference: .pi/architecture/modules/init-command.md#interactive-prompts
 * Implements: ADR-001, ADR-003, ADR-004
 * Last Sync: 2026-05-31

 * Scaffold .pi/ directory.
 * Returns a list of non-fatal errors encountered during scaffolding.
 */
function scaffoldPiDirectory(
	piDir: string,
	context: TemplateContext,
	scaffoldedFiles: Record<string, { category: FileCategory; content: string }>,
): string[] {
	const errors: string[] = [];
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
		if (shouldSkipFile(relativePath, context.language)) {
			continue;
		}

		// Read and render template
		const templateResult = readTemplate(relativePath);
		if (!templateResult.ok) {
			errors.push(`${relativePath}: ${templateResult.error.message}`);
			continue;
		}
		const rendered = renderTemplate(templateResult.value, context);

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
	const patternsResult = readLanguagePatterns(context.language);
	if (patternsResult.ok) {
		const renderedPatterns = renderTemplate(patternsResult.value, context);
		fs.writeFileSync(patternsPath, renderedPatterns, "utf-8");
		scaffoldedFiles[`${PI_DIR}/context/patterns.md`] = {
			category: "user",
			content: renderedPatterns,
		};
	} else {
		errors.push(`context/patterns.md: ${patternsResult.error.message}`);
	}

	// Create initial domain exploration.md placeholder (empty template for agent to fill)
	const explorationPath = path.join(piDir, "domain", "exploration.md");
	const domainDir = path.dirname(explorationPath);
	if (!fs.existsSync(domainDir)) {
		fs.mkdirSync(domainDir, { recursive: true });
	}
	if (!fs.existsSync(explorationPath)) {
		const businessContextLine = context.domainDescription
			? context.domainDescription
			: "_Describe the business domain here after running /domain --explore_";
		const placeholder = [
			"# Domain Exploration",
			"",
			'> **Status:** awaiting-analysis — Run `/domain --explore "business context"` to begin.',
			"",
			"---",
			"",
			"## Business Context",
			"",
			businessContextLine,
			"",
			"---",
			"",
			"## Actors & Roles",
			"",
			"| Actor | Description | Interactions |",
			"|-------|-------------|-------------|",
			"| <!-- Agents fill this after --explore --> | | |",
			"",
			"---",
			"",
			"## Functional Requirements",
			"",
			"| ID | Requirement | Priority | Bounded Context |",
			"|----|-------------|----------|----------------|",
			"",
			"---",
			"",
			"## Non-Functional Requirements",
			"",
			"| ID | Requirement | Category | Target |",
			"|----|-------------|----------|--------|",
			"",
			"---",
			"",
			"## Assumptions",
			"",
			"| Assumption | Impact if Wrong | Mitigation |",
			"|------------|----------------|-----------|",
			"",
			"---",
			"",
			"## Bounded Contexts",
			"",
			"| Context | Description | Entities |",
			"|---------|-------------|----------|",
			"",
			"---",
			"",
			"## Entities",
			"",
			"| Entity | Context | Type | Description |",
			"|--------|---------|------|-------------|",
			"",
			"---",
			"",
			"## Domain Events",
			"",
			"| Event | Context | Description | Triggered By |",
			"|-------|---------|-------------|-------------|",
			"",
			"---",
			"",
			"## Ubiquitous Language",
			"",
			"| Term | Definition | Bounded Context | Aliases/Synonyms |",
			"|------|-----------|----------------|-----------------|",
			"",
			"---",
			"",
			"## Open Questions",
			"",
			"_None identified yet._",
			"",
			"---",
			"",
			"## Aggregate Roots",
			"",
			"_None identified yet._",
		].join("\n");
		fs.writeFileSync(explorationPath, placeholder, "utf-8");
		scaffoldedFiles[`${PI_DIR}/domain/exploration.md`] = {
			category: "user",
			content: placeholder,
		};
	}

	// Write INDEX.md and README.md
	const indexPath = path.join(piDir, "INDEX.md");
	const indexResult = readTemplate("INDEX.md");
	if (indexResult.ok) {
		fs.writeFileSync(indexPath, indexResult.value, "utf-8");
		scaffoldedFiles[`${PI_DIR}/INDEX.md`] = {
			category: "framework",
			content: indexResult.value,
		};
	} else {
		errors.push(`INDEX.md: ${indexResult.error.message}`);
	}

	const readmePath = path.join(piDir, "README.md");
	const readmeResult = readTemplate("README.md");
	if (readmeResult.ok) {
		fs.writeFileSync(readmePath, readmeResult.value, "utf-8");
		scaffoldedFiles[`${PI_DIR}/README.md`] = {
			category: "framework",
			content: readmeResult.value,
		};
	} else {
		errors.push(`README.md: ${readmeResult.error.message}`);
	}

	return errors;
}

/**
 * Canonical Reference: .pi/architecture/modules/init-command.md#interactive-prompts
 * Implements: ADR-001, ADR-003, ADR-004
 * Last Sync: 2026-05-31

 * Check if file should be skipped based on validator/workflow selection
 */
function shouldSkipFile(relativePath: string, language?: Language): boolean {
	// Filter domain exploration template (generated inline, not from template)
	if (relativePath.endsWith("/exploration.md")) {
		return true;
	}

	// Filter language-specific validator scripts
	const langScriptMatch = relativePath.match(/^scripts\/languages\/(\w+)\//);
	if (langScriptMatch) {
		const scriptLanguage = langScriptMatch[1];
		if (scriptLanguage !== language) {
			return true;
		}
	}

	return false;
}

/**
 * Canonical Reference: .pi/architecture/modules/init-command.md#interactive-prompts
 * Implements: ADR-001, ADR-003, ADR-004
 * Last Sync: 2026-05-31

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
 * Canonical Reference: .pi/architecture/modules/init-command.md#interactive-prompts
 * Implements: ADR-001, ADR-003, ADR-004
 * Last Sync: 2026-05-31

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
