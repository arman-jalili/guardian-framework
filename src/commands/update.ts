/**
 * Update command for GuardianCLI
 *
 * Smart merge framework updates preserving user edits.
 *
 * Strategy:
 * 1. New template files → add to project
 * 2. Deleted template files → mark orphaned (don't remove)
 * 3. Unchanged framework files → auto-update to new template
 * 4. User-modified files → preserve user content, show diff
 * 5. Front-matter files → merge: user's front matter + new template body
 * 6. Generated exports → regenerate from .pi/ source
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { confirm, intro, isCancel, outro, spinner } from "@clack/prompts";
import {
	type FileCategory,
	type GuardianManifest,
	categorizeFile,
	hashFile,
	isFileModified,
	readManifest,
	writeManifest,
} from "../lib/manifest.js";
import { loadWorkflowConfig, parseFrontMatter, extractPromptBody } from "../lib/workflow-config.js";
import {
	type Language,
	type RepoTool,
	type TemplateContext,
	type Tool,
	getDefaultContext,
	getPiTemplateFiles,
	readTemplate,
	renderTemplate,
	templatesExist,
} from "../lib/templates.js";
import { generateExport } from "./generate.js";

interface UpdateChange {
	path: string;
	action: "add" | "update" | "preserve" | "merge-frontmatter" | "regenerate" | "orphan";
	reason: string;
}

interface UpdateResult {
	added: string[];
	updated: string[];
	preserved: string[];
	merged: string[];
	regenerated: string[];
	orphaned: string[];
	conflicts: string[];
}

/**
 * Run update command
 */
export async function runUpdate(
	targetDir: string,
	options: { dryRun?: boolean; force?: boolean; regenerate?: boolean },
): Promise<void> {
	if (!templatesExist()) {
		outro("Templates not found. Ensure templates/pi/ exists in package.");
		return;
	}

	const manifest = readManifest(targetDir);
	if (!manifest) {
		outro("No manifest found. Run 'guardian-framework-cli init' first.");
		return;
	}

	const s = spinner();
	s.start("Analyzing framework files...");

	try {
		const context = buildTemplateContext(manifest);
		const templateFiles = getPiTemplateFiles();
		const changes = analyzeChanges(targetDir, manifest, templateFiles, context, options);

		s.stop("Analysis complete");

		if (options.dryRun) {
			printDryRun(changes);
			return;
		}

		// Confirm before applying
		const stats = countActions(changes);
		if (stats.total === 0) {
			outro("Framework is already up to date. No changes needed.");
			return;
		}

		if (!options.force) {
			const confirmed = await confirmChanges(stats);
			if (!confirmed) {
				outro("Update cancelled.");
				return;
			}
		}

		// Apply changes
		s.start("Applying updates...");
		const result = applyChanges(targetDir, manifest, changes, context, options);
		writeManifest(targetDir, manifest);
		s.stop("Updates applied");

		// Optionally regenerate exports
		if (options.regenerate && result.regenerated.length > 0) {
			s.start("Regenerating exports...");
			regenerateAllExports(targetDir, manifest);
			s.stop("Exports regenerated");
		}

		printSummary(result);
	} catch (error) {
		s.stop("Update failed!");
		outro(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
	}
}

// ── Analysis ───────────────────────────────────────────────────────

function analyzeChanges(
	targetDir: string,
	manifest: GuardianManifest,
	templateFiles: string[],
	context: TemplateContext,
	options: { force?: boolean },
): UpdateChange[] {
	const changes: UpdateChange[] = [];
	const templatePaths = new Set(templateFiles);

	// 1. Process existing manifest files
	for (const [filePath, record] of Object.entries(manifest.files)) {
		if (!filePath.startsWith(".pi/")) continue;

		const fullPath = path.join(targetDir, filePath);

		// Template was removed from GuardianCLI
		if (!templatePaths.has(filePath.replace(".pi/", ""))) {
			changes.push({
				path: filePath,
				action: "orphan",
				reason: "Template removed from GuardianCLI",
			});
			continue;
		}

		// Generated files → always regenerate
		if (record.category === "generated") {
			changes.push({ path: filePath, action: "regenerate", reason: "Export file" });
			continue;
		}

		if (!fs.existsSync(fullPath)) {
			changes.push({ path: filePath, action: "update", reason: "File missing" });
			continue;
		}

		const currentContent = fs.readFileSync(fullPath, "utf-8");
		const modified = isFileModified(manifest, filePath, currentContent);

		if (!modified || options.force) {
			// Unchanged or force → auto-update
			changes.push({ path: filePath, action: "update", reason: modified ? "forced update" : "unchanged" });
		} else {
			// User modified → check for front-matter merge
			const relativePath = filePath.replace(".pi/", "");
			const newContent = renderTemplate(readTemplate(relativePath), context);

			if (isFrontMatterFile(currentContent, newContent)) {
				changes.push({
					path: filePath,
					action: "merge-frontmatter",
					reason: "User modified, merging front matter",
				});
			} else {
				// Preserve user file, show diff later
				changes.push({
					path: filePath,
					action: "preserve",
					reason: "User modified",
				});
			}
		}
	}

	// 2. New template files not in manifest
	for (const relativePath of templateFiles) {
		const manifestPath = `.pi/${relativePath}`;
		if (!manifest.files[manifestPath]) {
			changes.push({ path: manifestPath, action: "add", reason: "New template file" });
		}
	}

	return changes;
}

// ── Application ────────────────────────────────────────────────────

function applyChanges(
	targetDir: string,
	manifest: GuardianManifest,
	changes: UpdateChange[],
	context: TemplateContext,
	options: { force?: boolean },
): UpdateResult {
	const result: UpdateResult = {
		added: [],
		updated: [],
		preserved: [],
		merged: [],
		regenerated: [],
		orphaned: [],
		conflicts: [],
	};

	for (const change of changes) {
		switch (change.action) {
			case "add":
				addFile(targetDir, manifest, change.path, context);
				result.added.push(change.path);
				break;

			case "update":
				updateFile(targetDir, manifest, change.path, context);
				result.updated.push(change.path);
				break;

			case "merge-frontmatter":
				if (mergeFrontMatterFile(targetDir, manifest, change.path, context)) {
					result.merged.push(change.path);
				} else {
					preserveFile(targetDir, manifest, change.path);
					result.preserved.push(change.path);
					result.conflicts.push(change.path);
				}
				break;

			case "preserve":
				preserveFile(targetDir, manifest, change.path);
				result.preserved.push(change.path);
				break;

			case "regenerate":
				result.regenerated.push(change.path);
				break;

			case "orphan":
				result.orphaned.push(change.path);
				break;
		}
	}

	return result;
}

// ── File Operations ────────────────────────────────────────────────

function addFile(targetDir: string, manifest: GuardianManifest, filePath: string, context: TemplateContext): void {
	const fullPath = path.join(targetDir, filePath);
	const relativePath = filePath.replace(".pi/", "");
	const content = renderTemplate(readTemplate(relativePath), context);

	fs.mkdirSync(path.dirname(fullPath), { recursive: true });
	fs.writeFileSync(fullPath, content, "utf-8");

	manifest.files[filePath] = {
		category: categorizeFile(relativePath),
		originalHash: `sha256:${hashFile(fullPath)}`,
		status: "configured",
	};
}

function updateFile(targetDir: string, manifest: GuardianManifest, filePath: string, context: TemplateContext): void {
	const fullPath = path.join(targetDir, filePath);
	const relativePath = filePath.replace(".pi/", "");
	const content = renderTemplate(readTemplate(relativePath), context);

	fs.mkdirSync(path.dirname(fullPath), { recursive: true });
	fs.writeFileSync(fullPath, content, "utf-8");

	manifest.files[filePath] = {
		category: categorizeFile(relativePath),
		originalHash: `sha256:${hashFile(fullPath)}`,
		status: "unchanged",
	};
}

function preserveFile(targetDir: string, manifest: GuardianManifest, filePath: string): void {
	// Mark as modified but don't touch the file
	if (manifest.files[filePath]) {
		manifest.files[filePath].status = "modified";
	}
}

function mergeFrontMatterFile(
	targetDir: string,
	manifest: GuardianManifest,
	filePath: string,
	context: TemplateContext,
): boolean {
	const fullPath = path.join(targetDir, filePath);
	const relativePath = filePath.replace(".pi/", "");

	const userContent = fs.readFileSync(fullPath, "utf-8");
	const newContent = renderTemplate(readTemplate(relativePath), context);

	const userFrontMatter = parseFrontMatter(userContent);
	const newBody = extractPromptBody(newContent);

	// Check if user has meaningful front matter
	const userHasConfig = Object.keys(userFrontMatter).length > 0;

	if (userHasConfig) {
		// Merge: user's front matter + new template body
		const yamlLines = buildYamlFrontMatter(userFrontMatter);
		const merged = `${yamlLines}\n\n${newBody}`;
		fs.writeFileSync(fullPath, merged, "utf-8");

		manifest.files[filePath] = {
			category: categorizeFile(relativePath),
			originalHash: `sha256:${hashFile(fullPath)}`,
			status: "unchanged",
		};
		return true;
	}

	// No user front matter → just update the whole file
	fs.writeFileSync(fullPath, newContent, "utf-8");
	manifest.files[filePath] = {
		category: categorizeFile(relativePath),
		originalHash: `sha256:${hashFile(fullPath)}`,
		status: "unchanged",
	};
	return true;
}

function buildYamlFrontMatter(fm: Record<string, unknown>): string {
	const lines = ["---"];
	for (const [key, value] of Object.entries(fm)) {
		buildYamlEntry(lines, key, value, 0);
	}
	lines.push("---");
	return lines.join("\n");
}

function buildYamlEntry(lines: string[], key: string, value: unknown, indent: number): void {
	const prefix = "  ".repeat(indent);

	if (value && typeof value === "object" && !Array.isArray(value)) {
		lines.push(`${prefix}${key}:`);
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			buildYamlEntry(lines, k, v, indent + 1);
		}
	} else if (Array.isArray(value)) {
		lines.push(`${prefix}${key}:`);
		for (const item of value) {
			if (typeof item === "string") {
				lines.push(`${prefix}  - ${item}`);
			} else {
				buildYamlEntry(lines, "-", item, indent + 1);
			}
		}
	} else if (typeof value === "string") {
		lines.push(`${prefix}${key}: "${value}"`);
	} else if (typeof value === "boolean") {
		lines.push(`${prefix}${key}: ${value}`);
	} else if (value === null) {
		lines.push(`${prefix}${key}: null`);
	} else {
		lines.push(`${prefix}${key}: ${value}`);
	}
}

function isFrontMatterFile(userContent: string, newContent: string): boolean {
	return userContent.startsWith("---\n") || newContent.startsWith("---\n");
}

// ── Regeneration ───────────────────────────────────────────────────

function regenerateAllExports(targetDir: string, manifest: GuardianManifest): void {
	const piDir = path.join(targetDir, ".pi");

	for (const tool of manifest.tools) {
		if (tool === "pi") continue;

		const exportDir = path.join(targetDir, `.${tool}`);
		generateExport(exportDir, tool as Tool, piDir, manifest, {});
	}
}

// ── Output ─────────────────────────────────────────────────────────

function countActions(changes: UpdateChange[]): Record<string, number> {
	const stats: Record<string, number> = {};
	for (const c of changes) {
		stats[c.action] = (stats[c.action] || 0) + 1;
	}
	stats.total = changes.length;
	return stats;
}

async function confirmChanges(stats: Record<string, number>): Promise<boolean> {
	console.log("\nChanges to apply:\n");

	if (stats.added) console.log(`  + Add:        ${stats.added} new file(s)`);
	if (stats.update) console.log(`  ~ Update:     ${stats.update} file(s) (unchanged)`);
	if (stats["merge-frontmatter"]) console.log(`  ⚡ Merge:      ${stats["merge-frontmatter"]} file(s) (user config + new body)`);
	if (stats.preserved) console.log(`  ≡ Preserve:   ${stats.preserved} file(s) (user-modified, kept)`);
	if (stats.regenerated) console.log(`  ⟳ Regenerate: ${stats.regenerated} export(s)`);
	if (stats.orphaned) console.log(`  ✗ Orphaned:   ${stats.orphaned} file(s) (template removed)`);
	if (stats.conflicts) console.log(`  ⚠ Conflicts:  ${stats.conflicts} file(s)`);

	console.log();

	const result = await confirm({ message: "Apply these changes?" });
	if (isCancel(result)) return false;
	return result as boolean;
}

function printDryRun(changes: UpdateChange[]): void {
	const added = changes.filter((c) => c.action === "add");
	const updated = changes.filter((c) => c.action === "update");
	const merged = changes.filter((c) => c.action === "merge-frontmatter");
	const preserved = changes.filter((c) => c.action === "preserve");
	const regenerated = changes.filter((c) => c.action === "regenerate");
	const orphaned = changes.filter((c) => c.action === "orphan");

	const sections: { label: string; icon: string; items: UpdateChange[] }[] = [
		{ label: "New files to add", icon: "+", items: added },
		{ label: "Files to update (unchanged)", icon: "~", items: updated },
		{ label: "Files to merge (preserve user config + new body)", icon: "⚡", items: merged },
		{ label: "Files to preserve (user-modified)", icon: "≡", items: preserved },
		{ label: "Exports to regenerate", icon: "⟳", items: regenerated },
		{ label: "Orphaned files (template removed)", icon: "✗", items: orphaned },
	];

	let hasChanges = false;
	for (const section of sections) {
		if (section.items.length === 0) continue;
		hasChanges = true;
		console.log(`\n${section.icon} ${section.label}:`);
		for (const item of section.items) {
			console.log(`    ${item.path} — ${item.reason}`);
		}
	}

	if (!hasChanges) {
		outro("No changes detected. Framework is up to date.");
		return;
	}

	console.log(`\nTotal: ${changes.length} change(s)`);
	outro("\nRun without --dryRun to apply changes.");
}

function printSummary(result: UpdateResult): void {
	const lines: string[] = [];

	if (result.added.length > 0) {
		lines.push(`Added: ${result.added.length} new file(s)`);
		for (const f of result.added.slice(0, 5)) lines.push(`  + ${f}`);
		if (result.added.length > 5) lines.push(`  ...and ${result.added.length - 5} more`);
	}

	if (result.updated.length > 0) {
		lines.push(`Updated: ${result.updated.length} file(s)`);
	}

	if (result.merged.length > 0) {
		lines.push(`Merged: ${result.merged.length} file(s) (user config preserved + new body)`);
		for (const f of result.merged.slice(0, 5)) lines.push(`  ⚡ ${f}`);
	}

	if (result.preserved.length > 0) {
		lines.push(`Preserved: ${result.preserved.length} user-modified file(s)`);
		for (const f of result.preserved.slice(0, 5)) lines.push(`  ≡ ${f}`);
	}

	if (result.orphaned.length > 0) {
		lines.push(`Orphaned: ${result.orphaned.length} file(s) (no longer in templates)`);
		for (const f of result.orphaned) lines.push(`  ✗ ${f}`);
	}

	if (result.conflicts.length > 0) {
		lines.push(`Conflicts: ${result.conflicts.length} file(s) (user changes preserved, review manually)`);
		for (const f of result.conflicts) lines.push(`  ⚠ ${f}`);
	}

	outro(`\nFramework updated:\n\n${lines.join("\n")}\n\nRegenerate exports with:\n  guardian-framework-cli generate`);
}

function buildTemplateContext(manifest: GuardianManifest): TemplateContext {
	return {
		...getDefaultContext(
			manifest.language as Language,
			manifest.templateContext?.projectName ?? "project",
			manifest.repoTool as RepoTool,
		),
		...manifest.templateContext,
	};
}
