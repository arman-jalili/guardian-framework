/**
 * Guardian Framework — Pi Package Bootstrap
 *
 * Onboards users who install guardian-framework as a pi package.
 * Checks if the project is scaffolded and guides them through setup.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const PI_DIR = ".pi";
const PACKAGE_VERSION = "0.1.0";

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
				`Guardian Framework v${PACKAGE_VERSION} loaded. ${isScaffolded ? "Project scaffolded." : ""}`,
				"info",
			);
		}
	});

	pi.registerCommand("guardian-init", {
		description:
			"Scaffold Guardian framework (.pi/ + exports for AI tools)",
		handler: async (_args: string, ctx: any) => {
			const piDir = join(ctx.cwd, PI_DIR);
			if (existsSync(piDir)) {
				ctx.ui.notify("Guardian already scaffolded in this project.", "warn");
				return;
			}

			ctx.ui.notify("Scaffolding Guardian framework...", "info");
			try {
				const result = execSync("npx guardian-framework init --nonInteractive --lang typescript", {
					cwd: ctx.cwd,
					encoding: "utf-8",
					timeout: 60000,
					stdio: ["pipe", "pipe", "pipe"],
				});
				ctx.ui.notify("Guardian scaffolded successfully!", "success");
				return result.trim();
			} catch (e: any) {
				ctx.ui.notify(
					`Scaffolding failed. Run 'npx guardian-framework init' manually.\nError: ${e.message?.slice(0, 200) || e}`,
					"error",
				);
			}
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
				lines.push("- `/guardian-init` — interactive scaffold");
				lines.push("- `npx guardian-framework init` — interactive CLI");
				lines.push("");
				lines.push("Or for detailed docs:");
				lines.push("- `npx guardian-framework --help`");
				lines.push("- https://github.com/arman-jalili/guardian-framework");
			}

			return lines.join("\n");
		},
	});
}
