import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Vitest global setup: after the run, removes the compiler artifacts a group user writes beside the notes fixture's
 * Vite config. Left on disk they read as a project of the workspace, and `keel ledger` counts its routes.
 */
export default function removeFixtureArtifacts(): () => void {
  return () =>
    rmSync(fileURLToPath(new URL("./fixtures/notes/.keel", import.meta.url)), { recursive: true, force: true });
}
