/**
 * Upgrade command for Guardian
 *
 * Migrates a scaffolded project to the latest framework version.
 * Handles breaking changes between schema versions.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { outro, spinner } from "@clack/prompts";
import {
	FRAMEWORK_VERSION,
	type GuardianManifest,
	SCHEMA_VERSION,
	readManifest,
	writeManifest,
} from "../lib/manifest.js";

/**
 * Run upgrade command
 */
export async function runUpgrade(
	targetDir: string = process.cwd(),
	options: { dryRun?: boolean } = {},
): Promise<void> {
	const manifest = readManifest(targetDir);
	if (!manifest) {
		outro("No manifest found. Run 'guardian-framework init' first.");
		return;
	}

	const currentSchema = manifest.schemaVersion ?? "unknown";
	const currentFramework = manifest.frameworkVersion ?? "unknown";

	if (currentSchema === SCHEMA_VERSION && currentFramework === FRAMEWORK_VERSION) {
		outro(
			`Project is already on the latest version (schema ${SCHEMA_VERSION}, framework ${FRAMEWORK_VERSION}).`,
		);
		return;
	}

	const migrations: string[] = [];

	// Schema version migrations
	if (currentSchema !== SCHEMA_VERSION) {
		migrations.push(`Schema: ${currentSchema} → ${SCHEMA_VERSION}`);

		// Migration: 0.x → 1.0: ensure all required fields exist
		if (currentSchema === "0.1" || currentSchema.startsWith("0.")) {
			migrateSchemaV0ToV1(manifest);
		}
	}

	// Framework version migrations
	if (currentFramework !== FRAMEWORK_VERSION) {
		migrations.push(`Framework: ${currentFramework} → ${FRAMEWORK_VERSION}`);
	}

	if (migrations.length === 0) {
		outro("No migrations needed.");
		return;
	}

	if (options.dryRun) {
		outro(`Dry run — would apply:\n  ${migrations.join("\n  ")}`);
		return;
	}

	const s = spinner();
	s.start("Applying migrations...");

	// Update manifest versions
	manifest.schemaVersion = SCHEMA_VERSION;
	manifest.frameworkVersion = FRAMEWORK_VERSION;
	manifest.lastUpdatedAt = new Date().toISOString();

	writeManifest(targetDir, manifest);

	s.stop("Upgrade complete!");
	outro(
		`Migrated:\n  ${migrations.join("\n  ")}\n\nSchema: ${SCHEMA_VERSION}\nFramework: ${FRAMEWORK_VERSION}`,
	);
}

/**
 * Migrate manifest from schema v0.x to v1.0.
 * Adds missing required fields and normalizes structure.
 */
function migrateSchemaV0ToV1(manifest: GuardianManifest): void {
	// Ensure source defaults to "pi"
	if (!manifest.source) {
		manifest.source = "pi";
	}

	// Ensure empty arrays for optional list fields
	if (!manifest.validators) manifest.validators = [];
	if (!manifest.workflows) manifest.workflows = [];
	if (!manifest.tools) manifest.tools = [];
	if (!manifest.files) manifest.files = {};
	if (!manifest.exports) manifest.exports = {};

	// Normalize file record statuses
	for (const [_filePath, record] of Object.entries(manifest.files)) {
		if (!record.status) {
			record.status = "unchanged";
		}
		if (!record.category) {
			record.category = "framework";
		}
	}
}
