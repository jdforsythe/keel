import type { Artifacts } from "@keel/compiler";
import type { Tokens } from "@keel/ui";

/**
 * What a harness reads from the project (passed by `keel test`): the compiler's `a11y.json` enables E1702, the
 * project's `tokens` the render contrast check (E1804); absent, that check does not run.
 */
export interface HarnessArtifacts {
  readonly "a11y.json"?: Artifacts["a11y.json"];
  readonly tokens?: Tokens;
}
