/**
 * Generate command for GuardianCLI
 *
 * Regenerates exports from .pi/ source after edits
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { outro, spinner } from "@clack/prompts";
import {
	type FileCategory,
	type GuardianManifest,
	MANIFEST_FILE,
	addExportRecord,
	addFileRecord,
	hashDirectory,
	readManifest,
	writeManifest,
} from "../lib/manifest.js";
import { type Tool, templatesExist } from "../lib/templates.js";

/**
 * Run generate command
 */
export async function runGenerate(targetDir: string, options: { tool?: string; dryRun?: boolean; force?: boolean }): Promise<void> {
	// Check if templates exist
	if (!templatesExist()) {
		outro("Templates not found. Ensure templates/pi/ exists in package.");
		return;
	}

	// Check for manifest
	const manifest = readManifest(targetDir);
	if (!manifest) {
		outro("No manifest found. Run 'guardian-framework-cli init' first.");
		return;
	}

	// Determine which tools to generate
	const toolsToGenerate = options.tool
		? options.tool === "all"
			? manifest.tools.filter((t) => t !== "pi")
			: [options.tool as Tool]
		: manifest.tools.filter((t) => t !== "pi");

	if (toolsToGenerate.length === 0) {
		outro("No export tools configured. Only .pi/ exists as source.");
		return;
	}

	const s = spinner();
	s.start("Generating exports from .pi/ source...");

	try {
		const piDir = path.join(targetDir, ".pi");
		const generatedFiles: Record<string, { category: FileCategory; content: string }> = {};

		for (const tool of toolsToGenerate) {
			const exportDir = path.join(targetDir, `.${tool}`);

			if (options.dryRun) {
				s.stop(`Dry run: Would generate .${tool}/ from .pi/`);
				continue;
			}

			// Generate export
			generateExport(exportDir, tool as Tool, piDir, manifest, generatedFiles);

			// Update manifest export record
			addExportRecord(manifest, tool, `.${tool}/`, piDir);
		}

		// Update generated files in manifest
		for (const [filePath, record] of Object.entries(generatedFiles)) {
			addFileRecord(manifest, filePath, record.category, record.content);
		}

		// Update timestamp
		manifest.lastUpdatedAt = new Date().toISOString();

		// Write updated manifest
		if (!options.dryRun) {
			writeManifest(targetDir, manifest);
		}

		s.stop("Exports generated successfully!");

		outro(`
Generated exports:
  ${toolsToGenerate.map((t) => `.${t}/`).join("\n  ")}

From .pi/ source.

Next steps:
  1. Review generated files
  2. Run validators: bash .pi/scripts/validate-ci.sh
`);
	} catch (error) {
		s.stop("Generation failed!");
		outro(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
	}
}

/**
 * Generate export directory from .pi/ source
 */
function generateExport(
	exportDir: string,
	tool: Tool,
	piDir: string,
	manifest: GuardianManifest,
	generatedFiles: Record<string, { category: FileCategory; content: string }>,
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

		// Add canonical header for generated files
		const withHeader = addCanonicalHeader(transformed, mapping.source);

		// Write to target
		fs.mkdirSync(path.dirname(targetPath), { recursive: true });
		fs.writeFileSync(targetPath, withHeader, "utf-8");

		// Track in generated files
		const manifestPath = `.${tool}/${mapping.dest}`;
		generatedFiles[manifestPath] = { category: "generated", content: withHeader };
	}

	// Copy scripts if they exist
	const scriptsDir = path.join(piDir, "scripts");
	if (fs.existsSync(scriptsDir)) {
		const scriptsTargetDir = path.join(exportDir, "scripts");
		fs.mkdirSync(scriptsTargetDir, { recursive: true });

		for (const validator of manifest.validators) {
			const scriptFile = `validate-${validator}.sh`;
			const sourceScript = path.join(scriptsDir, scriptFile);
			const targetScript = path.join(scriptsTargetDir, scriptFile);

			if (fs.existsSync(sourceScript)) {
				const scriptContent = fs.readFileSync(sourceScript, "utf-8");
				fs.writeFileSync(targetScript, scriptContent, "utf-8");
				generatedFiles[`.${tool}/scripts/${scriptFile}`] = {
					category: "generated",
					content: scriptContent,
				};
			}
		}

		// Copy validation-cache.sh if exists
		const cacheScript = path.join(scriptsDir, "validation-cache.sh");
		if (fs.existsSync(cacheScript)) {
			const targetCacheScript = path.join(scriptsTargetDir, "validation-cache.sh");
			const cacheContent = fs.readFileSync(cacheScript, "utf-8");
			fs.writeFileSync(targetCacheScript, cacheContent, "utf-8");
			generatedFiles[`.${tool}/scripts/validation-cache.sh`] = {
				category: "generated",
				content: cacheContent,
			};
		}
	}

	// Generate README for export
	const readmePath = path.join(exportDir, "README.md");
	const readmeContent = generateExportReadme(tool);
	fs.writeFileSync(readmePath, readmeContent, "utf-8");
	generatedFiles[`.${tool}/README.md`] = {
		category: "generated",
		content: readmeContent,
	};
}

/**
 * Add canonical reference header to generated files
 */
function addCanonicalHeader(content: string, sourcePath: string): string {
	const header = `<!--
Canonical Reference: .pi/${sourcePath}
Generated: ${new Date().toISOString()}
DO NOT EDIT DIRECTLY - Modify source in .pi/
-->

`;

	// Check if content already has frontmatter
	if (content.startsWith("---\n")) {
		// Insert after frontmatter
		const frontmatterEnd = content.indexOf("---\n", 4);
		if (frontmatterEnd !== -1) {
			const frontmatter = content.slice(0, frontmatterEnd + 4);
			const body = content.slice(frontmatterEnd + 4);
			return `${frontmatter}\n${header}${body}`;
		}
	}

	return `${header}${content}`;
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
				"architecture/modules",
				"architecture/diagrams",
				"architecture/decisions",
			];
		case "opencode":
			return ["context", "prompts", "workflows", "scripts"];
		case "agents":
			return ["agents", "context", "workflows", "scripts"];
		case "github":
			return ["instructions", "agents", "copilot"];
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
				// Main project instructions
				{ source: "agent/AGENTS.md", dest: "CLAUDE.md" },
				// Context files
				{ source: "context/patterns.md", dest: "context/patterns.md" },
				{ source: "context/checklists.md", dest: "context/checklists.md" },
				{ source: "context/output-formats.md", dest: "context/output-formats.md" },
				{ source: "context/project.md", dest: "context/project.md" },
				// Architecture files
				{ source: "architecture/CHANGELOG.md", dest: "architecture/CHANGELOG.md" },
				// Agent definitions
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
				// Workflow prompts
				{ source: "prompts/feature-development.md", dest: "workflows/feature-development.md" },
				{ source: "prompts/bug-fix.md", dest: "workflows/bug-fix.md" },
				{ source: "prompts/hotfix.md", dest: "workflows/hotfix.md" },
				{ source: "prompts/refactoring.md", dest: "workflows/refactoring.md" },
				{ source: "prompts/epic-plan.md", dest: "workflows/epic-plan.md" },
				{ source: "prompts/issue-draft.md", dest: "workflows/issue-draft.md" },
				{ source: "prompts/git-issues.md", dest: "workflows/git-issues.md" },
				{ source: "prompts/issue-closeout.md", dest: "workflows/issue-closeout.md" },
				{ source: "prompts/issue-merge.md", dest: "workflows/issue-merge.md" },
				{ source: "prompts/plan-to-issues.md", dest: "workflows/plan-to-issues.md" },
				{ source: "prompts/blueprint-validate.md", dest: "workflows/blueprint-validate.md" },
				{ source: "prompts/sync-check.md", dest: "workflows/sync-check.md" },
				{ source: "prompts/context-refresh.md", dest: "workflows/context-refresh.md" },
				{ source: "prompts/scope-analyzer.md", dest: "workflows/scope-analyzer.md" },
				{ source: "prompts/pattern-extract.md", dest: "workflows/pattern-extract.md" },
				{ source: "prompts/blueprint-update.md", dest: "workflows/blueprint-update.md" },
				// Reference
				{ source: "INDEX.md", dest: "context/INDEX.md" },
			];
		case "opencode":
			return [
				{ source: "agent/AGENTS.md", dest: "context.md" },
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
		case "github":
			return [
				// Main instructions
				{ source: "agent/AGENTS.md", dest: "copilot-instructions.md" },
				// Custom instructions
				{ source: "github/instructions/architecture.instructions.md", dest: "instructions/architecture.instructions.md" },
				{ source: "github/instructions/validation.instructions.md", dest: "instructions/validation.instructions.md" },
				// Agent definitions
				{ source: "github/agents/architecture-coordinator.agent.md", dest: "agents/architecture-coordinator.agent.md" },
				{ source: "github/agents/epic-planner.agent.md", dest: "agents/epic-planner.agent.md" },
				// Settings
				{ source: "github/copilot/settings.json", dest: "copilot/settings.json" },
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