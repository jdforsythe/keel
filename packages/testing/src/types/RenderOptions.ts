import type { Ctx } from "@keel/ctx";
import type { Store } from "@keel/store";
import type { HarnessArtifacts } from "./HarnessArtifacts.ts";

/**
 * Options of `render`: `props` and every `[store, value]` in `state` are parsed by their schemas first.
 * `artifacts` (the compiler's `.keel/` data, passed by `keel test`) enables the `a11y.json` check (E1702), and its `tokens` the render contrast check (E1804).
 */
export interface RenderOptions {
  readonly props: unknown;
  readonly state?: readonly (readonly [Store<unknown>, unknown])[];
  readonly ctx?: Ctx;
  readonly artifacts?: HarnessArtifacts;
}
