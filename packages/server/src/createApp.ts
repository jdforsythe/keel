import { scope } from "@keel/reactive";
import { compileRoutes, compileTable } from "@keel/router";
import { attempt } from "@keel/schema";
import { Hono } from "hono";
import { INSPECT_PATH } from "./internal/INSPECT_PATH.ts";
import type { Served } from "./internal/Served.ts";
import { crashed } from "./internal/crashed.ts";
import { diagLine } from "./internal/diagLine.ts";
import { handle } from "./internal/handle.ts";
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
 * Each request runs in its own scope: stores created in it appear in `#k-state` and are disposed after the
 * response; module-level stores are process-shared and appear only when listed in `expose`.
 * In `dev` mode `GET /__keel/inspect` returns the inspect document (k.cli Inspect) before the route table.
 */
export async function createApp(opts: AppOptions): Promise<ServerApp> {
  const routes = opts.routes.routes;
  const table = compileTable(compileRoutes(routes), routes);
  const modules = new Set(Object.keys(routes).map(moduleOf));
  const sv: Served = {
    table: selectDeployable(opts.topology, table, modules, opts.deployable),
    ctx: opts.ctx,
    mode: opts.mode ?? "dev",
    guards: new Map((opts.guards ?? []).map((g) => [g.name, g])),
    expose: new Set((opts.expose ?? []).map((st) => st.id)),
  };
  const log = opts.log;
  const hono = new Hono();
  hono.all("*", async (c) => {
    const raw = c.req.raw;
    const t0 = sv.ctx.clock.now();
    const rq = { scope: scope(() => undefined), created: new Set<string>() };
    const path = new URL(raw.url).pathname;
    const inspecting = sv.mode === "dev" && raw.method === "GET" && path === INSPECT_PATH;
    const ran = await attempt(() =>
      inspecting
        ? inspectResponse(opts.artifacts, raw.headers.get("origin") ?? undefined).then((response) => ({
            response,
            route: undefined,
            diags: [],
          }))
        : handle(sv, raw, rq),
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
