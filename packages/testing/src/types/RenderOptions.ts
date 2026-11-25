import type { Ctx } from "@keel/ctx";
import type { Store } from "@keel/store";
import type { HarnessArtifacts } from "./HarnessArtifacts.ts";

/**
 * Options of `render`: `props` and every `[store, value]` in `state` are parsed by their schemas first. `render` types
 * `props` as `RenderProps` of its component, so a missing callback or slot prop is a type error.
 * `artifacts` (the compiler's `.keel/` data, passed by `keel test`) enables the `a11y.json` check (E1702), and its `tokens` the render contrast check (E1804).
 */
export interface RenderOptions<Given = unknown> {
  readonly props: Given;
  readonly state?: readonly (readonly [Store<unknown>, unknown])[];
  readonly ctx?: Ctx;
  readonly artifacts?: HarnessArtifacts;
}
