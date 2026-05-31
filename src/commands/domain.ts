/**
 * Canonical Reference: .pi/architecture/modules/cli-entry-point.md#command-dispatch
 * Implements: Domain Explore CLI — domain explore, scaffold, list commands
 * Issue: #3
 * Last Architecture Sync: 2026-05-31

 * Domain command handler for Guardian.
 *
 * Provides:
 *  - guardian domain explore --context "..." [--session <id>] [--dry-run]
 *  - guardian domain scaffold <session-id> [--dry-run]
 *  - guardian domain list
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { outro } from "@clack/prompts";
import {
	type ExplorationResult,
	exploreDomain,
	listExplorationSessions,
	scaffoldFromExploration,
} from "../lib/domain-explorer.js";

/**
 * Canonical Reference: .pi/architecture/modules/cli-entry-point.md#command-dispatch
 * Implements: Domain Explore CLI
 * Issue: #3
 * Last Architecture Sync: 2026-05-31

 * Run the domain command with subcommand dispatch.
 */
export async function runDomain(
	targetDir: string,
	args: string[],
	options: {
		context?: string;
		session?: string;
		dryRun?: boolean;
	},
): Promise<void> {
	const subcommand = args[0] ?? "explore";

	switch (subcommand) {
		case "explore":
			await runExplore(targetDir, options);
			break;
		case "scaffold":
			await runScaffold(targetDir, args[1], options);
			break;
		case "list":
			runList(targetDir);
			break;
		default:
			console.error(`Unknown domain subcommand: ${subcommand}`);
			console.log("Usage:");
			console.log("  guardian-framework domain explore --context <desc> [--session <id>] [--dry-run]");
			console.log("  guardian-framework domain scaffold <session-id> [--dry-run]");
			console.log("  guardian-framework domain list");
	}
}

/**
 * Run the domain explore subcommand.
 */
async function runExplore(
	targetDir: string,
	options: { context?: string; session?: string; dryRun?: boolean },
): Promise<void> {
	const context = options.context;

	if (!context) {
		outro("❌ --context is required for domain explore");
		console.log("Usage: guardian-framework domain explore --context \"business description\"");
		return;
	}

	if (context.length > 5000) {
		outro("❌ --context must be 5000 characters or fewer");
		return;
	}

	try {
		console.error(`🔍 Exploring domain: "${context.slice(0, 80)}${context.length > 80 ? "..." : ""}"`);

		const result = await exploreDomain(context, {
			projectDir: targetDir,
			sessionId: options.session,
			dryRun: options.dryRun,
		});

		if (options.dryRun) {
			outro(`📋 Dry-run: Would create session ${result.sessionId}`);
			console.log(`  Terms to add: ${result.glossaryResult?.added ?? 0}`);
		} else {
			outro(`✅ Exploration complete: ${result.sessionId}`);
			if (result.explorationPath) {
				console.log(`  Session:  ${result.explorationPath}`);
			}
			if (result.glossaryResult) {
				console.log(`  Glossary: ${result.glossaryResult.added} term(s) added, ${result.glossaryResult.skipped} skipped`);
			}
		}

		if (result.warnings.length > 0) {
			console.log("  Warnings:");
			for (const w of result.warnings) {
				console.log(`    ⚠️  ${w}`);
			}
		}
	} catch (err) {
		outro(`❌ Domain exploration failed: ${err instanceof Error ? err.message : String(err)}`);
	}
}

/**
 * Run the domain scaffold subcommand.
 */
async function runScaffold(
	targetDir: string,
	sessionId: string | undefined,
	options: { dryRun?: boolean },
): Promise<void> {
	if (!sessionId) {
		outro("❌ Session ID is required for domain scaffold");
		console.log("Usage: guardian-framework domain scaffold <session-id> [--dry-run]");
		console.log("Run 'guardian-framework domain list' to see available sessions.");
		return;
	}

	try {
		console.error(`🏗️  Scaffolding architecture modules from session: ${sessionId}`);

		const result = scaffoldFromExploration(sessionId, {
			projectDir: targetDir,
			dryRun: options.dryRun,
		});

		if (options.dryRun) {
			outro(`📋 Dry-run: Would generate ${result.modulesGenerated} module(s)`);
		} else {
			outro(`✅ Scaffold complete: ${result.modulesGenerated} module(s) generated`);
		}

		for (const m of result.modules) {
			console.log(`  📄 ${m}`);
		}

		if (result.warnings.length > 0) {
			console.log("  Warnings:");
			for (const w of result.warnings) {
				console.log(`    ⚠️  ${w}`);
			}
		}
	} catch (err) {
		outro(`❌ Scaffold failed: ${err instanceof Error ? err.message : String(err)}`);
	}
}

/**
 * Run the domain list subcommand.
 */
function runList(targetDir: string): void {
	const explorationDir = path.join(targetDir, ".pi", "domain", "exploration");

	if (!fs.existsSync(explorationDir)) {
		outro("No exploration sessions found");
		return;
	}

	const files = fs
		.readdirSync(explorationDir)
		.filter((f) => f.endsWith(".md") && !f.endsWith(".raw.json"))
		.sort()
		.reverse();

	if (files.length === 0) {
		outro("No exploration sessions found");
		return;
	}

	console.log(`\n  Exploration sessions in ${explorationDir}:\n`);
	for (const file of files) {
		const filePath = path.join(explorationDir, file);
		const stats = fs.statSync(filePath);
		const size = stats.size;
		const modified = stats.mtime.toISOString().split("T")[0];
		const sessionId = file.replace(".md", "");
		console.log(`  📄 ${sessionId.padEnd(40)} ${String(size).padStart(6)}B  ${modified}`);
	}
	console.log("");
	outro(`Total: ${files.length} session(s)`);
}
