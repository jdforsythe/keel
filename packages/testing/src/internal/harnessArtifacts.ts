import type { HarnessArtifacts } from "../types/HarnessArtifacts.ts";
import { fail } from "./fail.ts";
import { loadedArtifacts } from "./loadedArtifacts.ts";

/**
 * The artifacts a harness render checks with (k.a11y Artifacts): `given` alone when given (`{}` is none); else, under
 * `keel test` (`KEEL_TEST=1`), the project's as its setup read them (`projectArtifactsSetup.ts`), and E1807 naming
 * `tokens.ts` when that file is unusable; else none.
 */
export function harnessArtifacts(given: HarnessArtifacts | undefined): HarnessArtifacts | undefined {
  if (given !== undefined) return given;
  const found = loadedArtifacts.current;
  if (process.env.KEEL_TEST !== "1" || found === undefined) return undefined;
  if (!found.ok) throw fail("E1807", found.reason, { file: "tokens.ts" });
  return found.artifacts;
}
