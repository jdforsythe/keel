import type { Topology } from "@keel/compiler";
import type { KeyValueStorage } from "@keel/ctx";
import type { Manifest, RouteDef } from "@keel/router";
import type { Identity } from "./Identity.ts";
import type { Runner } from "./Runner.ts";

/**
 * What the generated entry of a `node` deployable hands `start` (k.topology Build): the app's topology, the served
 * deployable, its modules' route manifests and runners, and `dir`, the entry's own folder `dist/<name>/` (client
 * build, `routes.json`, `std.json`); `open`, for a `'sqlite'` or `'postgres'` deployable, its `@keel/std-db` driver
 * (k.deploy Storage), which `start` opens on `KEEL_DATABASE_URL` before listening and closes after `close()`;
 * `identity`, the project's `identity.server.ts` default export when it exists (k.user).
 */
export type StartOptions = {
  readonly topology: Topology;
  readonly deployable: string;
  readonly routes: readonly Manifest<Readonly<Record<string, RouteDef>>>[];
  readonly runners: Readonly<Record<string, readonly Runner[]>>;
  readonly dir: string;
  readonly identity?: Identity;
  readonly open?: (url: URL) => Promise<KeyValueStorage & { close?(): Promise<void> }>;
};
