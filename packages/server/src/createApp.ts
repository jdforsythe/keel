import { INSPECT_PATH } from "@keel/compiler/inspect/INSPECT_PATH";
import { scope } from "@keel/reactive";
import { compileRoutes, compileTable } from "@keel/router";
import { attempt } from "@keel/schema";
import { isolate } from "@keel/store";
import { Hono } from "hono";
import { DEFAULT_MAX_BODY } from "./internal/DEFAULT_MAX_BODY.ts";
import type { Served } from "./internal/Served.ts";
import { callerOf } from "./internal/callerOf.ts";
import { callers } from "./internal/callers.ts";
import { crashed } from "./internal/crashed.ts";
import { denied } from "./internal/denied.ts";
import { diagLine } from "./internal/diagLine.ts";
import { installServerDom } from "./internal/dom/installServerDom.ts";
import { handle } from "./internal/handle.ts";
import { inspectAllowed } from "./internal/inspectAllowed.ts";
import { inspectResponse } from "./internal/inspectResponse.ts";
import { moduleOf } from "./internal/moduleOf.ts";
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
 * appear in `#k-state` and are disposed after the response; module-level stores are process-shared and appear (state
 * only, unless `log: true`) only when listed in `expose`. `mode` defaults to `production` (RFC 0022).
 * With no DOM global (plain Node) it installs the DOM-free server tree (`installServerDom`) so components that build
 * DOM render documents. A JSON or FormData action body over `maxBodyBytes` (default 1 MiB) gets 413 `keel.payloadTooLarge`.
 * In `dev` mode `GET /__keel/inspect` returns the inspect document (k.cli Inspect) before the route table, to a loopback
 * or listed host and an absent (GET only), same, or listed (`inspect.origins`) `Origin` only; others, and any other
 * method without an allowed `Origin`, get 403 `keel.denied`.
 * Each request has a caller (`keel-caller` cookie, minted and set HttpOnly/SameSite=Lax on a write without one); log
 * entries an action commits to a module store are tagged with it, and `undoOwn`/`canUndoOwn` act only on the caller's
 * own last entry (finding 0082).
 */
export async function createApp(opts: AppOptions): Promise<ServerApp> {
  installServerDom();
  const routes = opts.routes.routes;
  const table = compileTable(compileRoutes(routes), routes);
  const modules = new Set(Object.keys(routes).map(moduleOf));
  const sv: Served = {
    table: selectDeployable(opts.topology, table, modules, opts.deployable),
    ctx: opts.ctx,
    mode: opts.mode ?? "production",
    routes: opts.routes,
    expose: new Map(
      (opts.expose ?? []).map((x): [string, boolean] => ("store" in x ? [x.store.id, x.log === true] : [x.id, false])),
    ),
    maxBody: opts.maxBodyBytes ?? DEFAULT_MAX_BODY,
    inspectOrigins: opts.inspect?.origins ?? [],
    tags: new WeakMap(),
  };
  const log = opts.log;
  const hono = new Hono();
  hono.all("*", async (c) => {
    const raw = c.req.raw;
    const t0 = sv.ctx.clock.now();
    const rq = { scope: scope(() => undefined), caller: callerOf(raw, sv.ctx, sv.tags) };
    isolate(rq.scope);
    callers.set(rq.scope, rq.caller);
    const path = new URL(raw.url).pathname;
    const inspecting = sv.mode === "dev" && path === INSPECT_PATH;
    const gate = inspecting ? inspectAllowed(raw, sv.inspectOrigins) : undefined;
    const ran = await attempt(() =>
      gate === undefined || (gate.ok && raw.method !== "GET")
        ? handle(sv, raw, rq)
        : (gate.ok
            ? inspectResponse(opts.artifacts, gate.allow)
            : Promise.resolve(denied("inspect origin refused"))
          ).then((response) => ({ response, route: undefined, diags: [] })),
    );
    rq.scope.dispose();
    const h = ran.ok ? ran.value : crashed(sv.mode, ran.error);
    if (log !== undefined) {
      for (const d of h.diags) log.write(diagLine(log.format, d));
      const ms = Math.max(0, Math.round(sv.ctx.clock.now() - t0));
      log.write(reqLine(log.format, { method: raw.method, path, route: h.route, status: h.response.status, ms }));
    }
    return h.response;
  });
  return { fetch: async (req) => hono.fetch(req) };
}
