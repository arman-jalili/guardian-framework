/**
 * Validate command for Guardian
 *
 * Run TOML-based declarative validators with inline test verification.
 * Supports project-local, user-global, and built-in filter definitions.
 */

import * as child_process from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { outro, spinner } from "@clack/prompts";
import {
	type TomlFilterDef,
	applyFilter,
	calculateSavings,
	parseTomlValidators,
	runValidatorTests,
} from "../lib/toml-filter.js";
import { track } from "../lib/tracking.js";
import { checkTrust, trustStatusMessage } from "../lib/trust.js";

const PI_VALIDATORS_DIR = ".pi/validators";
const USER_GLOBAL_PATH = path.join(
	process.env.HOME ?? process.env.USERPROFILE ?? "",
	".config",
	"guardian",
	"filters.toml",
);
const BUILTIN_PATH = path.join(
	__dirname,
	"..",
	"..",
	"templates",
	"pi",
	"validators",
	"default.toml",
);

/**
 * Load TOML filters from all tiers.
 */
function loadFilters(targetDir: string): { filters: TomlFilterDef[]; warnings: string[] } {
	const filters: TomlFilterDef[] = [];
	const warnings: string[] = [];

	// Tier 1: Project-local (trust-gated)
	const projectDir = path.join(targetDir, PI_VALIDATORS_DIR);
	if (fs.existsSync(projectDir)) {
		for (const file of fs.readdirSync(projectDir).filter((f) => f.endsWith(".toml"))) {
			const filePath = path.join(projectDir, file);
			const trustStatus = checkTrust(targetDir, filePath);

			if (trustStatus === "untrusted" || trustStatus === "content-changed") {
				warnings.push(trustStatusMessage(trustStatus, filePath));
				continue;
			}

			try {
				const content = fs.readFileSync(filePath, "utf-8");
				const parsed = parseTomlValidators(content);
				filters.push(...parsed);
			} catch (err) {
				warnings.push(`⚠️  Failed to parse ${file}: ${err}`);
			}
		}
	}

	// Tier 2: User-global
	if (fs.existsSync(USER_GLOBAL_PATH)) {
		try {
			const content = fs.readFileSync(USER_GLOBAL_PATH, "utf-8");
			filters.push(...parseTomlValidators(content));
		} catch (err) {
			warnings.push(`⚠️  Failed to parse user-global config: ${err}`);
		}
	}

	// Tier 3: Built-in
	if (fs.existsSync(BUILTIN_PATH)) {
		try {
			const content = fs.readFileSync(BUILTIN_PATH, "utf-8");
			filters.push(...parseTomlValidators(content));
		} catch {
			// Built-in not found — non-fatal
		}
	}

	return { filters, warnings };
}

/**
 * Run validate command
 */
export async function runValidate(
	targetDir: string = process.cwd(),
	options: { filter?: string; verify?: boolean; verbose?: boolean } = {},
): Promise<void> {
	const s = spinner();
	s.start("Loading validators...");

	const { filters, warnings } = loadFilters(targetDir);

	if (warnings.length > 0) {
		s.stop("Validators loaded with warnings:");
		for (const w of warnings) console.log(`  ${w}`);
		console.log();
	}

	if (filters.length === 0) {
		outro("No validators found. Create .pi/validators/*.toml files to define validation rules.");
		return;
	}

	// Verify inline tests
	if (options.verify) {
		s.start("Running inline tests...");
		const results = runValidatorTests(filters);

		if (results.outcomes.length === 0) {
			s.stop("No inline tests found.");
			if (results.filters_without_tests.length > 0) {
				console.log(`\nFilters without tests: ${results.filters_without_tests.join(", ")}`);
			}
			return;
		}

		const passed = results.outcomes.filter((o) => o.passed).length;
		const failed = results.outcomes.length - passed;

		if (failed === 0) {
			s.stop(`✅ All ${results.outcomes.length} tests passed`);
		} else {
			s.stop(`❌ ${failed}/${results.outcomes.length} tests failed`);
			for (const o of results.outcomes.filter((o) => !o.passed)) {
				console.log(`\n  ❌ ${o.filter_name} → ${o.test_name}`);
				if (options.verbose) {
					console.log(`    Expected: ${o.expected}`);
					console.log(`    Actual:   ${o.actual}`);
				}
			}
			// Return error information instead of process.exit
			outro(`\n${failed} test(s) failed. Fix inline tests and re-run.`);
			return;
		}

		if (results.filters_without_tests.length > 0) {
			console.log(`\n⚠️  Filters without tests: ${results.filters_without_tests.join(", ")}`);
		}

		if (!options.filter) {
			outro("Verification complete.");
			return;
		}
	}

	// If --verify was the only flag, stop here
	if (options.verify && !options.filter) {
		outro("Verification complete.");
		return;
	}

	// Run validators — actually execute the configured commands
	s.start("Running validators...");

	let totalInput = 0;
	let totalOutput = 0;
	let totalSaved = 0;
	let passed = 0;
	let failed = 0;

	const targetFilters = options.filter
		? filters.filter((f) => f.name.includes(options.filter as string))
		: filters;

	// Warn about shell command execution (all TOML validators run via bash -lc)
	if (targetFilters.length > 0) {
		console.log(
			"  ⚠️  Validators execute shell commands defined in TOML config. Review .pi/validators/*.toml before trusting.\n",
		);
	}

	if (targetFilters.length === 0) {
		s.stop(`No validators matching "${options.filter}"`);
		return;
	}

	for (const filter of targetFilters) {
		const startTime = Date.now();

		// Execute the actual validator command
		let stdout = "";
		let commandSuccess = false;

		if (filter.command) {
			try {
				const result = child_process.spawnSync("bash", ["-lc", filter.command], {
					cwd: targetDir,
					timeout: 60_000,
					maxBuffer: 10 * 1024 * 1024, // 10MB
					encoding: "utf-8",
				});

				stdout = (result.stdout ?? "") + (result.stderr ?? "");
				commandSuccess = (result.status ?? 1) === 0;
			} catch (err) {
				stdout = `Command execution error: ${err instanceof Error ? err.message : String(err)}`;
				commandSuccess = false;
			}
		}

		if (!commandSuccess) {
			console.log(
				`  ✗ ${filter.name.padEnd(25)} ${filter.description ?? "No description"} — command failed`,
			);
			if (options.verbose && stdout.trim()) {
				const truncated = stdout.length > 200 ? `${stdout.slice(0, 200)}...` : stdout;
				console.log(`    ${truncated.trim()}`);
			}
			failed++;
			continue;
		}

		// Apply the filter pipeline to command output
		const filtered = applyFilter(filter, stdout);
		const savings = calculateSavings(filter, stdout);
		totalInput += savings.inputTokens;
		totalOutput += savings.outputTokens;
		totalSaved += savings.savedTokens;

		console.log(`  ✓ ${filter.name.padEnd(25)} ${filter.description ?? "No description"}`);
		passed++;

		// Track token usage
		track({
			validator: filter.name,
			inputTokens: savings.inputTokens,
			outputTokens: savings.outputTokens,
			execTimeMs: Date.now() - startTime,
		});
	}

	s.stop(`Validation complete: ${passed} passed, ${failed} failed`);

	console.log(`\n  Tokens saved: ${totalSaved} (from ${totalInput} → ${totalOutput})`);

	if (totalInput > 0) {
		const savingsPct = ((totalSaved / totalInput) * 100).toFixed(1);
		console.log(`  Savings: ${savingsPct}%`);
	}

	if (failed > 0) {
		outro(`\n⚠️  ${failed} validator(s) failed. Check output above.`);
	}
}

/**
 * Run trust command
 */
export async function runTrust(
	targetDir: string = process.cwd(),
	options: { list?: boolean; revoke?: boolean; file?: string } = {},
): Promise<void> {
	if (options.list) {
		const { listTrusted } = await import("../lib/trust.js");
		const trusted = listTrusted(targetDir);
		if (trusted.length === 0) {
			outro("No trusted files.");
			return;
		}
		console.log("\nTrusted files:\n");
		for (const t of trusted) {
			console.log(
				`  ✅ ${t.filePath} (trusted ${t.trustedAt.split("T")[0]}, hash: ${t.hash.slice(0, 12)}...)`,
			);
		}
		console.log();
		return;
	}

	if (!options.file) {
		outro("Usage: guardian trust <file> | guardian trust --list | guardian trust --revoke <file>");
		return;
	}

	const { trustFile, revokeTrust, checkTrust } = await import("../lib/trust.js");

	if (options.revoke) {
		revokeTrust(targetDir, options.file);
		outro(`Trust revoked for ${options.file}`);
		return;
	}

	const status = checkTrust(targetDir, options.file);
	if (status === "trusted") {
		outro(`${options.file} is already trusted.`);
		return;
	}

	// Show file content for review
	if (fs.existsSync(options.file)) {
		const content = fs.readFileSync(options.file, "utf-8");
		console.log(`\nFile to trust: ${options.file}\n`);
		console.log(content.slice(0, 2000));
		if (content.length > 2000) console.log(`\n... (${content.length - 2000} more chars)`);
	}

	trustFile(targetDir, options.file);
	outro(`✅ Trusted: ${options.file}`);
}

/**
 * Run verify command (file integrity)
 */
export async function runVerify(targetDir: string = process.cwd()): Promise<void> {
	const { verifyDirectory } = await import("../lib/integrity.js");

	const s = spinner();
	s.start("Verifying file integrity...");

	const report = verifyDirectory(targetDir);

	if (report.summary.total === 0) {
		s.stop("No files tracked for integrity verification.");
		return;
	}

	s.stop(`Verification complete: ${report.summary.verified}/${report.summary.total} verified`);

	if (report.summary.tampered > 0) {
		console.log(`\n  ❌ Tampered files (${report.summary.tampered}):`);
		for (const f of report.files.filter((r) => r.state === "tampered")) {
			console.log(
				`    ${f.filePath} (expected: ${f.expectedHash?.slice(0, 12)}..., got: ${f.actualHash?.slice(0, 12)}...)`,
			);
		}
	}

	if (report.summary.noBaseline > 0) {
		console.log(`\n  ⚠️  Files without baseline (${report.summary.noBaseline}):`);
		for (const f of report.files.filter((r) => r.state === "no-baseline")) {
			console.log(`    ${f.filePath} — run 'guardian hash ${f.filePath}' to store baseline`);
		}
	}

	if (report.summary.orphanedHash > 0) {
		console.log(`\n  ⚠️  Orphaned hashes (${report.summary.orphanedHash}):`);
		for (const f of report.files.filter((r) => r.state === "orphaned-hash")) {
			console.log(`    ${f.filePath} — file deleted but hash remains`);
		}
	}

	console.log();
}
