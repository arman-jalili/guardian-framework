/**
 * Update command for GuardianCLI
 *
 * Smart merge framework updates preserving user edits
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { outro, spinner } from "@clack/prompts";
import {
	categorizeFile,
	hashFile,
	isFileModified,
	readManifest,
	writeManifest,
} from "../lib/manifest.js";
import {
	type Language,
	type RepoTool,
	type TemplateContext,
	getDefaultContext,
	getPiTemplateFiles,
	readTemplate,
	renderTemplate,
	templatesExist,
} from "../lib/templates.js";

/**
 * Run update command
 */
export async function runUpdate(
	targetDir: string,
	options: { dryRun?: boolean; force?: boolean; regenerate?: boolean },
): Promise<void> {
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

	const s = spinner();
	s.start("Analyzing framework files...");

	try {
		const changes: { path: string; action: "update" | "preserve" | "regenerate" }[] = [];

		// Get template context from manifest
		const context: TemplateContext = getDefaultContext(
			manifest.language as Language,
			manifest.tools.includes("pi") ? "guardian-project" : "project",
			manifest.repoTool as RepoTool,
		);

		// Check each framework file
		for (const [filePath, record] of Object.entries(manifest.files)) {
			if (filePath.startsWith(".pi/")) {
				const fullPath = path.join(targetDir, filePath);

				// Determine action based on category and modification status
				if (record.category === "user") {
					// User-editable files: preserve unless force
					if (fs.existsSync(fullPath)) {
						const currentContent = fs.readFileSync(fullPath, "utf-8");
						const modified = isFileModified(manifest, filePath, currentContent);

						if (modified && !options.force) {
							changes.push({ path: filePath, action: "preserve" });
						} else {
							changes.push({ path: filePath, action: "update" });
						}
					}
				} else if (record.category === "framework") {
					// Framework files: update if unchanged, preserve if modified
					if (fs.existsSync(fullPath)) {
						const currentContent = fs.readFileSync(fullPath, "utf-8");
						const modified = isFileModified(manifest, filePath, currentContent);

						if (modified && !options.force) {
							changes.push({ path: filePath, action: "preserve" });
						} else {
							changes.push({ path: filePath, action: "update" });
						}
					}
				}
			}
		}

		// Check for new template files not in manifest
		const templateFiles = getPiTemplateFiles();
		for (const relativePath of templateFiles) {
			const manifestPath = `.pi/${relativePath}`;
			if (!manifest.files[manifestPath]) {
				changes.push({ path: manifestPath, action: "update" });
			}
		}

		// Generated files: always regenerate
		for (const [filePath, record] of Object.entries(manifest.files)) {
			if (record.category === "generated") {
				changes.push({ path: filePath, action: "regenerate" });
			}
		}

		s.stop("Analysis complete");

		// Show plan
		const preserved = changes.filter((c) => c.action === "preserve");
		const updated = changes.filter((c) => c.action === "update");
		const regenerated = changes.filter((c) => c.action === "regenerate");

		if (options.dryRun) {
			outro(`
Dry run - no changes made:

Files to preserve (user-modified):
  ${preserved.length > 0 ? preserved.map((c) => c.path).join("\n  ") : "none"}

Files to update:
  ${updated.length > 0 ? updated.map((c) => c.path).join("\n  ") : "none"}

Files to regenerate:
  ${regenerated.length > 0 ? regenerated.map((c) => c.path).join("\n  ") : "none"}

Run without --dryRun to apply changes.
`);
			return;
		}

		// Apply changes
		s.start("Applying updates...");

		for (const change of updated) {
			const fullPath = path.join(targetDir, change.path);
			const relativePath = change.path.replace(".pi/", "");

			// Read new template content
			const content = readTemplate(relativePath);
			const rendered = renderTemplate(content, context);

			// Write file
			fs.mkdirSync(path.dirname(fullPath), { recursive: true });
			fs.writeFileSync(fullPath, rendered, "utf-8");

			// Update manifest
			const hash = hashFile(fullPath);
			manifest.files[change.path] = {
				category: categorizeFile(relativePath),
				originalHash: `sha256:${hash}`,
				status: "unchanged",
			};
		}

		// Update timestamp
		manifest.lastUpdatedAt = new Date().toISOString();
		writeManifest(targetDir, manifest);

		s.stop("Updates applied");

		outro(`
Framework updated:

Preserved (user-modified):
  ${preserved.length} files

Updated:
  ${updated.length} files

Regenerate exports with:
  guardian-framework-cli generate

${options.regenerate ? "\nRunning generate..." : ""}
`);
	} catch (error) {
		s.stop("Update failed!");
		outro(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
	}
}