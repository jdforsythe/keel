import type { Ctx } from "@keel/ctx";
import type { Located, Manifest, RouteDef } from "@keel/router";
import type { LogEntry } from "@keel/store";
import type { Mode } from "./Mode.ts";

/**
 * A built deployable: its routes, `ctx`, mode, its manifest (guard redirects resolve in it, RFC 0041), the stores exposed to `#k-state` (id to whether their
 * log goes too), the action body cap in bytes, the extra origins the dev inspect endpoint answers, and the caller
 * token each module-store log entry was committed under (`tagSince`, finding 0082).
 */
export type Served = {
  readonly table: readonly Located[];
  readonly ctx: Ctx;
  readonly mode: Mode;
  readonly routes: Manifest<Readonly<Record<string, RouteDef>>>;
  readonly expose: ReadonlyMap<string, boolean>;
  readonly maxBody: number;
  readonly inspectOrigins: readonly string[];
  readonly tags: WeakMap<LogEntry, string>;
};
