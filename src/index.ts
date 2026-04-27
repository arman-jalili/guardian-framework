#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { intro, isCancel, outro } from "@clack/prompts";
import { runGenerate } from "./commands/generate.js";
import { runInfo } from "./commands/info.js";
import { runInit } from "./commands/init.js";
import { runUpdate } from "./commands/update.js";

const VERSION = "0.1.0";

async function main() {
	const args = parseArgs({
		allowPositionals: true,
		options: {
			version: { type: "boolean", short: "v" },
			help: { type: "boolean", short: "h" },
			dir: { type: "string", short: "d" },
			tool: { type: "string", short: "t" },
			lang: { type: "string", short: "l" },
			validators: { type: "string" },
			workflows: { type: "string" },
			nonInteractive: { type: "boolean" },
			dryRun: { type: "boolean" },
			force: { type: "boolean" },
			regenerate: { type: "boolean" },
		},
	});

	if (args.values.version) {
		console.log(`guardian-framework-cli v${VERSION}`);
		return;
	}

	if (args.values.help) {
		console.log(`
guardian-framework-cli - Token-optimized agentic framework scaffolder

Usage:
  guardian-framework-cli init          Initialize framework in current directory
  guardian-framework-cli generate      Generate exports from .pi source
  guardian-framework-cli update        Smart merge framework updates
  guardian-framework-cli upgrade       Migrate to new version
  guardian-framework-cli info          Display manifest information

Options:
  -v, --version              Show version
  -h, --help                 Show help
  -d, --dir <path>           Target directory (default: current)

Init options:
  -t, --tool <name>          AI tool (pi, claude, opencode, agents, github)
  -l, --lang <name>          Language (typescript, rust, python, go)
  --validators <list>        Validators (comma-separated, ci always included)
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
			console.log("Upgrade command - TODO");
			break;
		case "info":
			await runInfo(targetDir);
			break;
		default:
			console.error(`Unknown command: ${command}`);
			console.log("Run 'guardian-framework-cli --help' for usage");
	}
}

main().catch(console.error);
