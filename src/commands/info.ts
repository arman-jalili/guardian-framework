/**
 * Info command for Guardian
 *
 * Display manifest and framework status
 */

import * as fs from "node:fs";
import * as nodePath from "node:path";
import { outro } from "@clack/prompts";
import {
	calculateTokenStats,
	hashDirectory,
	isFileModified,
	readManifest,
} from "../lib/manifest.js";
import { formatTokens, getStats } from "../lib/tracking.js";

/**
 * Run info command
 */
export async function runInfo(targetDir: string): Promise<void> {
	// Check for manifest
	const manifest = readManifest(targetDir);
	if (!manifest) {
		outro("No manifest found. Run 'guardian-framework init' first.");
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

	// Calculate token stats
	const tokenStats = calculateTokenStats(targetDir, manifest);

	// Get RTK-style runtime token tracking stats
	const runtimeStats = getStats(30);

	// Check for new Terax-adopted features
	const hasSubagentRegistry = fs.existsSync(
		nodePath.join(targetDir, ".pi/skills/agents/subagent-registry.md"),
	);
	const hasContextCompaction = fs.existsSync(
		nodePath.join(targetDir, ".pi/skills/validators/context-compaction.md"),
	);
	const hasSecurityGuards = fs.existsSync(
		nodePath.join(targetDir, ".pi/skills/validators/security-guards.md"),
	);
	const hasSystemPromptTiers = fs.existsSync(
		nodePath.join(targetDir, ".pi/skills/validators/system-prompt-tiers.md"),
	);
	const hasPlanMode = fs.existsSync(nodePath.join(targetDir, ".pi/extensions/plan-mode.ts"));
	const hasSnippets = fs.existsSync(nodePath.join(targetDir, ".pi/extensions/snippets.ts"));
	const hasSessionPersistence = fs.existsSync(
		nodePath.join(targetDir, ".pi/extensions/session-persistence.ts"),
	);
	const hasSlashCommands = fs.existsSync(
		nodePath.join(targetDir, ".pi/extensions/slash-commands.ts"),
	);
	const hasRedaction = fs.existsSync(nodePath.join(targetDir, ".pi/extensions/redaction.ts"));
	const hasModelRegistry = fs.existsSync(
		nodePath.join(targetDir, ".pi/skills/validators/model-registry.md"),
	);

	const featureCount = [
		hasSubagentRegistry,
		hasContextCompaction,
		hasSecurityGuards,
		hasSystemPromptTiers,
		hasPlanMode,
		hasSnippets,
		hasSessionPersistence,
		hasSlashCommands,
		hasRedaction,
		hasModelRegistry,
	].filter(Boolean).length;

	const maxFeatures = 10;

	// Output info
	console.log(`
┌─────────────────────────────────────────────────────────────┐
│ Guardian Framework Status                                 │
├─────────────────────────────────────────────────────────────┤
│ Schema Version:    ${manifest.schemaVersion.padEnd(38)}│
│ Framework Version: ${manifest.frameworkVersion.padEnd(38)}│
│ Source:            ${manifest.source.padEnd(38)}│
│ Repository Tool:   ${manifest.repoTool.padEnd(38)}│
│ Language:          ${manifest.language.padEnd(38)}│
│ Build Tool:        ${(manifest.templateContext?.buildTool ?? "N/A").padEnd(38)}│
│ Tools:             ${manifest.tools.join(", ").padEnd(38)}│
│ Validators:        ${manifest.validators.join(", ").padEnd(38)}│
│ Workflows:         ${(manifest.workflows.length > 0 ? manifest.workflows.join(", ") : "none").padEnd(38)}│
├─────────────────────────────────────────────────────────────┤
│ Token Stats                                                  │
├─────────────────────────────────────────────────────────────┤
│ Total tokens:      ${String(tokenStats.totalTokens).padEnd(38)}│
│ Framework tokens:  ${String(tokenStats.byCategory.framework ?? 0).padEnd(38)}│
│ User tokens:       ${String(tokenStats.byCategory.user ?? 0).padEnd(38)}│
│ Generated tokens:  ${String(tokenStats.byCategory.generated ?? 0).padEnd(38)}│
│ Runtime savings:   ${runtimeStats.totalCommands > 0 ? formatTokens(runtimeStats.totalSavedTokens) : "N/A".padEnd(38)}│
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
			`│ .${tool.padEnd(16)} ${synced ? "✅ In sync" : "⚠️  Out of sync".padEnd(30)}│`,
	)
	.join("\n")}
├─────────────────────────────────────────────────────────────┤
│ Terax-Adopted Features (${featureCount}/${maxFeatures})                               │
├─────────────────────────────────────────────────────────────┤
│ ${hasSubagentRegistry ? "✅" : "❌"} Subagent delegation with tool scoping                   │
│ ${hasContextCompaction ? "✅" : "❌"} Context compaction strategy                        │
│ ${hasSecurityGuards ? "✅" : "❌"} Path safety + command deny-list                    │
│ ${hasSystemPromptTiers ? "✅" : "❌"} Tiered system prompts (full/lite)                  │
│ ${hasPlanMode ? "✅" : "❌"} Plan mode with queued edits                        │
│ ${hasSnippets ? "✅" : "❌"} Snippet token expansion (#handle)                    │
│ ${hasSessionPersistence ? "✅" : "❌"} Session persistence                              │
│ ${hasSlashCommands ? "✅" : "❌"} Slash command system                              │
│ ${hasRedaction ? "✅" : "❌"} Redaction layer                                   │
│ ${hasModelRegistry ? "✅" : "❌"} Model capability registry                         │
├─────────────────────────────────────────────────────────────┤
│ Timestamps                                                   │
├─────────────────────────────────────────────────────────────┤
│ Scaffolded:        ${manifest.scaffoldedAt?.split("T")[0] || "N/A".padEnd(38)}│
│ Last Updated:      ${manifest.lastUpdatedAt?.split("T")[0] || "N/A".padEnd(38)}│
└─────────────────────────────────────────────────────────────┘

${modifiedFiles.length > 0 ? `Modified files:\n  ${modifiedFiles.map(([p]) => p).join("\n  ")}` : "No modified files."}

${Object.entries(exportSyncStatus).some(([_, s]) => !s) ? "⚠️  Some exports out of sync. Run: guardian-framework generate" : "✅ All exports in sync."}
`);
}
