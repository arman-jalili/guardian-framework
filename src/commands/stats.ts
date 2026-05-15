/**
 * Stats command for Guardian
 *
 * Display token tracking stats, USD savings, and validator performance.
 * Inspired by RTK's `rtk gain` command.
 */

import { outro } from "@clack/prompts";
import {
	clearHistory,
	estimateUsdSaved,
	formatTime,
	formatTokens,
	getHistory,
	getStats,
} from "../lib/tracking.js";

/**
 * Run stats command
 */
export async function runStats(options: {
	days?: number;
	history?: boolean;
	clear?: boolean;
}): Promise<void> {
	if (options.clear) {
		clearHistory();
		outro("Token tracking history cleared.");
		return;
	}

	if (options.history) {
		const records = getHistory(20);
		if (records.length === 0) {
			outro("No token tracking history yet. Run validators to start collecting data.");
			return;
		}

		console.log("\nRecent Token Tracking History:\n");
		console.log(
			`  ${"Validator".padEnd(30)} ${"Input".padStart(10)} ${"Output".padStart(10)} ${"Saved".padStart(10)} ${"Time".padStart(8)}`,
		);
		console.log(
			`  ${"─".repeat(30)} ${"─".repeat(10)} ${"─".repeat(10)} ${"─".repeat(10)} ${"─".repeat(8)}`,
		);

		for (const r of records) {
			console.log(
				`  ${r.validator.padEnd(30)} ${formatTokens(r.inputTokens).padStart(10)} ${formatTokens(r.outputTokens).padStart(10)} ${formatTokens(r.savedTokens).padStart(10)} ${formatTime(r.execTimeMs).padStart(8)}`,
			);
		}
		console.log();
		return;
	}

	const days = options.days ?? 30;
	const stats = getStats(days);

	if (stats.totalCommands === 0) {
		outro(
			`No token tracking data for the last ${days} days. Run validators to start collecting data.`,
		);
		return;
	}

	console.log(`
┌─────────────────────────────────────────────────────────────┐
│ Token Savings Report (last ${days} days)                            │
├─────────────────────────────────────────────────────────────┤
│ Commands tracked:    ${String(stats.totalCommands).padEnd(38)}│
│ Avg savings:         ${`${stats.avgSavingsPct}%`.padEnd(38)}│
│ Total tokens saved:  ${formatTokens(stats.totalSavedTokens).padEnd(38)}│
│ Est. USD saved:      $${stats.totalUsdSaved.toFixed(2).padEnd(37)}│
│ Total exec time:     ${formatTime(stats.totalExecTimeMs).padEnd(38)}│
│ Avg exec time:       ${formatTime(stats.avgExecTimeMs).padEnd(38)}│
├─────────────────────────────────────────────────────────────┤
│ Top Validators                                               │
├─────────────────────────────────────────────────────────────┤
${stats.topValidators.map((v, i) => `│ ${String(i + 1).padEnd(2)} ${v.validator.padEnd(25)} ${String(v.count).padStart(5)} runs${" ".repeat(38 - v.validator.length)}│`).join("\n")}
├─────────────────────────────────────────────────────────────┤
│ Daily Savings                                                │
├─────────────────────────────────────────────────────────────┤
${stats.dailyBreakdown.map((d) => `│ ${d.date.padEnd(12)} ${formatTokens(d.tokens).padStart(10)} tokens  $${d.usd.toFixed(2).padStart(6)}${" ".repeat(16)}│`).join("\n")}
└─────────────────────────────────────────────────────────────┘

Estimated USD savings based on average API pricing ($3/M input, $10/M output).
`);
}
