import type { Surface } from "./Surface.ts";
import type { SurfaceEndpoint } from "./SurfaceEndpoint.ts";
import type { SurfaceRoute } from "./SurfaceRoute.ts";
import type { SurfaceService } from "./SurfaceService.ts";
import { isRecord } from "./isRecord.ts";

type Rec = Readonly<Record<string, unknown>>;
const str = (x: unknown): string => (typeof x === "string" ? x : "");
const rec = (x: unknown): Rec => (isRecord(x) ? x : {});
const js = (r: Rec, k: string): unknown => r[k] ?? null;

function route(id: string, x: unknown): SurfaceRoute[] {
  const r = rec(x);
  if (typeof r.module !== "string" || typeof r.path !== "string") return [];
  const actions = new Map(
    Object.entries(rec(r.actions)).map(([m, a]) => [m, { input: js(rec(a), "input"), answer: js(rec(a), "answer") }]),
  );
  const schemas = { params: js(r, "params"), search: js(r, "search"), get: js(r, "get") };
  return [{ id, module: r.module, path: r.path, file: str(r.file), ...schemas, actions }];
}

function endpoint(name: string, x: unknown): SurfaceEndpoint[] {
  const e = rec(x);
  if (typeof e.method !== "string" || typeof e.path !== "string") return [];
  const errors = new Map(Object.entries(rec(e.errors)));
  const parts = { params: js(e, "params"), query: js(e, "query"), body: js(e, "body"), output: js(e, "output") };
  return [{ name, method: e.method, path: e.path, ...parts, errors }];
}

function service(x: unknown): SurfaceService[] {
  const v = rec(x);
  if (typeof v.caller !== "string" || typeof v.module !== "string") return [];
  const endpoints = Object.entries(rec(v.endpoints)).flatMap(([n, e]) => endpoint(n, e));
  return [{ file: str(v.file), caller: v.caller, module: v.module, endpoints }];
}

/**
 * A `surface.json` value (the file's `{ data, hash }`, or its `data`) as `keel check` reads it, or `null` when it is
 * not one: `data` must hold a `routes` object and a `services` array; `stores` (absent: none) is read too.
 * Malformed entries are skipped.
 */
export function readSurface(value: unknown): Surface | null {
  const v = rec(value);
  const data = isRecord(v.data) ? v.data : v;
  if (!isRecord(data.routes) || !Array.isArray(data.services)) return null;
  const sources = new Map(
    Object.entries(rec(data.sources)).flatMap(([p, h]) => (typeof h === "string" ? [[p, h]] : [])),
  );
  const stores = new Map(
    Object.entries(rec(data.stores)).map(([id, x]) => {
      const transactions = new Map(Object.entries(rec(rec(x).transactions)));
      return [id, { id, state: js(rec(x), "state"), transactions }];
    }),
  );
  return {
    routes: Object.entries(data.routes).flatMap(([id, r]) => route(id, r)),
    services: data.services.flatMap(service),
    stores,
    sources,
  };
}
