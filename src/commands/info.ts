/**
 * Info command for GuardianCLI
 *
 * Display manifest and framework status
 */

import * as fs from "node:fs";
import * as nodePath from "node:path";
import { outro } from "@clack/prompts";
import { hashDirectory, isFileModified, readManifest } from "../lib/manifest.js";

/**
 * Run info command
 */
export async function runInfo(targetDir: string): Promise<void> {
	// Check for manifest
	const manifest = readManifest(targetDir);
	if (!manifest) {
		outro("No manifest found. Run 'guardian-framework-cli init' first.");
		return;
	}

	// Calculate stats
	const frameworkFiles = Object.entries(manifest.files).filter(
		([_, r]) => r.category === "framework",
	);
	const userFiles = Object.entries(manifest.files).filter(([_, r]) => r.category === "user");
	const generatedFiles = Object.entries(manifest.files).filter(
		([_, r]) => r.category === "generated",
	);

	// Check modification status
	const modifiedFiles = Object.entries(manifest.files).filter(([filePath, record]) => {
		const fullPath = nodePath.join(targetDir, filePath);
		if (fs.existsSync(fullPath)) {
			const content = fs.readFileSync(fullPath, "utf-8");
			return isFileModified(manifest, filePath, content);
		}
		return false;
	});

	// Check export sync status
	const piDir = nodePath.join(targetDir, ".pi");
	const exportSyncStatus: Record<string, boolean> = {};

	for (const [tool, exportRecord] of Object.entries(manifest.exports)) {
		const currentPiHash = hashDirectory(piDir);
		const storedHash = exportRecord.sourceHash?.replace("sha256:", "");
		exportSyncStatus[tool] = currentPiHash === storedHash;
	}

	// Output info
	console.log(`
┌─────────────────────────────────────────────────────────────┐
│ GuardianCLI Framework Status                                 │
├─────────────────────────────────────────────────────────────┤
│ Schema Version:    ${manifest.schemaVersion.padEnd(38)}│
│ Framework Version: ${manifest.frameworkVersion.padEnd(38)}│
│ Source:            ${manifest.source.padEnd(38)}│
│ Repository Tool:   ${manifest.repoTool.padEnd(38)}│
│ Language:          ${manifest.language.padEnd(38)}│
│ Tools:             ${manifest.tools.join(", ").padEnd(38)}│
│ Validators:        ${manifest.validators.join(", ").padEnd(38)}│
│ Workflows:         ${(manifest.workflows.length > 0 ? manifest.workflows.join(", ") : "none").padEnd(38)}│
├─────────────────────────────────────────────────────────────┤
│ File Summary                                                 │
├─────────────────────────────────────────────────────────────┤
│ Framework files:   ${String(frameworkFiles.length).padEnd(38)}│
│ User-editable:     ${String(userFiles.length).padEnd(38)}│
│ Generated exports: ${String(generatedFiles.length).padEnd(38)}│
│ Modified files:    ${String(modifiedFiles.length).padEnd(38)}│
├─────────────────────────────────────────────────────────────┤
│ Export Sync Status                                           │
├─────────────────────────────────────────────────────────────┤
${Object.entries(exportSyncStatus)
	.map(
		([tool, synced]) =>
			`│ .${tool}/            ${synced ? "✅ In sync" : "⚠️  Out of sync".padEnd(30)}│`,
	)
	.join("\n")}
├─────────────────────────────────────────────────────────────┤
│ Timestamps                                                   │
├─────────────────────────────────────────────────────────────┤
│ Scaffolded:        ${manifest.scaffoldedAt?.split("T")[0] || "N/A".padEnd(38)}│
│ Last Updated:      ${manifest.lastUpdatedAt?.split("T")[0] || "N/A".padEnd(38)}│
└─────────────────────────────────────────────────────────────┘

${modifiedFiles.length > 0 ? `Modified files:\n  ${modifiedFiles.map(([p]) => p).join("\n  ")}` : "No modified files."}

${Object.entries(exportSyncStatus).some(([_, s]) => !s) ? "⚠️  Some exports out of sync. Run: guardian-framework-cli generate" : "✅ All exports in sync."}
`);
}
