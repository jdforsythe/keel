import type { Ctx } from "@keel/ctx";
import type { IdentityMount, RouteTable } from "@keel/router";
import type { Store } from "@keel/store";
import type { DocumentApp } from "./DocumentApp.ts";
import type { HarnessArtifacts } from "./HarnessArtifacts.ts";
import type { RoutesImport } from "./RoutesImport.ts";

/**
 * Options of `renderRoute`: the route table (k.routes: a manifest or `routeTable`), the target's params and search (or `url`, a raw path and query parsed as
 * a navigation parses it, in their place), seeded state, ctx, artifacts, and the `caller` id and `user` (k.user) guards,
 * loaders and actions receive (each default `""`: anonymous, no one).
 */
export interface RouteRenderOptions<T extends RouteTable = RouteTable> {
  /**
   * The route table, or with `app` an import of the module that exports it (`RoutesImport`): the page then resumes in
   * a client module graph of its own (as `resumeDocument`), so its client stores, widget state and islands are this
   * harness's alone; without `app` an import rejects with E1722.
   */
  readonly routes: T | RoutesImport<T>;
  readonly params?: Readonly<Record<string, unknown>>;
  readonly search?: Readonly<Record<string, unknown>>;
  readonly url?: string;
  readonly state?: readonly (readonly [Store<unknown>, unknown])[];
  readonly ctx?: Ctx;
  /** `undefined` is the same as absent (`""`), so an optional value passes through. */
  readonly caller?: string | undefined;
  /** `undefined` is the same as absent: no one, and with `mount` the router reads `user`. */
  readonly user?: string | undefined;
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
  /**
   * The `createApp` result of the `node` deployable that serves the page: the page is then requested from it and
   * resumed, as a build serves it, with no router (k.testing Harness); with `state`, `shell` or `mount` it rejects E1722.
   */
  readonly app?: DocumentApp;
  /**
   * The identity mount, `identity.ts`'s default export imported by the test (k.guards Client): the router reads `user`
   * from `/__keel/user` with it (unless `user` is given) and matches no page under its `path` (k.mount-scope), and a
   * shell sends mount requests under it (k.return). Without it the harness has none, as a project with no `identity.ts`.
   */
  readonly mount?: IdentityMount;
}
