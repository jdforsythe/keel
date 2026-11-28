import type { Origins } from "@keel/compiler";
import type { Ctx } from "@keel/ctx";
import type { RouteTable } from "@keel/router";
import type { Located, Table } from "@keel/router/internal";
import type { Identity } from "../types/Identity.ts";
import type { LogSink } from "../types/LogSink.ts";
import type { BuiltClient } from "./BuiltClient.ts";
import type { CallerKeys } from "./CallerKeys.ts";
import type { Mode } from "./Mode.ts";
import type { ReportWindow } from "./ReportWindow.ts";
import type { ThrownRecords } from "./ThrownRecords.ts";

/**
 * A built deployable: its served routes (`table`), `ctx`, mode, its route table `routes` and every route of it by id
 * (`byId`; guard redirects resolve in it), the action body cap in bytes, the extra origins the dev
 * inspect endpoint answers, `keys`, the caller-cookie keys (`callerSigner`), and
 * `secure`, `createApp({ secure })` (undefined: each request URL's scheme decides). `built` is the production client build
 * (`createApp({ assets })`, k.server Build), undefined in dev or without `assets`. `name` is the served deployable's name, the
 * document title's fallback (k.head). `origin` is the public origin (`createApp({ origin })`, k.topology Build).
 * `allow` is the set of allowed origins, serialized (`createApp({ allow })`, k.hosting).
 * `entry` is the script an island document loads: `built`'s entry, else `/@keel/entry.ts?d=<deployable>`, the resume
 * entry of `createApp({ deployable })`'s islands (none given: `/@keel/entry.ts`, every `node` module's).
 * `css` is the stylesheets every document links (k.head Server): `built`'s, else in dev `/@keel/styles.css?d=<deployable>`
 * (the deployable's `styles` and the atomic CSS, served by the compiler's dev server), else none.
 * `lifecycle` aborts on `close()`, ending runners and open event streams. `maxStreams` caps the open event streams
 * (`createApp({ maxStreams })`) and `streams.open` counts them (`liveStream`). `reports` is the CSP report window
 * (`cspReport`). `frames` reads a throw's app frames (`appFrames` of `createApp({ artifacts })`), and `thrown` makes a
 * thrown value's records (`thrownLog`: its form, and its text under `mode: 'dev'` or `KEEL_LOG_THROWN`). `log` is
 * `createApp({ log })`, for records written after the response has started (an event stream's). `eager` holds the
 * route ids that have logged E1257 (k.claim Server), once each, and `nothing` those that have logged E1406 (k.place).
 * `identity` is `createApp({ identity })` (k.user) and `days` the served deployable's `caller: { days }`; `origins` its
 * declared origins (k.origins), which its documents' policy admits, less the document's own origin under `frame`;
 * `framed` holds each own origin a dev document has left out of `frame-src` and logged as E1590, once each.
 */
export type Served = {
  readonly table: readonly Located[];
  readonly ctx: Ctx;
  readonly mode: Mode;
  readonly routes: RouteTable;
  readonly byId: Table;
  readonly maxBody: number;
  readonly inspectOrigins: readonly string[];
  readonly keys: CallerKeys;
  readonly secure: boolean | undefined;
  readonly built: BuiltClient | undefined;
  readonly entry: string;
  readonly css: readonly string[];
  readonly name: string;
  readonly origin: string | undefined;
  readonly allow: ReadonlySet<string>;
  readonly lifecycle: AbortController;
  readonly maxStreams: number;
  readonly streams: { open: number };
  readonly eager: Set<string>;
  readonly nothing: Set<string>;
  readonly reports: ReportWindow;
  readonly frames: (thrown: unknown) => readonly string[];
  readonly thrown: ThrownRecords;
  readonly log?: LogSink;
  readonly identity?: Identity | undefined;
  readonly days?: number | undefined;
  readonly origins?: Origins | undefined;
  readonly framed?: Set<string>;
  /** Whether the app has both color schemes (`schemes.json`, k.schemes): documents then follow `keel-scheme`. */
  readonly schemes?: boolean;
  /** The app's `choice` themes (`schemes.json`, k.schemes): documents then follow `keel-theme` when it names one. */
  readonly themes?: readonly string[];
};
