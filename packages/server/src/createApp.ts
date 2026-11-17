import { originOf } from "@keel/compiler/hosting/originOf";
import { INSPECT_PATH } from "@keel/compiler/inspect/INSPECT_PATH";
import { ENTRY_PATH } from "@keel/compiler/internal/entry/ENTRY_PATH";
import { bindStd } from "@keel/compiler/std/bindStd";
import { scope } from "@keel/reactive";
import { manifest } from "@keel/router";
import { compileRoutes, compileTable, matchUrl } from "@keel/router/internal";
import { isolate } from "@keel/store";
import { Hono } from "hono";
import { CSP_PATH } from "./internal/CSP_PATH.ts";
import { DEFAULT_MAX_BODY } from "./internal/DEFAULT_MAX_BODY.ts";
import { DEFAULT_MAX_STREAMS } from "./internal/DEFAULT_MAX_STREAMS.ts";
import type { Served } from "./internal/Served.ts";
import { allowOf } from "./internal/allowOf.ts";
import { appFrames } from "./internal/appFrames.ts";
import { attempted } from "./internal/attempted.ts";
import { bearerOf } from "./internal/bearerOf.ts";
import { bindModules } from "./internal/bindModules.ts";
import { callerOf } from "./internal/callerOf.ts";
import { callerSigner } from "./internal/callerSigner.ts";
import { codedError } from "./internal/codedError.ts";
import { crashed } from "./internal/crashed.ts";
import { cspReport } from "./internal/cspReport.ts";
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
import { noteRequestSecrets } from "./internal/noteRequestSecrets.ts";
import { peerOf } from "./internal/peerOf.ts";
import { peerPaths } from "./internal/peerPaths.ts";
import { redacted } from "./internal/redacted.ts";
import { reportSource } from "./internal/reportSource.ts";
import { reqLine } from "./internal/reqLine.ts";
import { requestSecrets } from "./internal/requestSecrets.ts";
import { scrubbedCause } from "./internal/scrubbedCause.ts";
import { scrubbedDiag } from "./internal/scrubbedDiag.ts";
import { secretSegments } from "./internal/secretSegments.ts";
import { secured } from "./internal/secured.ts";
import { selectDeployable } from "./internal/selectDeployable.ts";
import { unexpected } from "./internal/unexpected.ts";
import { withCors } from "./internal/withCors.ts";
import type { AppOptions } from "./types/AppOptions.ts";
import type { ServerApp } from "./types/ServerApp.ts";

/**
 * Build one deployable of `topology` over Hono (k.server; generated server entry and `keel dev` only).
 * Rejects with an Error whose message starts with E1552 (the served deployable names a module no route belongs to,
 * or a module is in two deployables) or E1553 (a `static` deployable has a route with params or actions) or E1511 (a `client` or
 * `static` deployable serves an API route, k.api).
 * Each request follows the k.server Request flow and writes one `req` record (after any `diag`) to `log`.
 * Each request runs in its own isolated scope (k.store `isolate`): stores created in it register in its own registry,
 * appear in `#k-state` and are disposed after the response. It also runs in its own `requestSecrets` set: each `Secret`
 * made while it runs (its input, `bearer`, a parse after an `await`) joins it (`noteRequestSecrets`), and its `diag`
 * records and its `req` path hold `[secret]` in each one's place, as each of its `.pii()` values is `[pii]` there;
 * each runner's `run` enters its own set (`keepRunning`) and its rejection's record is scrubbed with it. Past a scrub
 * cap a `diag` keeps the server's own prefix (`loader <id> threw: `) and is one mark after it (`scrubbedDiag`). `mode` defaults to `production`.
 * With no DOM global (plain Node) it installs the DOM-free server tree (`installServerDom`) so components that build
 * DOM render documents. A JSON or FormData action body over `maxBodyBytes` (default 1 MiB) gets 413 `keel.payloadTooLarge`.
 * In `dev` mode `GET /__keel/inspect` returns the inspect document (k.cli Inspect) before the route table and before
 * any request scope (its `graph` holds the app's scopes only; inspector section E1057s go to `log`), to a loopback
 * or listed host and an absent (GET only), same, or listed (`inspect.origins`) `Origin` only; others, and any other
 * method without an allowed `Origin`, get 403 `keel.denied`.
 * Each request has a caller (a caller cookie signed under `secret`, else one minted and set HttpOnly/SameSite=Lax on
 * a write, else `""`; `__Host-keel-caller` and Secure when `secure`, else when the request is https by URL or
 * `x-forwarded-proto`) and its own
 * instance of each `stores` factory its loaders and action name, restored from and saved to `ctx.storage` through the
 * deployable's in-process copy (k.server Server state).
 * In production, `assets` (the deployable's `keel build` output) is read once here: documents load its built entry and
 * its files are served nosniff, immutable only when the manifest names them hashed, never through a symlink out of
 * `assets/`; a missing or entry-less manifest rejects with E1555 (k.server Build).
 * A production `createApp` without `assets` also rejects with E1555 unless `NODE_ENV` (trimmed, any case) is
 * `development` or `test`; unset counts as production. Without a build its island documents would load
 * `/@keel/entry.ts`, whose bare `@keel/*` imports only Vite resolves. Whether a page has islands is known only when it
 * renders, so this holds for every deployable. Dev mode, and tests (vitest sets `NODE_ENV=test`), keep serving it:
 * a document scripts `/@keel/entry.ts?d=<deployable>`, the resume entry of `deployable`'s islands (none given:
 * `/@keel/entry.ts`).
 * A `secret` under 32 bytes (UTF-8) rejects with E1556; under that same production gate, no `secret` writes one W1556
 * `diag` to `log` at startup, since each instance then signs callers with its own random key,
 * and no `secure` writes one W1557: https is then the request's URL or `x-forwarded-proto: https`.
 * Every document's head carries the deployable's name as `<title>` and links the build's entry CSS and `/keel-mark.svg`
 * icon (`headHtml`, k.server Document).
 * `std` (a `.keel/std.json`) is read once and bound to `ctx` for `stdConfig`: missing, malformed or hand-edited
 * rejects with E1160, a value failing its package's registered schema with E1158 (k.module Std config).
 * After startup each `runners` entry of the served deployable's modules runs once on `ctx` (`keepRunning`: a rejection is
 * a `diag` and a rerun 1,000 ms later on `ctx.clock`); `close()` aborts their signal and open event streams and
 * resolves when every `run` has settled. `ctx` is bound for `service({ module })` (`bindModules`). A request whose path
 * no route here matches but a peer serves (by `routes.json` in `artifacts`) is forwarded to it unless it carries
 * `x-keel-forwarded` (k.topology Calls and peers; `forward`), and logs its `req` record like a served one. `origin`
 * replaces the request's origin in `url`, the same-site check and `Secure`; with it, no W1557. An `allow` entry that is
 * not an http(s) origin rejects with E1560 naming its index, never its value; with any entry, every API-route response
 * carries `vary: origin` (k.hosting Allowed origins). An API route's guards, loaders and actions get the request's
 * `bearer` (`bearerOf`, k.api Bearer), whose revealed text no `diag` holds; its response to a request carrying
 * `authorization` is `cache-control: no-store`. An event-stream GET past `maxStreams` (default 1,000) open streams
 * gets 503 `keel.busy` (`data: { limit }`) and runs no loader; a stream frees its place when it ends. A `maxStreams` that is
 * not an integer of at least 1 rejects with E1560.
 * Every response carries the k.security headers (`secured`); every document its own nonce policy (report-only in dev),
 * any other response `default-src 'none'; frame-ancestors 'none'`. `POST /__keel/csp` takes policy reports before any
 * write check or route (`cspReport`) and logs `csp` records.
 */
export async function createApp(opts: AppOptions): Promise<ServerApp> {
  installServerDom();
  noteRequestSecrets();
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
  // A short key makes the caller HMAC guessable, `""` public.
  if (opts.secret !== undefined && new TextEncoder().encode(opts.secret).length < 32)
    throw codedError(
      "E1556",
      "secret: createApp({ secret }) needs at least 32 bytes; pass 32+ random bytes from the env",
    );
  if (opts.maxStreams !== undefined && !(Number.isInteger(opts.maxStreams) && opts.maxStreams >= 1))
    throw codedError("E1560", "maxStreams: createApp({ maxStreams }) needs an integer of at least 1");
  if (opts.std !== undefined) bindStd(opts.ctx, await loadStd(opts.std));
  const log = opts.log;
  if (deployed && opts.secret === undefined)
    log?.write(
      diagLine(log.format, {
        code: "W1556",
        message: "secret: none given, so callers reset on restart and differ per instance; pass createApp({ secret })",
      }),
    );
  // Unset, a plain-http hop without x-forwarded-proto gets an unprefixed, non-Secure cookie.
  if (deployed && opts.secure === undefined && origin === undefined)
    log?.write(
      diagLine(log.format, {
        code: "W1557",
        message:
          "secure: not set, so the caller cookie is Secure only on https; set an https KEEL_ORIGIN or pass createApp({ secure: true })",
      }),
    );
  const served = selectDeployable(opts.topology, table, modules, opts.deployable);
  const marks = secretSegments(served);
  const name = opts.deployable ?? Object.keys(opts.topology)[0] ?? "";
  const hosted = Object.values(opts.topology).some((d) => d.adapter === "client" && d.host === name);
  const built = mode === "production" && opts.assets !== undefined ? await loadAssets(opts.assets, hosted) : undefined;
  const sv: Served = {
    table: served,
    ctx: opts.ctx,
    mode,
    routes: opts.routes ?? manifest({}),
    maxBody: opts.maxBodyBytes ?? DEFAULT_MAX_BODY,
    inspectOrigins: opts.inspect?.origins ?? [],
    keys: await callerSigner(opts.secret),
    secure: opts.secure,
    built,
    entry:
      built?.entry ??
      (opts.deployable === undefined ? ENTRY_PATH : `${ENTRY_PATH}?d=${encodeURIComponent(opts.deployable)}`),
    name,
    origin,
    allow: new Set(
      (opts.allow ?? []).map((o, i) => {
        const v = originOf(o);
        if (v === undefined) throw codedError("E1560", `allow[${i}] is not an http(s) origin`);
        return v;
      }),
    ),
    lifecycle: new AbortController(),
    maxStreams: opts.maxStreams ?? DEFAULT_MAX_STREAMS,
    streams: { open: 0 },
    reports: { open: false, logged: 0, dropped: 0, sources: new Map() },
    frames: appFrames(opts.artifacts, (message) =>
      log?.write(diagLine(log.format, { code: "keel.unexpected", message })),
    ),
    ...(log === undefined ? {} : { log }),
  };
  const peers = opts.peers ?? {};
  const forwards = await peerPaths(opts.artifacts, opts.topology, Object.keys(peers));
  const warned = new Set<string>();
  const hono = new Hono();
  // The last resort: a throw past every guard of the handler (the app's `log.write`, say) is a bare 500 and one fixed
  // `diag`; nothing of the thrown value is read, so none of it reaches a response, the log or stderr. Hono's own
  // handler prints an `Error` to stderr and rethrows anything else, so it is replaced and `fetch` never rejects.
  const lastResort = (): Response => {
    attempted(() => log?.write(diagLine(log.format, { code: "keel.unexpected", message: "request handler threw" })));
    return crashed(sv.mode, unexpected("request handler threw")).response;
  };
  hono.onError(lastResort);
  hono.all("*", async (c) => {
    const raw = c.req.raw;
    const t0 = sv.ctx.clock.now();
    const path = new URL(raw.url).pathname;
    const inspecting = sv.mode === "dev" && path === INSPECT_PATH;
    const peer = inspecting || raw.headers.has("x-keel-forwarded") ? undefined : peerOf(forwards, path);
    const matched = inspecting ? null : matchUrl(served, path).route;
    const at = peer === undefined || matched !== null ? undefined : peers[peer];
    const gate = inspecting ? inspectAllowed(raw, sv.inspectOrigins) : undefined;
    // An allowed origin (k.hosting): granted on API routes only, by exact match of its serialized origin.
    const from = raw.headers.get("origin") ?? "";
    const known = sv.allow.has(from);
    const hit = sv.allow.size > 0 ? matched : null;
    const api = hit?.def.api === true && known ? hit.def : undefined;
    const cross = known && raw.headers.get("sec-fetch-site") === "cross-site" && !warned.has(from);
    if (cross) warned.add(from);
    // Inspect is answered before any request scope exists, so its graph is the app's alone.
    // Each request runs in its own `requestSecrets` set: every `Secret` made while it runs joins it (k.privacy). The
    // sets outlive `routed` so the `req` path is scrubbed with them too.
    const secrets = new Set<string>();
    const pii = new Set<string>();
    const routed = () =>
      requestSecrets.run(secrets, async () => {
        // Only an API route reads `authorization` (k.api Bearer); the token is a `Secret` and the header is not kept.
        const rq = {
          scope: scope(() => undefined),
          caller: callerOf(raw, sv.ctx, sv.keys, sv.secure, sv.origin),
          bearer: matched?.def.api === true ? bearerOf(raw) : undefined,
          allowed: api !== undefined,
          held: new Map(),
          pii,
          secrets,
        };
        isolate(rq.scope);
        const r = await attempted(() => handle(sv, raw, rq, c));
        rq.scope.dispose();
        if (!r.ok) return r;
        const diags = r.value.diags.map((d) => scrubbedDiag(d, rq));
        return { ok: true as const, value: { ...r.value, diags } };
      });
    // A preflight from an allowed origin to an API route: no guard, loader or action runs.
    const pre = api !== undefined && raw.method === "OPTIONS" && raw.headers.has("access-control-request-method");
    const ran = pre
      ? { ok: true as const, value: { response: new Response(null, { status: 204 }), route: hit?.id, diags: [] } }
      : path === CSP_PATH
        ? await attempted(() => cspReport(raw, sv, log, reportSource(raw, c.env)))
        : at !== undefined
          ? await attempted(() => forward(raw, at, sv))
          : gate === undefined || (gate.ok && raw.method !== "GET")
            ? await routed()
            : await attempted(() =>
                (gate.ok
                  ? inspectResponse(opts.artifacts, gate.allow, sv.ctx)
                  : Promise.resolve({ response: denied("inspect origin refused"), diags: [] })
                ).then((r) => ({ ...r, route: undefined })),
              );
    // A server bug's thrown text is scrubbed whole before it is clipped for the dev body (`scrubbedCause`).
    const h = ran.ok ? ran.value : crashed(sv.mode, scrubbedCause(ran.error, { secrets, pii }));
    // Every API-route response varies by origin once any origin is allowed, so a shared cache keeps them apart.
    const response = secured(
      hit?.def.api !== true ? h.response : withCors(h.response, api && from, api && pre ? allowOf(api) : undefined),
      raw,
      sv,
    );
    // A response a token may have unlocked is per-token data: nothing keeps it (k.api Bearer).
    if (matched?.def.api === true && raw.headers.has("authorization"))
      response.headers.set("cache-control", "no-store");
    if (log !== undefined) {
      if (cross)
        log.write(
          diagLine(log.format, {
            code: "W1567",
            message: `${from} is cross-site: the caller cookie cannot reach it; use one registrable domain or one origin`,
          }),
        );
      for (const d of h.diags) log.write(diagLine(log.format, d));
      const ms = Math.max(0, Math.round(sv.ctx.clock.now() - t0));
      // The path as the log may hold it: each segment where a served route has a secret param is `[secret]` whatever
      // its spelling (`secretSegments`), then the request's own values are scrubbed; a request that never ran has empty sets.
      const shown = redacted(marks(path), { secrets, pii });
      log.write(reqLine(log.format, { method: raw.method, path: shown, route: h.route, status: response.status, ms }));
    }
    return response;
  });
  // A runner's record is scrubbed with the set of the `run` that rejected (`keepRunning`); a runner has no pii set.
  const failed = (message: string, frames: readonly string[], secrets: Set<string>) => {
    const lead = "runner rejected, rerun in 1000 ms: ";
    const d = { code: "keel.unexpected", lead, message: lead + message, frames };
    log?.write(diagLine(log.format, scrubbedDiag(d, { secrets, pii: new Set() })));
  };
  const app: ServerApp = {
    fetch: async (req) => {
      const r = await attempted(() => hono.fetch(req));
      return r.ok ? r.value : lastResort();
    },
    close: async () => {
      sv.lifecycle.abort();
      unbind();
      await Promise.all(await running);
    },
  };
  const unbind = bindModules(sv.ctx, opts.topology, sv.name, app, peers);
  const own = opts.topology[sv.name]?.modules ?? [];
  // Each runner's `run` enters its own scrub scope (`keepRunning`), even when this app is made inside a request.
  const running = Promise.resolve().then(() =>
    own.flatMap((m) => runners[m] ?? []).map((r) => keepRunning(r, sv.ctx, sv.lifecycle.signal, failed, sv.frames)),
  );
  return app;
}
