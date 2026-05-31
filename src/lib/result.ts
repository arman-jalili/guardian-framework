/**
 * Canonical Reference: .pi/architecture/modules/core-libraries.md#result-type
 * Last Sync: 2026-05-31

 * Shared Result type for Guardian.
 *
 * Used by library functions that can fail. Commands should check .ok before proceeding.
 *
 *   const result = readTemplateFile(path);
 *   if (!result.ok) { console.error(result.error); return; }
 */

export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

/**
 * Canonical Reference: .pi/architecture/modules/core-libraries.md#result-type
 * Last Sync: 2026-05-31

 * Helper to wrap a potentially throwing expression in a Result.
 */
export function tryCatch<T>(fn: () => T, message?: string): Result<T, Error> {
	try {
		return { ok: true, value: fn() };
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err : new Error(message ?? "unknown error"),
		};
	}
}

/**
 * Canonical Reference: .pi/architecture/modules/core-libraries.md#result-type
 * Last Sync: 2026-05-31

 * Helper to wrap an async potentially throwing expression in a Result.
 */
export async function tryCatchAsync<T>(
	fn: () => Promise<T>,
	message?: string,
): Promise<Result<T, Error>> {
	try {
		return { ok: true, value: await fn() };
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err : new Error(message ?? "unknown error"),
		};
	}
}
