/**
 * Uninstall command for Guardian
 *
 * Removes Guardian-managed files recorded in guardian-manifest.json.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { outro } from "@clack/prompts";
import { MANIFEST_FILE, isFileModified, readManifest } from "../lib/manifest.js";

export interface UninstallOptions {
	dryRun?: boolean;
	force?: boolean;
}

export interface UninstallPlan {
	filesToRemove: string[];
	directoriesToPrune: string[];
	blockedFiles: string[];
	manifestPath: string;
}

const MANAGED_ROOTS = [".pi", ".claude", ".opencode", ".agents", ".github"];

export async function runUninstall(
	targetDir: string,
	options: UninstallOptions = {},
): Promise<void> {
	const manifest = readManifest(targetDir);
	if (!manifest) {
		outro("No manifest found. Guardian is not installed in this directory.");
		return;
	}

	const plan = createUninstallPlan(targetDir);

	if (options.dryRun) {
		outro(`
Dry run - no files removed.

Files to remove:
  ${plan.filesToRemove.length > 0 ? plan.filesToRemove.join("\n  ") : "none"}

Modified managed files that require --force:
  ${plan.blockedFiles.length > 0 ? plan.blockedFiles.join("\n  ") : "none"}

Directories to prune if empty:
  ${plan.directoriesToPrune.length > 0 ? plan.directoriesToPrune.join("\n  ") : "none"}
`);
		return;
	}

	if (plan.blockedFiles.length > 0 && !options.force) {
		outro(`
Uninstall blocked because managed files have local modifications:
  ${plan.blockedFiles.join("\n  ")}

Run with --force to remove them anyway, or move your changes into a backup first.
`);
		return;
	}

	if (!options.force) {
		outro("Uninstall requires --force. Re-run with --dryRun first to inspect planned removals.");
		return;
	}

	applyUninstallPlan(targetDir, plan);
	outro("Guardian framework files removed.");
}

export function createUninstallPlan(targetDir: string): UninstallPlan {
	const manifest = readManifest(targetDir);
	if (!manifest) {
		throw new Error("No guardian manifest found");
	}

	const files = new Set<string>();
	const blockedFiles: string[] = [];

	for (const [filePath, record] of Object.entries(manifest.files)) {
		const safePath = normalizeManagedPath(filePath);
		if (!safePath) {
			continue;
		}

		const fullPath = path.join(targetDir, safePath);
		if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
			continue;
		}

		files.add(safePath);
		const content = fs.readFileSync(fullPath, "utf-8");
		if (isFileModified(manifest, filePath, content)) {
			blockedFiles.push(safePath);
		}
	}

	files.add(MANIFEST_FILE);

	const directories = collectDirectoriesToPrune(files);

	return {
		filesToRemove: [...files].sort(),
		directoriesToPrune: directories,
		blockedFiles: blockedFiles.sort(),
		manifestPath: MANIFEST_FILE,
	};
}

export function applyUninstallPlan(targetDir: string, plan: UninstallPlan): void {
	for (const filePath of plan.filesToRemove) {
		const fullPath = path.join(targetDir, filePath);
		if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
			fs.rmSync(fullPath);
		}
	}

	for (const dirPath of plan.directoriesToPrune) {
		const fullPath = path.join(targetDir, dirPath);
		if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
			try {
				fs.rmdirSync(fullPath);
			} catch {
				// Non-empty directories may contain user files; leave them in place.
			}
		}
	}
}

function normalizeManagedPath(filePath: string): string | null {
	const normalized = path.normalize(filePath);
	if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
		return null;
	}

	if (normalized === MANIFEST_FILE) {
		return normalized;
	}

	return MANAGED_ROOTS.some(
		(root) => normalized === root || normalized.startsWith(`${root}${path.sep}`),
	)
		? normalized
		: null;
}

function collectDirectoriesToPrune(files: Set<string>): string[] {
	const directories = new Set<string>();

	for (const file of files) {
		let dir = path.dirname(file);
		while (dir !== "." && dir !== path.dirname(dir)) {
			if (MANAGED_ROOTS.some((root) => dir === root || dir.startsWith(`${root}${path.sep}`))) {
				directories.add(dir);
			}
			dir = path.dirname(dir);
		}
	}

	for (const root of MANAGED_ROOTS) {
		directories.add(root);
	}

	return [...directories].sort((a, b) => b.length - a.length);
}
