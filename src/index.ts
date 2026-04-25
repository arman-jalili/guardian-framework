#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { intro, isCancel, outro } from "@clack/prompts";
import { runInit } from "./commands/init.js";

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
		},
	});

	if (args.values.version) {
		console.log(`guardian-cli v${VERSION}`);
		return;
	}

	if (args.values.help) {
		console.log(`
guardian-cli - Token-optimized agentic framework scaffolder

Usage:
  guardian-cli init          Initialize framework in current directory
  guardian-cli generate      Generate exports from .pi source
  guardian-cli update        Smart merge framework updates
  guardian-cli upgrade       Migrate to new version
  guardian-cli info          Display manifest information

Options:
  -v, --version              Show version
  -h, --help                 Show help
  -d, --dir <path>           Target directory (default: current)

Init options:
  -t, --tool <name>          AI tool (pi, claude, opencode, agents)
  -l, --lang <name>          Language (typescript, rust, python, go)
  --validators <list>        Validators (comma-separated, ci always included)
  --workflows <list>         Workflows (comma-separated)
  --nonInteractive           Use defaults/flags, skip prompts
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
			console.log("Generate command - TODO");
			break;
		case "update":
			console.log("Update command - TODO");
			break;
		case "upgrade":
			console.log("Upgrade command - TODO");
			break;
		case "info":
			console.log("Info command - TODO");
			break;
		default:
			console.error(`Unknown command: ${command}`);
			console.log("Run 'guardian-cli --help' for usage");
	}
}

main().catch(console.error);
