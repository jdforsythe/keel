// The setup `keel test` runs before each test file (`@keel/testing/setup`; tooling's vitest config adds it in an app
// too): under `KEEL_TEST=1` it takes the `a11y.json` derived from the tree that `keel test` provides (`keel.a11y`,
// k.derived Readers; outside `keel test`, `.keel/a11y.json`) and reads `tokens.ts` in the working directory once for
// the file: the artifacts a harness render given no `artifacts` checks with (k.a11y Artifacts).
import { inject } from "vitest";
import { loadProjectArtifacts } from "./internal/loadProjectArtifacts.ts";
import { loadedArtifacts } from "./internal/loadedArtifacts.ts";

declare module "vitest" {
  interface ProvidedContext {
    /** The bytes of the `a11y.json` `keel test` derived from the tree under test. */
    "keel.a11y"?: string;
  }
}

if (process.env.KEEL_TEST === "1")
  loadedArtifacts.current = await loadProjectArtifacts(process.cwd(), inject("keel.a11y"));
