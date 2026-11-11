import type { Topology } from "@keel/compiler";
import type { Ctx } from "@keel/ctx";
import type { Manifest, RouteDef } from "@keel/router";
import type { LogSink } from "./LogSink.ts";
import type { Runner } from "./Runner.ts";
import type { ServerApp } from "./ServerApp.ts";

/**
 * Options of `createApp` (generated server entry and `keel dev` only; app code sees only `topology`).
 * `routes` is the union manifest of the deployable's modules. `deployable` names the topology entry to
 * serve (required when there is more than one); guards are the values routes hold in `guard` (RFC 0041). `mode` defaults to `production`. `artifacts` is the compiler's `.keel` directory; in dev, `GET /__keel/inspect` reads `ids`, `a11y`,
 * and `routes` from it (k.cli Inspect). `inspect.origins` lists the origins (`:*` for any port) besides the request's
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
 * by URL or as apps in this process: `service({ module })` calls and requests for the paths they serve (by `routes.json`
 * in `artifacts`) go to them (k.topology Calls and peers). `origin` is the public origin, which replaces the request's in
 * `url`, the same-site check and `Secure` (k.topology Build). `allow` lists the http(s) origins whose requests to API
 * routes are granted (k.hosting Allowed origins): matched exactly by scheme, host and port; an entry that is not an
 * http(s) origin matches nothing.
 */
export type AppOptions = {
  readonly topology: Topology;
  readonly routes?: Manifest<Readonly<Record<string, RouteDef>>>;
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
};
