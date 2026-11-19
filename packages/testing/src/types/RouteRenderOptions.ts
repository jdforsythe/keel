import type { Ctx } from "@keel/ctx";
import type { Manifest, RouteDef } from "@keel/router";
import type { Store } from "@keel/store";
import type { HarnessArtifacts } from "./HarnessArtifacts.ts";

/**
 * Options of `renderRoute`: the route table, the target's params and search (or `url`, a raw path and query parsed as
 * a navigation parses it, in their place), seeded state, ctx, artifacts, and the `caller` id and `user` (k.user) guards,
 * loaders and actions receive (each default `""`: anonymous, no one).
 */
export interface RouteRenderOptions<M extends Readonly<Record<string, RouteDef>>> {
  readonly routes: Manifest<M>;
  readonly params?: Readonly<Record<string, unknown>>;
  readonly search?: Readonly<Record<string, unknown>>;
  readonly url?: string;
  readonly state?: readonly (readonly [Store<unknown>, unknown])[];
  readonly ctx?: Ctx;
  readonly caller?: string;
  readonly user?: string;
  readonly artifacts?: HarnessArtifacts;
  /**
   * Run the page as in a native shell (k.return Testing), which gives it a ctx of `mode: 'shell'` in a build; `id` is
   * the shell's `id` (k.shell), the scheme of its return links, and `true` stands for `dev.keel.golden2`.
   */
  readonly shell?: true | { readonly id: string };
  /**
   * With `shell`, `'later'` reports no launch until the handle's `launch(links)` (k.links Testing); left out, the shell
   * reports a launch with no link before the first render.
   */
  readonly launch?: "later";
}
