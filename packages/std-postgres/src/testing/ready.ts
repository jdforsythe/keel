import { simEngine } from "../server/internal/simEngine.ts";

/**
 * Loads the PGlite that sim databases run on (std.postgres Modes). Await it once in the app's vitest `setupFiles`;
 * after it every sim query settles in microtask rounds, with no timer.
 */
export async function ready(): Promise<void> {
  await simEngine();
}
