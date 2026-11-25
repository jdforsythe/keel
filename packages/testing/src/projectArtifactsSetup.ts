// The setup `keel test` runs before each test file (`@keel/testing/setup`; tooling's vitest config adds it in an app
// too): under `KEEL_TEST=1` it reads the project's `.keel/a11y.json` and `tokens.ts` in the working directory once for
// the file, the artifacts a harness render given no `artifacts` checks with (k.a11y Artifacts).
import { loadProjectArtifacts } from "./internal/loadProjectArtifacts.ts";
import { loadedArtifacts } from "./internal/loadedArtifacts.ts";

if (process.env.KEEL_TEST === "1") loadedArtifacts.current = await loadProjectArtifacts(process.cwd());
