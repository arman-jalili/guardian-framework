#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { intro, outro, text, select, multiselect, isCancel } from "@clack/prompts";

const VERSION = "0.1.0";

async function main() {
	const args = parseArgs({
		allowPositionals: true,
		options: {
			version: { type: "boolean", short: "v" },
			help: { type: "boolean", short: "h" },
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
  -v, --version    Show version
  -h, --help       Show help
`);
		return;
	}

	const command = args.positionals[0];

	if (!command) {
		intro(`guardian-cli v${VERSION}`);

		const action = await select({
			message: "What would you like to do?",
			options: [
				{ value: "init", label: "Initialize framework" },
				{ value: "generate", label: "Generate exports" },
				{ value: "update", label: "Update framework" },
				{ value: "info", label: "View manifest info" },
			],
		});

		if (isCancel(action)) {
			outro("Cancelled");
			return;
		}

		await runCommand(action as string);
		outro("Done!");
		return;
	}

	await runCommand(command);
}

async function runCommand(command: string) {
	switch (command) {
		case "init":
			console.log("Init command - TODO");
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