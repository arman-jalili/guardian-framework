/**
 * Validation Runner Extension for pi
 *
 * Runs validation scripts as pi tools and commands.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
	// Session initialization
	pi.on("session_start", async (_event, ctx) => {
		ctx.ui.notify("GuardianCLI validation runner initialized", "info");
	});

	// Register validation tool
	pi.registerTool({
		name: "guardian_validate",
		label: "Guardian Validate",
		description: "Run GuardianCLI validation scripts for a specific category",
		parameters: Type.Object({
			validators: Type.Array(Type.String(), {
				description: "Validation categories: ci, tests, operations, security",
			}),
			scope: Type.Optional(
				Type.String({
					description: "Scope classification: simple, moderate, complex, critical",
				}),
			),
		}),
		async execute(toolCallId, params, signal, onUpdate, ctx) {
			const results: Record<string, { passed: boolean; output: string }> = {};

			for (const validator of params.validators) {
				if (signal.aborted) break;

				onUpdate({ type: "progress", message: `Running ${validator} validation...` });

				const scriptPath = `.pi/scripts/validate-${validator}.sh`;
				try {
					const result = await ctx.shell.execute(`bash ${scriptPath}`, { signal });
					results[validator] = {
						passed: result.exitCode === 0,
						output: result.stdout,
					};
				} catch (error) {
					results[validator] = {
						passed: false,
						output: `Error: ${error}`,
					};
				}
			}

			const allPassed = Object.values(results).every((r) => r.passed);

			return {
				type: "success",
				result: {
					summary: allPassed ? "All validations passed" : "Some validations failed",
					results,
					scope: params.scope || "moderate",
				},
			};
		},
	});

	// Register validate command
	pi.registerCommand("validate", {
		description: "Run all or specific validators",
		handler: async (args, ctx) => {
			const validators = args.length > 0 ? args : ["ci", "tests", "operations", "security"];
			ctx.ui.notify(`Running validators: ${validators.join(", ")}`, "info");

			// Execute validation tool
			const result = await ctx.tools.execute("guardian_validate", {
				validators,
				scope: "moderate",
			});

			return result;
		},
	});

	// Register scope command
	pi.registerCommand("scope", {
		description: "Get scope classification for current changes",
		handler: async (_args, ctx) => {
			// Analyze git changes
			const gitStatus = await ctx.shell.execute("git diff --stat HEAD");
			const lines = gitStatus.stdout.split("\n").filter((l) => l.trim());

			// Simple scope estimation
			const fileCount = lines.length;
			const lineChanges = lines.reduce((sum, line) => {
				const match = line.match(/\s+(\d+)\s+(insertions|deletions)/);
				return sum + (match ? Number.parseInt(match[1], 10) : 0);
			}, 0);

			let scope = "simple";
			if (fileCount > 15 || lineChanges > 500) scope = "critical";
			else if (fileCount > 5 || lineChanges > 200) scope = "complex";
			else if (fileCount > 2 || lineChanges > 50) scope = "moderate";

			ctx.ui.notify(`Scope: ${scope} (${fileCount} files, ~${lineChanges} lines)`, "info");
			return { scope, fileCount, lineChanges };
		},
	});
}
