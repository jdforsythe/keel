import type { Topology } from "@keel/compiler";
import type { Ctx } from "@keel/ctx";
import type { Manifest, RouteDef } from "@keel/router";
import type { LogSink } from "./LogSink.ts";

/**
 * Options of `createApp` (generated server entry and `keel dev` only; app code sees only `topology`).
 * `routes` is the union manifest of the deployable's modules. `deployable` names the topology entry to
 * serve (required when there is more than one); guards are the values routes hold in `guard` (RFC 0041). `mode` defaults to `production`. `artifacts` is the compiler's `.keel` directory; in dev, `GET /__keel/inspect` reads `ids`, `a11y`,
 * and `routes` from it (k.cli Inspect). `inspect.origins` lists the origins (`:*` for any port) besides the request's
 * own whose reads of it are answered (default none). `maxBodyBytes` caps a JSON or FormData action body (default
 * 1048576); a larger one is refused with 413 `keel.payloadTooLarge` before it is parsed. `assets` is the deployable's
 * `keel build` output (`dist/<deployable>`): in production its manifest is read at startup (missing: E1555), documents
 * load its built entry, and its files are served immutable; dev ignores it (k.server Build, RFC 0048).
 */
export type AppOptions = {
  readonly topology: Topology;
  readonly routes: Manifest<Readonly<Record<string, RouteDef>>>;
  readonly ctx: Ctx;
  readonly mode?: "dev" | "production";
  readonly deployable?: string;
  readonly inspect?: { readonly origins?: readonly string[] };
  readonly maxBodyBytes?: number;
  readonly log?: LogSink;
  readonly artifacts?: string;
  readonly assets?: string;
};
