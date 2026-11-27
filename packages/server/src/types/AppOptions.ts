import type { Origins, Topology } from "@keel/compiler";
import type { Ctx } from "@keel/ctx";
import type { RouteTable } from "@keel/router";
import type { Identity } from "./Identity.ts";
import type { LogSink } from "./LogSink.ts";
import type { Runner } from "./Runner.ts";
import type { ServerApp } from "./ServerApp.ts";

/**
 * Options of `createApp` (generated server entry and `keel dev` only; app code sees only `topology`).
 * `routes` is the deployable's route table (k.routes): `routeTable` of its modules' manifests, or one manifest. `deployable` names the topology entry to
 * serve (required when there is more than one); guards are the values routes hold in `guard` (RFC 0041). `mode` defaults to `production`. `artifacts` is the compiler's `.keel` directory; in dev, `GET /__keel/inspect` reads `ids`, `a11y`,
 * and `routes` from it (k.inspect). A throw's log `frames` are relative to the folder holding `artifacts`, a
 * `<artifacts>/server.mjs` position read through `server.mjs.map`; without `artifacts` a throw has no frames. `inspect.origins` lists the origins (`:*` for any port) besides the request's
 * own whose reads of it are answered (default none). `maxBodyBytes` caps a JSON or FormData action body (default
 * 1048576); a larger one is refused with 413 `keel.payloadTooLarge` before it is parsed. `assets` is the deployable's
 * `keel build` output (`dist/<deployable>`): in production its manifest is read at startup (missing, or no `assets`
 * unless `NODE_ENV` is `development` or `test`: E1555, RFC 0052), documents
 * load its built entry, and its files are served `nosniff`, `immutable` when the manifest names them with a content hash
 * and `no-cache` otherwise; dev ignores it (k.server Build, RFC 0048, 0057). `secret` keys the HMAC that signs caller
 * cookies (k.server Server state, RFC 0057): a cookie without a valid signature is not a caller. It defaults to 32
 * random bytes per `createApp`, so callers reset on restart; production sets a stable secret (32+ random bytes) shared
 * by every instance. A secret under 32 UTF-8 bytes rejects with E1556; a deployed production start without one writes
 * a W1556 `diag` to `log`. `secure` says the app is served over https (true behind a TLS-terminating proxy); it defaults to
 * the request URL's scheme. When secure, the caller cookie is `__Host-keel-caller` with `Secure`, else `keel-caller`.
 * `std` is the path of the build's `.keel/std.json`, read at startup and bound to `ctx`, where stdlib packages read
 * their modules' config with `stdConfig(ctx, pkg, Config)` (k.module Std config, rfc:0066).
 * `routes` defaults to none (a deployable of runners alone). `runners` lists each module's `Runner`s; those of the
 * served deployable's modules run once after startup (k.topology Runners). `peers` names the other `node` deployables,
 * by URL or as apps in this process: service client calls and requests for the paths they serve (by `routes.json`
 * in `artifacts`) go to them (k.topology Calls and peers). `origin` is the public origin, which replaces the request's in
 * `url`, the same-site check and `Secure` (k.topology Build). `allow` lists the http(s) origins whose requests to API
 * routes are granted (k.hosting Allowed origins): matched exactly by scheme, host and port; an entry that is not an
 * http(s) origin rejects with E1560 naming its index. With any entry, every API-route response carries `vary: origin`.
 * `maxStreams`, a positive integer (default 1000), caps the event streams open at once: one more is 503 `keel.busy`
 * with `data: { limit }` and runs no loader; a stream frees its place when it ends for any reason.
 * `identity` is the project's identity source (k.user): `identify` answers each routed request's `user`, `handle` mounts
 * a library's endpoints; a `handle.path` not of lowercase `/` segments, or with a route at or under it, rejects with E1579.
 * `origins` is every deployable's declaration as the static read of `topology.ts` accepted it (k.origins); the
 * generated entries pass it, and it replaces each deployable's runtime `origins`, so no policy holds an origin the read
 * did not see (without it, as in a test, the topology's own). A `frame` origin of the served deployable, or of the
 * `client` it hosts, equal to `origin` or a URL peer's origin rejects with E1590.
 */
export type AppOptions = {
  readonly topology: Topology;
  readonly routes?: RouteTable;
  readonly ctx: Ctx;
  readonly mode?: "dev" | "production";
  readonly deployable?: string;
  readonly inspect?: { readonly origins?: readonly string[] };
  readonly maxBodyBytes?: number;
  readonly log?: LogSink;
  readonly artifacts?: string;
  readonly assets?: string;
  readonly secret?: string;
  readonly secure?: boolean;
  readonly std?: string;
  readonly runners?: Readonly<Record<string, readonly Runner[]>>;
  readonly peers?: Readonly<Record<string, string | URL | ServerApp>>;
  readonly origin?: string;
  readonly allow?: readonly string[];
  readonly maxStreams?: number;
  readonly identity?: Identity | undefined;
  readonly origins?: Readonly<Record<string, Origins>>;
};
