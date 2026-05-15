#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { intro, isCancel, outro } from "@clack/prompts";
import { runGenerate } from "./commands/generate.js";
import { runInfo } from "./commands/info.js";
import { runInit } from "./commands/init.js";
import { runStats } from "./commands/stats.js";
import { runUninstall } from "./commands/uninstall.js";
import { runUpdate } from "./commands/update.js";
import { runUpgrade } from "./commands/upgrade.js";
import { runTrust, runValidate, runVerify } from "./commands/validate.js";

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
			verbose: { type: "boolean" },
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
  guardian-framework-cli uninstall     Remove Guardian-managed files
  guardian-framework-cli info          Display manifest information
  guardian-framework-cli stats         Token savings analytics and USD estimation
  guardian-framework-cli validate      Run TOML-based validators
  guardian-framework-cli verify        File integrity verification
  guardian-framework-cli trust         Trust-gated config management

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
		default:
			console.error(`Unknown command: ${command}`);
			console.log("Run 'guardian-framework-cli --help' for usage");
	}
}

main().catch(console.error);
