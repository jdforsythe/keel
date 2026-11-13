import type { Ctx } from "@keel/ctx";
import type { Manifest, RouteDef } from "@keel/router";
import type { Located } from "@keel/router/internal";
import type { BuiltClient } from "./BuiltClient.ts";
import type { CallerKeys } from "./CallerKeys.ts";
import type { Mode } from "./Mode.ts";
import type { ReportWindow } from "./ReportWindow.ts";

/**
 * A built deployable: its routes, `ctx`, mode, its manifest (guard redirects resolve in it, RFC 0041), the action body cap in bytes, the extra origins the dev
 * inspect endpoint answers, `keys`, the caller-cookie keys (`callerSigner`), and
 * `secure`, `createApp({ secure })` (undefined: each request URL's scheme decides, RFC 0057). `built` is the production client build
 * (`createApp({ assets })`, k.server Build), undefined in dev or without `assets`. `name` is the served deployable's name, the
 * document title's fallback (k.head). `origin` is the public origin (`createApp({ origin })`, k.topology Build).
 * `allow` is the set of allowed origins, serialized (`createApp({ allow })`, k.hosting).
 * `entry` is the script an island document loads: `built`'s entry, else `/@keel/entry.ts?d=<deployable>`, the resume
 * entry of `createApp({ deployable })`'s islands (none given: `/@keel/entry.ts`, every `node` module's).
 * `lifecycle` aborts on `close()`, ending runners and open event streams. `maxStreams` caps the open event streams
 * (`createApp({ maxStreams })`) and `streams.open` counts them (`liveStream`). `reports` is the CSP report window
 * (`cspReport`).
 */
export type Served = {
  readonly table: readonly Located[];
  readonly ctx: Ctx;
  readonly mode: Mode;
  readonly routes: Manifest<Readonly<Record<string, RouteDef>>>;
  readonly maxBody: number;
  readonly inspectOrigins: readonly string[];
  readonly keys: CallerKeys;
  readonly secure: boolean | undefined;
  readonly built: BuiltClient | undefined;
  readonly entry: string;
  readonly name: string;
  readonly origin: string | undefined;
  readonly allow: ReadonlySet<string>;
  readonly lifecycle: AbortController;
  readonly maxStreams: number;
  readonly streams: { open: number };
  readonly reports: ReportWindow;
};
