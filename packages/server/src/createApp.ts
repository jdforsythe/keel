import { INSPECT_PATH } from "@keel/compiler/inspect/INSPECT_PATH";
import { bindStd } from "@keel/compiler/std/bindStd";
import { scope } from "@keel/reactive";
import { manifest } from "@keel/router";
import { compileRoutes, compileTable, matchUrl } from "@keel/router/internal";
import { attempt } from "@keel/schema";
import { isolate } from "@keel/store";
import { Hono } from "hono";
import { DEFAULT_MAX_BODY } from "./internal/DEFAULT_MAX_BODY.ts";
import type { Served } from "./internal/Served.ts";
import { bindModules } from "./internal/bindModules.ts";
import { callerOf } from "./internal/callerOf.ts";
import { callerSigner } from "./internal/callerSigner.ts";
import { codedError } from "./internal/codedError.ts";
import { crashed } from "./internal/crashed.ts";
import { denied } from "./internal/denied.ts";
import { diagLine } from "./internal/diagLine.ts";
import { installServerDom } from "./internal/dom/installServerDom.ts";
import { forward } from "./internal/forward.ts";
import { handle } from "./internal/handle.ts";
import { inspectAllowed } from "./internal/inspectAllowed.ts";
import { inspectResponse } from "./internal/inspectResponse.ts";
import { keepRunning } from "./internal/keepRunning.ts";
import { loadAssets } from "./internal/loadAssets.ts";
import { loadStd } from "./internal/loadStd.ts";
import { moduleOf } from "./internal/moduleOf.ts";
import { nodeEnv } from "./internal/nodeEnv.ts";
import { peerOf } from "./internal/peerOf.ts";
import { peerPaths } from "./internal/peerPaths.ts";
import { reqLine } from "./internal/reqLine.ts";
import { selectDeployable } from "./internal/selectDeployable.ts";
import type { AppOptions } from "./types/AppOptions.ts";
import type { ServerApp } from "./types/ServerApp.ts";

/**
 * Build one deployable of `topology` over Hono (k.server; generated server entry and `keel dev` only).
 * Rejects with an Error whose message starts with E1552 (the served deployable names a module no route belongs to,
 * or a module is in two deployables) or E1553 (a `static` deployable has a route with params or actions).
 * Each request follows the k.server Request flow and writes one `req` record (after any `diag`) to `log`.
 * Each request runs in its own isolated scope (k.store `isolate`): stores created in it register in its own registry,
 * appear in `#k-state` and are disposed after the response. `mode` defaults to `production` (RFC 0022).
 * With no DOM global (plain Node) it installs the DOM-free server tree (`installServerDom`) so components that build
 * DOM render documents. A JSON or FormData action body over `maxBodyBytes` (default 1 MiB) gets 413 `keel.payloadTooLarge`.
 * In `dev` mode `GET /__keel/inspect` returns the inspect document (k.cli Inspect) before the route table and before
 * any request scope (its `graph` holds the app's scopes only; inspector section E1057s go to `log`), to a loopback
 * or listed host and an absent (GET only), same, or listed (`inspect.origins`) `Origin` only; others, and any other
 * method without an allowed `Origin`, get 403 `keel.denied`.
 * Each request has a caller (a caller cookie signed under `secret`, else one minted and set HttpOnly/SameSite=Lax on
 * a write, else `""`; `__Host-keel-caller` and Secure when `secure`, else when the request is https by URL or
 * `x-forwarded-proto`, RFC 0057, 0060) and its own
 * instance of each `stores` factory its loaders and action name, restored from and saved to `ctx.storage` through the
 * deployable's in-process copy (k.server Server state, RFC 0044).
 * In production, `assets` (the deployable's `keel build` output) is read once here: documents load its built entry and
 * its files are served nosniff, immutable only when the manifest names them hashed, never through a symlink out of
 * `assets/` (RFC 0057); a missing or entry-less manifest rejects with E1555 (k.server Build, RFC 0048).
 * A production `createApp` without `assets` also rejects with E1555 unless `NODE_ENV` (trimmed, any case) is
 * `development` or `test`; unset counts as production (RFC 0052). Without a build its island documents would load
 * `/@keel/entry.ts`, whose bare `@keel/*` imports only Vite resolves. Whether a page has islands is known only when it
 * renders, so this holds for every deployable. Dev mode, and tests (vitest sets `NODE_ENV=test`), keep serving it.
 * A `secret` under 32 bytes (UTF-8) rejects with E1556; under that same production gate, no `secret` writes one W1556
 * `diag` to `log` at startup, since each instance then signs callers with its own random key (RFC 0057, backlog 0159),
 * and no `secure` writes one W1557: https is then the request's URL or `x-forwarded-proto: https` (RFC 0060).
 * Every document's head carries the deployable's name as `<title>` and links the build's entry CSS and `/keel-mark.svg`
 * icon (`headHtml`, k.server Document).
 * `std` (a `.keel/std.json`) is read once and bound to `ctx` for `stdConfig`: missing, malformed or hand-edited
 * rejects with E1160, a value failing its package's registered schema with E1158 (k.module Std config, rfc:0066).
 * After startup each `runners` entry of the served deployable's modules runs once on `ctx` (`keepRunning`: a rejection is
 * a `diag` and a rerun 1,000 ms later on `ctx.clock`); `close()` aborts their signal and open event streams and
 * resolves when every `run` has settled. `ctx` is bound for `service({ module })` (`bindModules`). A request whose path
 * no route here matches but a peer serves (by `routes.json` in `artifacts`) is forwarded to it unless it carries
 * `x-keel-forwarded` (k.topology Calls and peers; `forward`), and logs its `req` record like a served one. `origin`
 * replaces the request's origin in `url`, the same-site check and `Secure`; with it, no W1557.
 */
export async function createApp(opts: AppOptions): Promise<ServerApp> {
  installServerDom();
  const routes = (opts.routes ?? manifest({})).routes;
  const table = compileTable(compileRoutes(routes), routes);
  const runners = opts.runners ?? {};
  const modules = new Set([...Object.keys(routes).map(moduleOf), ...Object.keys(runners)]);
  const origin = opts.origin === undefined ? undefined : new URL(opts.origin).origin;
  const mode = opts.mode ?? "production";
  const env = nodeEnv();
  const deployed = mode === "production" && env !== "development" && env !== "test";
  if (deployed && opts.assets === undefined)
    throw codedError(
      "E1555",
      "assets: a production server needs its client build; run `keel build` and pass createApp({ assets: 'dist/<deployable>' })",
    );
  // RFC 0057 amendment (backlog 0159): a short key makes the caller HMAC guessable, `""` public.
  if (opts.secret !== undefined && new TextEncoder().encode(opts.secret).length < 32)
    throw codedError(
      "E1556",
      "secret: createApp({ secret }) needs at least 32 bytes; pass 32+ random bytes from the env",
    );
  if (opts.std !== undefined) bindStd(opts.ctx, await loadStd(opts.std));
  const log = opts.log;
  if (deployed && opts.secret === undefined)
    log?.write(
      diagLine(log.format, {
        code: "W1556",
        message: "secret: none given, so callers reset on restart and differ per instance; pass createApp({ secret })",
      }),
    );
  // RFC 0060 (backlog 0160): unset, a plain-http hop without x-forwarded-proto gets an unprefixed, non-Secure cookie.
  if (deployed && opts.secure === undefined && origin === undefined)
    log?.write(
      diagLine(log.format, {
        code: "W1557",
        message:
          "secure: not set, so the caller cookie is Secure only on https or x-forwarded-proto https; pass createApp({ secure: true })",
      }),
    );
  const served = selectDeployable(opts.topology, table, modules, opts.deployable);
  const built = mode === "production" && opts.assets !== undefined ? await loadAssets(opts.assets) : undefined;
  const sv: Served = {
    table: served,
    ctx: opts.ctx,
    mode,
    routes: opts.routes ?? manifest({}),
    maxBody: opts.maxBodyBytes ?? DEFAULT_MAX_BODY,
    inspectOrigins: opts.inspect?.origins ?? [],
    saved: new Map(),
    saving: new Map(),
    keys: await callerSigner(opts.secret),
    secure: opts.secure,
    built,
    name: opts.deployable ?? Object.keys(opts.topology)[0] ?? "",
    origin,
    lifecycle: new AbortController(),
  };
  const peers = opts.peers ?? {};
  const forwards = await peerPaths(opts.artifacts, opts.topology, Object.keys(peers));
  const hono = new Hono();
  hono.all("*", async (c) => {
    const raw = c.req.raw;
    const t0 = sv.ctx.clock.now();
    const path = new URL(raw.url).pathname;
    const inspecting = sv.mode === "dev" && path === INSPECT_PATH;
    const peer = inspecting || raw.headers.has("x-keel-forwarded") ? undefined : peerOf(forwards, path);
    const at = peer === undefined || matchUrl(served, path).route !== null ? undefined : peers[peer];
    const gate = inspecting ? inspectAllowed(raw, sv.inspectOrigins) : undefined;
    // Inspect is answered before any request scope exists, so its graph is the app's alone (RFC 0042).
    const routed = async () => {
      const rq = {
        scope: scope(() => undefined),
        caller: callerOf(raw, sv.ctx, sv.keys, sv.secure, sv.origin),
        held: new Map(),
      };
      isolate(rq.scope);
      const r = await attempt(() => handle(sv, raw, rq, c));
      rq.scope.dispose();
      return r;
    };
    const ran =
      at !== undefined
        ? await attempt(() => forward(raw, at, sv))
        : gate === undefined || (gate.ok && raw.method !== "GET")
          ? await routed()
          : await attempt(() =>
              (gate.ok
                ? inspectResponse(opts.artifacts, gate.allow, sv.ctx)
                : Promise.resolve({ response: denied("inspect origin refused"), diags: [] })
              ).then((r) => ({ ...r, route: undefined })),
            );
    const h = ran.ok ? ran.value : crashed(sv.mode, ran.error);
    if (log !== undefined) {
      for (const d of h.diags) log.write(diagLine(log.format, d));
      const ms = Math.max(0, Math.round(sv.ctx.clock.now() - t0));
      log.write(reqLine(log.format, { method: raw.method, path, route: h.route, status: h.response.status, ms }));
    }
    return h.response;
  });
  const failed = (message: string) =>
    log?.write(
      diagLine(log.format, { code: "keel.unexpected", message: `runner rejected, rerun in 1000 ms: ${message}` }),
    );
  const app: ServerApp = {
    fetch: async (req) => hono.fetch(req),
    close: async () => {
      sv.lifecycle.abort();
      unbind();
      await Promise.all(await running);
    },
  };
  const unbind = bindModules(sv.ctx, opts.topology, sv.name, app, peers);
  const own = opts.topology[sv.name]?.modules ?? [];
  const running = Promise.resolve().then(() =>
    own.flatMap((m) => runners[m] ?? []).map((r) => keepRunning(r, sv.ctx, sv.lifecycle.signal, failed)),
  );
  return app;
}
