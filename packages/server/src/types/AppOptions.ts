import type { Ctx } from "@keel/ctx";
import type { Guard, Manifest, RouteDef } from "@keel/router";
import type { Store } from "@keel/store";
import type { LogSink } from "./LogSink.ts";
import type { Topology } from "./Topology.ts";

/**
 * Options of `createApp` (generated server entry and `keel dev` only; app code sees only `topology`).
 * `routes` is the union manifest of the deployable's modules. `deployable` names the topology entry to
 * serve (required when there is more than one). `guards` registers guards that route `guard` names resolve to
 * (then the router registry). `expose` lists module-level stores whose state goes in `#k-state` as
 * `{ state, log: [], initial: state }`; `{ store, log: true }` sends the whole snapshot (RFC 0022). `mode` defaults to
 * `production`. `artifacts` is the compiler's `.keel` directory; in dev, `GET /__keel/inspect` reads `ids`, `a11y`,
 * and `routes` from it (k.cli Inspect). `inspect.origins` lists the origins (`:*` for any port) besides the request's
 * own whose reads of it are answered (default none). `maxBodyBytes` caps a JSON or FormData action body (default
 * 1048576); a larger one is refused with 413 `keel.payloadTooLarge` before it is parsed.
 */
export type AppOptions = {
  readonly topology: Topology;
  readonly routes: Manifest<Readonly<Record<string, RouteDef>>>;
  readonly ctx: Ctx;
  readonly mode?: "dev" | "production";
  readonly deployable?: string;
  readonly guards?: readonly Guard[];
  readonly expose?: readonly (
    | Pick<Store<unknown>, "id">
    | { readonly store: Pick<Store<unknown>, "id">; readonly log?: boolean }
  )[];
  readonly inspect?: { readonly origins?: readonly string[] };
  readonly maxBodyBytes?: number;
  readonly log?: LogSink;
  readonly artifacts?: string;
};
