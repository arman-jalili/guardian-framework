#!/usr/bin/env bun
/**
 * Canonical Reference: .pi/architecture/modules/cli-entry-point.md#parseArgs
 * Implements: ADR-002, ADR-005
 * Last Sync: 2026-05-31
 */

import { parseArgs } from "node:util";
import { intro, isCancel, outro } from "@clack/prompts";
import { runDomain } from "./commands/domain.js";
import { runGenerate } from "./commands/generate.js";
import { runInfo } from "./commands/info.js";
import { runInit } from "./commands/init.js";
import { runProjectCreate } from "./commands/project.js";
import { runStats } from "./commands/stats.js";
import { runUninstall } from "./commands/uninstall.js";
import { runUpdate } from "./commands/update.js";
import { runUpgrade } from "./commands/upgrade.js";
import { runTrust, runValidate, runVerify } from "./commands/validate.js";
import { readManifest } from "./lib/manifest.js";
import type { Language } from "./lib/templates.js";

const VERSION = "0.1.0";

async function runCli() {
	const args = parseArgs({
		allowPositionals: true,
		options: {
			version: { type: "boolean", short: "v" },
			help: { type: "boolean", short: "h" },
			dir: { type: "string", short: "d" },
			tool: { type: "string", short: "t" },
			lang: { type: "string", short: "l" },
			buildTool: { type: "string" },
			validators: { type: "string" },
			workflows: { type: "string" },
			nonInteractive: { type: "boolean" },
			dryRun: { type: "boolean" },
			groupId: { type: "string" },
			force: { type: "boolean" },
			regenerate: { type: "boolean" },
			verbose: { type: "boolean" },
			repoTool: { type: "string" },
			context: { type: "string" },
			session: { type: "string" },
		},
	});

	if (args.values.version) {
		console.log(`guardian-framework v${VERSION}`);
		return;
	}

	if (args.values.help) {
		console.log(`
guardian-framework - Token-optimized agentic framework scaffolder

Usage:
  guardian-framework init          Initialize framework in current directory
  guardian-framework generate      Generate exports from .pi source
  guardian-framework update        Smart merge framework updates
  guardian-framework upgrade       Migrate to new version
  guardian-framework uninstall     Remove Guardian-managed files
  guardian-framework info          Display manifest information
  guardian-framework stats         Token savings analytics and USD estimation
  guardian-framework validate      Run TOML-based validators
  guardian-framework verify        File integrity verification
  guardian-framework trust         Trust-gated config management
  guardian-framework domain        DDD domain exploration CLI

Options:
  -v, --version              Show version
  -h, --help                 Show help
  -d, --dir <path>           Target directory (default: current)

Init options:
  -t, --tool <name>          AI tool (pi, claude, opencode, agents, github)
  -l, --lang <name>          Language (typescript, rust, python, go, java)
  --buildTool <name>         Build tool (maven, gradle) — only for Java
  --groupId <name>           Group/package prefix (default: com.<project-name>)

Project options:
  Project scaffolding from architecture decisions
  guardian project create [options]

  -l, --lang <name>          Language (required)
  --buildTool <name>         Build tool (maven, gradle)
  --repoTool <name>          Git CLI tool (gh, glab) — reads from manifest if not specified
  --groupId <name>           Group/package prefix (reads from manifest if not specified)
  --validators <list>        Validators for CI pipeline
  --dryRun                   Show plan without writing files
  --force                    Override existing project guard
  --workflows <list>         Workflows (comma-separated)
  --nonInteractive           Use defaults/flags, skip prompts

Generate options:
  --tool <name>              Target tool or "all" (default: all configured tools)
  --dryRun                   Show changes without writing
  --force                    Overwrite existing files

Update options:
  --dryRun                   Show changes without applying
  --force                    Overwrite user-editable files (dangerous)
  --regenerate               Regenerate exports after update

Uninstall options:
  --dryRun                   Show files that would be removed
  --force                    Required to remove Guardian-managed files

Validate options:
  --filter <name>            Run only matching validator
  --verify                   Run inline tests, don't validate
  --verbose                  Show detailed output during validation

Stats options:
  --days <N>                 Time window (default: 30)
  --history                  Show recent command history
  --clear                    Clear tracking history
`);
		return;
	}

	const command = args.positionals[0];

	if (!command) {
		// No command specified, run init interactively
		await runInit(args.values.dir || process.cwd());
		return;
	}

	await runCommand(command, args);
}

async function runCommand(
	command: string,
	args: { values: Record<string, unknown>; positionals: string[] },
) {
	const targetDir = (args.values.dir as string) || process.cwd();

	switch (command) {
		case "init":
			await runInit(targetDir);
			break;
		case "generate":
			await runGenerate(targetDir, {
				tool: args.values.tool as string | undefined,
				dryRun: args.values.dryRun as boolean | undefined,
				force: args.values.force as boolean | undefined,
			});
			break;
		case "update":
			await runUpdate(targetDir, {
				dryRun: args.values.dryRun as boolean | undefined,
				force: args.values.force as boolean | undefined,
				regenerate: args.values.regenerate as boolean | undefined,
			});
			break;
		case "upgrade":
			await runUpgrade(targetDir, {
				dryRun: args.values.dryRun as boolean | undefined,
			});
			break;
		case "uninstall":
			await runUninstall(targetDir, {
				dryRun: args.values.dryRun as boolean | undefined,
				force: args.values.force as boolean | undefined,
			});
			break;
		case "info":
			await runInfo(targetDir);
			break;
		case "stats":
			await runStats({
				days: Number(args.values.days) || 30,
				history: args.values.history as boolean | undefined,
				clear: args.values.clear as boolean | undefined,
			});
			break;
		case "validate":
			await runValidate(targetDir, {
				filter: args.values.filter as string | undefined,
				verify: args.values.verify as boolean | undefined,
				verbose: args.values.verbose as boolean | undefined,
			});
			break;
		case "verify":
			await runVerify(targetDir);
			break;
		case "trust":
			await runTrust(targetDir, {
				list: args.values.list as boolean | undefined,
				revoke: args.values.revoke as boolean | undefined,
				file: args.positionals[1],
			});
			break;
		case "project":
			if (args.positionals[1] === "create") {
				// Read groupId from manifest if not passed via CLI
				const manifest = readManifest(targetDir);
				const resolvedGroupId =
					(args.values.groupId as string) || manifest?.groupId || "com.example";
				const resolvedRepoTool =
					(args.values.repoTool as "gh" | "glab") || manifest?.repoTool || "gh";

				await runProjectCreate(targetDir, {
					language: args.values.lang as Language,
					buildTool: args.values.buildTool as "maven" | "gradle" | undefined,
					groupId: resolvedGroupId,
					repoTool: resolvedRepoTool,
					validators: (args.values.validators as string)?.split(",") || ["ci", "tests"],
					dryRun: args.values.dryRun as boolean | undefined,
					force: args.values.force as boolean | undefined,
				});
			} else {
				console.error("Usage: guardian project create [options]");
			}
			break;
		case "domain":
			await runDomain(targetDir, args.positionals.slice(1), {
				context: args.values.context as string | undefined,
				session: args.values.session as string | undefined,
				dryRun: args.values.dryRun as boolean | undefined,
			});
			break;
		default:
			console.error(`Unknown command: ${command}`);
			console.log("Run 'guardian-framework --help' for usage");
	}
}

export { runCli };
