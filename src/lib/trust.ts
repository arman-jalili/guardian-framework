/**
 * Trust-Gated Project-Local Configuration for GuardianCLI
 *
 * Prevents malicious extension/filter injection from repos by requiring
 * explicit trust before project-local TOML filters execute.
 * Inspired by RTK's trust.rs.
 *
 * Trust workflow:
 *   1. Project-local config detected → marked Untrusted
 *   2. User runs `guardian trust` → reviews config → marks Trusted
 *   3. Config changes after trust → marked ContentChanged → requires re-trust
 *   4. `RTK_TRUST_OVERRIDE=1` env bypasses trust check (CI)
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

export type TrustStatus = "trusted" | "untrusted" | "content-changed" | "env-override";

export interface TrustRecord {
	filePath: string;
	hash: string;
	trustedAt: string;
}

const TRUST_FILE = ".guardian/trust.json";

// ── Helpers ──

function hashFile(filePath: string): string {
	const content = fs.readFileSync(filePath, "utf-8");
	return crypto.createHash("sha256").update(content).digest("hex");
}

function loadTrustFile(cwd: string): TrustRecord[] {
	const trustPath = path.join(cwd, TRUST_FILE);
	if (!fs.existsSync(trustPath)) return [];
	try {
		return JSON.parse(fs.readFileSync(trustPath, "utf-8")) as TrustRecord[];
	} catch {
		return [];
	}
}

function saveTrustFile(cwd: string, records: TrustRecord[]): void {
	const trustPath = path.join(cwd, TRUST_FILE);
	const tmpPath = `${trustPath}.tmp`;
	fs.mkdirSync(path.dirname(trustPath), { recursive: true });
	fs.writeFileSync(tmpPath, JSON.stringify(records, null, 2), "utf-8");
	fs.renameSync(tmpPath, trustPath);
}

// ── Public API ──

/**
 * Check trust status for a project-local config file.
 */
export function checkTrust(cwd: string, filePath: string): TrustStatus {
	// Env override for CI
	if (process.env.GUARDIAN_TRUST_OVERRIDE === "1") return "env-override";

	const trustRecords = loadTrustFile(cwd);
	const record = trustRecords.find((r) => r.filePath === filePath);

	if (!record) return "untrusted";

	// Check if content has changed since trusted
	const currentHash = hashFile(filePath);
	if (currentHash !== record.hash) return "content-changed";

	return "trusted";
}

/**
 * Trust a project-local config file. Stores SHA-256 hash and timestamp.
 */
export function trustFile(cwd: string, filePath: string): void {
	const hash = hashFile(filePath);
	const records = loadTrustFile(cwd);

	// Remove existing record for this file
	const filtered = records.filter((r) => r.filePath !== filePath);

	filtered.push({
		filePath,
		hash,
		trustedAt: new Date().toISOString(),
	});

	saveTrustFile(cwd, filtered);
}

/**
 * Revoke trust for a project-local config file.
 */
export function revokeTrust(cwd: string, filePath: string): void {
	const records = loadTrustFile(cwd);
	const filtered = records.filter((r) => r.filePath !== filePath);
	saveTrustFile(cwd, filtered);
}

/**
 * List all trusted files.
 */
export function listTrusted(cwd: string): TrustRecord[] {
	return loadTrustFile(cwd);
}

/**
 * Get human-readable trust status message.
 */
export function trustStatusMessage(status: TrustStatus, filePath: string): string {
	switch (status) {
		case "trusted":
			return `✅ Trusted: ${filePath}`;
		case "untrusted":
			return `⚠️  Untrusted: ${filePath} — run 'guardian trust' to review and enable`;
		case "content-changed":
			return `⚠️  Content changed: ${filePath} — run 'guardian trust' to re-review`;
		case "env-override":
			return "🔓 Trust overridden by GUARDIAN_TRUST_OVERRIDE=1";
	}
}
