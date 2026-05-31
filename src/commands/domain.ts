/**
 * Canonical Reference: .pi/architecture/modules/cli-entry-point.md#command-dispatch
 * Implements: Domain Explore CLI — domain explore, scaffold, list, answer commands
 * Issue: #3
 * Last Architecture Sync: 2026-05-31

 * Domain command handler for Guardian.
 *
 * Provides:
 *  - guardian domain explore --context "..." [--session <id>] [--dry-run]
 *  - guardian domain scaffold <session-id> [--dry-run]
 *  - guardian domain answer <session-id> <response-file> [--dry-run]
 *  - guardian domain list
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { outro } from "@clack/prompts";
import {
	type ExplorationResult,
	answerExploration,
	exploreDomain,
	listExplorationSessions,
	scaffoldFromExploration,
} from "../lib/domain-explorer.js";

/**
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
		case "answer":
			await runAnswer(targetDir, args[1], args[2], options);
			break;
		case "list":
			runList(targetDir);
			break;
		default:
			console.error("Unknown domain subcommand:", subcommand);
			console.log("Usage:");
			console.log(
				"  guardian-framework domain explore --context <desc> [--session <id>] [--dry-run]",
			);
			console.log("  guardian-framework domain scaffold <session-id> [--dry-run]");
			console.log("  guardian-framework domain answer <session-id> <response-file> [--dry-run]");
			console.log("  guardian-framework domain list");
			console.log("");
			console.log("  Workflow:");
			console.log('    1. guardian domain explore --context "business description"');
			console.log("    2. A .prompt.md file is created in .pi/domain/exploration/");
			console.log("    3. Feed the prompt to your LLM and save the JSON response");
			console.log("    4. guardian domain answer <session-id> <response-file>");
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
		outro("--context is required for domain explore");
		console.log('Usage: guardian-framework domain explore --context "business description"');
		return;
	}

	if (context.length > 5000) {
		outro("--context must be 5000 characters or fewer");
		return;
	}

	try {
		console.error("Exploring domain...");

		const result = await exploreDomain(context, {
			projectDir: targetDir,
			sessionId: options.session,
			dryRun: options.dryRun,
		});

		if (options.dryRun) {
			outro(`Dry-run: would create session ${result.sessionId}`);
		} else {
			outro(`Prompt file created: ${result.sessionId}`);
			if (result.promptPath) {
				console.log(`  Prompt: ${result.promptPath}`);
			}
		}

		if (result.warnings.length > 0) {
			console.log("  Warnings:");
			for (const w of result.warnings) {
				console.log(`    ${w}`);
			}
		}
	} catch (err) {
		outro(`Domain exploration failed: ${err instanceof Error ? err.message : String(err)}`);
	}
}

/**
 * Run the domain answer subcommand.
 * Processes an LLM response JSON file into an exploration session.
 */
async function runAnswer(
	targetDir: string,
	sessionId: string | undefined,
	responseFile: string | undefined,
	options: { dryRun?: boolean },
): Promise<void> {
	if (!sessionId || !responseFile) {
		outro("Usage: guardian-framework domain answer <session-id> <response-file> [--dry-run]");
		console.log("  Run 'guardian-framework domain list' to see available sessions.");
		return;
	}

	try {
		const responsePath = path.resolve(targetDir, responseFile);
		if (!fs.existsSync(responsePath)) {
			outro(`Response file not found: ${responsePath}`);
			return;
		}

		const responseJson = fs.readFileSync(responsePath, "utf-8");

		const result = answerExploration(sessionId, responseJson, {
			projectDir: targetDir,
			dryRun: options.dryRun,
		});

		if (options.dryRun) {
			outro(`Dry-run: would process session ${sessionId}`);
		} else {
			outro(`Session processed: ${sessionId}`);
			if (result.explorationPath) {
				console.log(`  Session: ${result.explorationPath}`);
			}
			if (result.glossaryResult) {
				console.log(
					`  Glossary: ${result.glossaryResult.added} term(s) added, ${result.glossaryResult.skipped} skipped`,
				);
			}
		}

		if (result.warnings.length > 0) {
			console.log("  Warnings:");
			for (const w of result.warnings) {
				console.log(`    ${w}`);
			}
		}
	} catch (err) {
		outro(`Domain answer failed: ${err instanceof Error ? err.message : String(err)}`);
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
		outro("Session ID is required for domain scaffold");
		console.log("Usage: guardian-framework domain scaffold <session-id> [--dry-run]");
		console.log("Run 'guardian-framework domain list' to see available sessions.");
		return;
	}

	try {
		const result = scaffoldFromExploration(sessionId, {
			projectDir: targetDir,
			dryRun: options.dryRun,
		});

		if (options.dryRun) {
			outro(`Dry-run: would generate ${result.modulesGenerated} module(s)`);
		} else {
			outro(`Scaffold complete: ${result.modulesGenerated} module(s) generated`);
		}

		for (const m of result.modules) {
			console.log(`  ${m}`);
		}

		if (result.warnings.length > 0) {
			console.log("  Warnings:");
			for (const w of result.warnings) {
				console.log(`    ${w}`);
			}
		}
	} catch (err) {
		outro(`Scaffold failed: ${err instanceof Error ? err.message : String(err)}`);
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

	const allFiles = fs.readdirSync(explorationDir);
	// Show only session files (.md), not prompts (.prompt.md) or raw data
	const files = allFiles
		.filter((f) => f.endsWith(".md") && !f.includes(".prompt.") && !f.endsWith(".raw.json"))
		.sort()
		.reverse();

	if (files.length === 0) {
		outro("No exploration sessions found");
		return;
	}

	console.log("Exploration sessions:");
	for (const file of files) {
		const filePath = path.join(explorationDir, file);
		const stats = fs.statSync(filePath);
		const sessionId = file.replace(".md", "");
		const modified = stats.mtime.toISOString().split("T")[0];
		const size = stats.size;
		// Show status by checking for prompt files
		const promptFile = path.join(explorationDir, `${sessionId}.prompt.md`);
		const status = fs.existsSync(promptFile) ? "awaiting-response" : "complete";
		console.log(`  ${sessionId.padEnd(40)}${String(size).padStart(6)}B  ${modified}  [${status}]`);
	}
	outro(`Total: ${files.length} session(s)`);
}
