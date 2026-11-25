import type { Artifacts } from "@keel/compiler";
import type { Tokens } from "@keel/ui";

/**
 * What a harness render checks with (k.a11y Artifacts): the compiler's `a11y.json` enables E1702, `tokens` the render
 * contrast and reversed-order checks (E1804, E1820); absent, that check does not run. Under `keel test` a render given
 * none takes the project's `.keel/a11y.json` and `tokens.ts` `tokens`; given these, it takes these alone (`{}`: none).
 */
export interface HarnessArtifacts {
  readonly "a11y.json"?: Artifacts["a11y.json"];
  readonly tokens?: Tokens;
}
