/**
 * Guardian Framework — Pi Package Bootstrap
 *
 * Onboards users who install guardian-framework as a pi package.
 * Checks if the project is scaffolded and guides them through setup.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

const PI_DIR = ".pi";
const PACKAGE_VERSION = "0.1.1";

export default function (pi: any) {
	pi.on("session_start", async (_event: any, ctx: any) => {
		const piDir = join(ctx.cwd, PI_DIR);
		const isScaffolded = existsSync(piDir);

		if (!isScaffolded) {
			ctx.ui.notify(
				"Guardian Framework: project not scaffolded. Run `guardian-framework init` or use /guardian-init to get started.",
				"info",
			);
		} else {
			ctx.ui.notify(
				`Guardian Framework v${PACKAGE_VERSION} loaded — ${isScaffolded ? "project scaffolded" : ""}`,
				"info",
			);
		}
	});

	pi.registerCommand("guardian-init", {
		description:
			"Show instructions to scaffold Guardian framework (.pi/ + exports)",
		handler: async (_args: string, ctx: any) => {
			const piDir = join(ctx.cwd, PI_DIR);
			if (existsSync(piDir)) {
				ctx.ui.notify("Guardian already scaffolded in this project.", "warn");
				return;
			}

			const msg = [
				"## Scaffold Guardian Framework",
				"",
				"Run this in your terminal:",
				"",
				"```bash",
				"npx guardian-framework init",
				"```",
				"",
				"This will guide you through:",
				"- Project name, version, repository",
				"- Language (typescript, rust, python, go, java)",
				"- AI tools (pi, claude, github, omp, opencode, agents)",
				"- Architecture mode (strict or simplified)",
				"",
				"After scaffolding, restart pi to load all Guardian extensions.",
				"Run `/guardian-status` to check availability.",
				"",
				"Full manual: https://github.com/arman-jalili/guardian-framework/blob/main/docs/USER_MANUAL.md",
			].join("\n");

			pi.sendMessage(
				{ content: msg, display: true },
				{ deliverAs: "followUp", triggerTurn: false },
			);
		},
	});

	pi.registerCommand("guardian-status", {
		description:
			"Check Guardian framework status — installed resources + scaffold state",
		handler: async (_args: string, ctx: any) => {
			const piDir = join(ctx.cwd, PI_DIR);
			const isScaffolded = existsSync(piDir);

			const lines = [
				"## Guardian Framework Status",
				"",
				`Version: ${PACKAGE_VERSION}`,
				`Project scaffolded: ${isScaffolded ? "Yes" : "No"}`,
				"",
			];

			if (isScaffolded) {
				lines.push("### Resources Available");
				lines.push("");
				lines.push("- 19 TypeScript extensions (via package + .pi/extensions/)");
				lines.push("- 27 agent skill definitions");
				lines.push("- 10 validator skill definitions");
				lines.push("- 22 workflow prompt templates");
				lines.push("- 50+ validation shell scripts");
				lines.push("");
				lines.push("### Commands");
				lines.push("");
				lines.push("- /architect --epic <name>   — Start epic from architecture");
				lines.push("- /pipeline <name> --items=... --steps=...  — Multi-step workflow");
				lines.push("- /goal <text>               — Persistent objective");
				lines.push("- /kanban create|list|status — Task board");
				lines.push("- /domain --explore <desc>   — DDD exploration");
				lines.push("- /project create --lang ... — Source scaffolding");
				lines.push("- /validate                  — Run validators");
				lines.push("- /curator review            — Skill lifecycle");
				lines.push("- /plan | /plan-apply        — Queue edits for review");
				lines.push("- /snippet list|add|remove   — Token expansion");
			} else {
				lines.push("### Getting Started");
				lines.push("");
				lines.push("Run one of:");
				lines.push("- `/guardian-init` — shows setup instructions");
				lines.push("- `npx guardian-framework init` — interactive CLI scaffold");
				lines.push("");
				lines.push("Or for detailed docs:");
				lines.push("- https://github.com/arman-jalili/guardian-framework");
			}

			return lines.join("\n");
		},
	});
}
