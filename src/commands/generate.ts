/**
 * Canonical Reference: .pi/architecture/modules/generate-command.md#export-generation
 * Implements: ADR-001, ADR-004, ADR-005
 * Last Sync: 2026-05-31

 * Generate command for Guardian
 *
 * Regenerates exports from .pi/ source after edits
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { outro, spinner } from "@clack/prompts";
import {
	generateExportReadme,
	getExportMappings,
	getExportStructure,
} from "../lib/export-mappings.js";
import {
	type FileCategory,
	type GuardianManifest,
	MANIFEST_FILE,
	addExportRecord,
	addFileRecord,
	hashDirectory,
	isFileModified,
	readManifest,
	writeManifest,
} from "../lib/manifest.js";
import { retry } from "../lib/retry.js";
import { type Tool, templatesExist } from "../lib/templates.js";
import { loadWorkflowConfig, resolveEnvVars } from "../lib/workflow-config.js";
import { ensureWorkspace, runAfterRunHook, runBeforeRunHook } from "../lib/workspace-hooks.js";

/**
 * Canonical Reference: .pi/architecture/modules/generate-command.md#export-generation
 * Implements: ADR-001, ADR-004, ADR-005
 * Last Sync: 2026-05-31

 * Run generate command
 */
export async function runGenerate(
	targetDir: string,
	options: { tool?: string; dryRun?: boolean; force?: boolean },
): Promise<void> {
	// Check if templates exist
	if (!templatesExist()) {
		outro("Templates not found. Ensure templates/pi/ exists in package.");
		return;
	}

	// Check for manifest
	const manifest = readManifest(targetDir);
	if (!manifest) {
		outro("No manifest found. Run 'guardian-framework init' first.");
		return;
	}

	// Determine which tools to generate
	const toolsToGenerate = options.tool
		? options.tool === "all"
			? manifest.tools
			: [options.tool as Tool]
		: manifest.tools;

	if (toolsToGenerate.length === 0) {
		outro("No export tools configured. Only .pi/ exists as source.");
		return;
	}

	const s = spinner();
	s.start("Generating exports from .pi/ source...");

	try {
		// Load workflow config for hooks and settings
		const piDir = path.join(targetDir, ".pi");
		const config = loadWorkflowConfig(piDir);
		const onConflict = config.generate.on_conflict;

		// Reconciliation: check if any existing exports were modified externally
		const modifiedExports = detectExternallyModifiedExports(
			targetDir,
			manifest,
			toolsToGenerate,
			onConflict,
		);
		if (modifiedExports.length > 0 && !options.dryRun) {
			if (onConflict === "skip") {
				s.stop();
				outro(
					`Skipping generation — ${modifiedExports.length} export files were modified externally.\nRun with --force to overwrite.`,
				);
				return;
			}
			if (onConflict === "warn") {
				// Warn but proceed (user can still Ctrl-C)
				console.log(`\n⚠️  ${modifiedExports.length} export file(s) were modified externally:`);
				for (const f of modifiedExports.slice(0, 5)) console.log(`    ${f}`);
				if (modifiedExports.length > 5)
					console.log(`    ...and ${modifiedExports.length - 5} more`);
				console.log();
			}
			// "overwrite" proceeds silently
		}
		// Continue with same spinner s — no new spinner needed
		// Workspace: ensure workspace directory exists
		const workspacePath = path.join(piDir, "workspaces");
		const wsResult = await ensureWorkspace(workspacePath, config.workspace.hooks);
		if (!wsResult.ok) {
			s.stop();
			outro(`Workspace setup failed: ${wsResult.error}`);
			return;
		}

		// Run before_run hook
		const hookResult = await runBeforeRunHook(targetDir, config.workspace.hooks);
		if (!hookResult.ok) {
			s.stop();
			outro(`Hook failed: ${hookResult.error}`);
			return;
		}

		const generatedFiles: Record<string, { category: FileCategory; content: string }> = {};

		for (const tool of toolsToGenerate) {
			// Pi is the source of truth; its "export" is pi-consumable SKILL.md packages
			// under .agents/skills/, not .pi/ itself
			const exportDir =
				tool === "pi" ? path.join(targetDir, ".agents") : path.join(targetDir, `.${tool}`);

			if (options.dryRun) {
				if (s) s.stop(`Dry run: Would generate .${tool}/ from .pi/`);
				continue;
			}

			// Generate export with retry
			const genResult = await retry(
				() => {
					generateExport(exportDir, tool as Tool, piDir, manifest, generatedFiles);
					return Promise.resolve();
				},
				{
					maxAttempts: 3,
					onRetry: (attempt, _err, delay) => {
						console.log(`  Retrying ${tool} generation (attempt ${attempt + 1})...`);
					},
				},
			);

			if (!genResult.ok) {
				s.stop();
				outro(`Generation failed for ${tool}: ${genResult.error.message}`);
				await runAfterRunHook(targetDir, config.workspace.hooks);
				return;
			}

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

		// Run after_run hook (best effort)
		await runAfterRunHook(targetDir, config.workspace.hooks);

		s.stop("Exports generated successfully!");

		outro(`
Generated exports:
  ${toolsToGenerate.map((t) => (t === "pi" ? ".agents/skills/ (pi skills)" : `.${t}/`)).join("\n  ")}

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
 * Canonical Reference: .pi/architecture/modules/generate-command.md#export-generation
 * Implements: ADR-001, ADR-004, ADR-005
 * Last Sync: 2026-05-31

 * Generate export directory from .pi/ source
 */
export function generateExport(
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
			const scriptFile = `validate-${normalizeValidatorName(validator)}.sh`;
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

function normalizeValidatorName(validator: string): string {
	return validator === "test" ? "tests" : validator;
}

/**
 * Canonical Reference: .pi/architecture/modules/generate-command.md#export-generation
 * Implements: ADR-001, ADR-004, ADR-005
 * Last Sync: 2026-05-31

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
 * Canonical Reference: .pi/architecture/modules/generate-command.md#export-generation
 * Implements: ADR-001, ADR-004, ADR-005
 * Last Sync: 2026-05-31

 * Reconciliation: detect export files that were modified externally since last generation.
 * Based on Symphony's reconciliation pattern (Section 8.5).
 *
 * Returns list of modified file paths.
 */
function detectExternallyModifiedExports(
	targetDir: string,
	manifest: GuardianManifest,
	toolsToGenerate: string[],
	onConflict: "overwrite" | "warn" | "skip",
): string[] {
	if (onConflict === "overwrite") return []; // No reconciliation needed

	const modified: string[] = [];

	for (const tool of toolsToGenerate) {
		const exportDir = path.join(targetDir, `.${tool}`);
		if (!fs.existsSync(exportDir)) continue;

		// Check each export record against current file hashes
		for (const [filePath, record] of Object.entries(manifest.files)) {
			if (!filePath.startsWith(`.${tool}/`)) continue;

			const fullPath = path.join(targetDir, filePath);
			if (!fs.existsSync(fullPath)) continue;

			const currentContent = fs.readFileSync(fullPath, "utf-8");
			if (isFileModified(manifest, filePath, currentContent)) {
				modified.push(filePath);
			}
		}
	}

	return modified;
}
