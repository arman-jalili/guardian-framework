/**
 * File Integrity Verification for Guardian
 *
 * SHA-256 hash verification for managed files to detect tampering or drift.
 * Inspired by RTK's integrity system.
 *
 * States: Verified | Tampered | NoBaseline | NotInstalled | OrphanedHash
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { type Result, tryCatch } from "./result.js";

// ── Types ──

export type IntegrityState =
	| "verified"
	| "tampered"
	| "no-baseline"
	| "not-installed"
	| "orphaned-hash";

export interface IntegrityResult {
	state: IntegrityState;
	filePath: string;
	hashPath: string;
	expectedHash?: string;
	actualHash?: string;
}

export interface VerificationReport {
	files: IntegrityResult[];
	summary: {
		total: number;
		verified: number;
		tampered: number;
		noBaseline: number;
		notInstalled: number;
		orphanedHash: number;
	};
}

const HASH_DIR = ".guardian";
const HASH_EXT = ".sha256";

// ── Helpers ──

function hashFile(filePath: string): string {
	const content = fs.readFileSync(filePath, "utf-8");
	return crypto.createHash("sha256").update(content).digest("hex");
}

function hashPathFor(filePath: string): string {
	const rel = filePath.replace(/^\.\//, "");
	const hashName = rel.replace(/[/\\]/g, "_") + HASH_EXT;
	return path.join(HASH_DIR, hashName);
}

// ── Public API ──

/**
 * Store SHA-256 hash for a file. Creates .guardian/<name>.sha256 (read-only 0o444).
 */
export function storeHash(filePath: string): Result<string, Error> {
	const hash = hashFile(filePath);
	const hashPath = hashPathFor(filePath);

	const writeResult = tryCatch(() => {
		fs.mkdirSync(HASH_DIR, { recursive: true });
		fs.writeFileSync(hashPath, `${hash}  ${filePath}\n`, "utf-8");
	});
	if (!writeResult.ok) return writeResult;

	try {
		fs.chmodSync(hashPath, 0o444);
	} catch {
		// Permission change may fail on some systems — non-fatal
	}

	return { ok: true, value: hash };
}

/**
 * Verify a file's integrity against its stored hash.
 */
export function verifyFile(filePath: string): IntegrityResult {
	const hashPath = hashPathFor(filePath);
	const hashExists = fs.existsSync(hashPath);
	const fileExists = fs.existsSync(filePath);

	if (!hashExists && !fileExists) {
		return { state: "not-installed", filePath, hashPath };
	}

	if (hashExists && !fileExists) {
		return { state: "orphaned-hash", filePath, hashPath };
	}

	if (!hashExists && fileExists) {
		return { state: "no-baseline", filePath, hashPath };
	}

	// Both exist — compare hashes
	const expected = fs.readFileSync(hashPath, "utf-8").split("  ")[0].trim();
	const actual = hashFile(filePath);

	return {
		state: expected === actual ? "verified" : "tampered",
		filePath,
		hashPath,
		expectedHash: expected,
		actualHash: actual,
	};
}

/**
 * Verify all files in a directory against stored hashes.
 */
export function verifyDirectory(dirPath: string): VerificationReport {
	const results: IntegrityResult[] = [];

	// Check all tracked files
	const hashDir = path.join(dirPath, HASH_DIR);
	if (fs.existsSync(hashDir)) {
		const hashFiles = fs.readdirSync(hashDir).filter((f) => f.endsWith(HASH_EXT));
		for (const hf of hashFiles) {
			const hashPath = path.join(hashDir, hf);
			const content = fs.readFileSync(hashPath, "utf-8");
			const filePath = content.split("  ")[1]?.trim() ?? hf.replace(HASH_EXT, "");
			const fullPath = path.isAbsolute(filePath) ? filePath : path.join(dirPath, filePath);
			results.push(verifyFile(fullPath));
		}
	}

	// Also check all managed files that might not have hashes yet
	const manifestPath = path.join(dirPath, "guardian-manifest.json");
	if (fs.existsSync(manifestPath)) {
		const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
		for (const filePath of Object.keys(manifest.files ?? {})) {
			const fullPath = path.join(dirPath, filePath);
			const alreadyChecked = results.some((r) => r.filePath === fullPath);
			if (!alreadyChecked) {
				results.push(verifyFile(fullPath));
			}
		}
	}

	const summary = {
		total: results.length,
		verified: results.filter((r) => r.state === "verified").length,
		tampered: results.filter((r) => r.state === "tampered").length,
		noBaseline: results.filter((r) => r.state === "no-baseline").length,
		notInstalled: results.filter((r) => r.state === "not-installed").length,
		orphanedHash: results.filter((r) => r.state === "orphaned-hash").length,
	};

	return { files: results, summary };
}

/**
 * Remove stored hash for a file.
 */
export function removeHash(filePath: string): Result<void, Error> {
	const hashPath = hashPathFor(filePath);
	if (fs.existsSync(hashPath)) {
		return tryCatch(() => {
			fs.chmodSync(hashPath, 0o644);
			fs.unlinkSync(hashPath);
		});
	}
	return { ok: true, value: undefined };
}
