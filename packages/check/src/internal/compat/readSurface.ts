import type { Surface } from "./Surface.ts";
import type { SurfaceContract } from "./SurfaceContract.ts";
import type { SurfaceEntry } from "./SurfaceEntry.ts";
import { isRecord } from "./isRecord.ts";

type Rec = Readonly<Record<string, unknown>>;
const rec = (x: unknown): Rec => (isRecord(x) ? x : {});
const js = (r: Rec, k: string): unknown => r[k] ?? null;

function entry(id: string, x: unknown): [string, SurfaceEntry][] {
  const e = rec(x);
  if (typeof e.method !== "string" || typeof e.path !== "string") return [];
  const errors = new Map(Object.entries(rec(e.errors)));
  const parts = { params: js(e, "params"), query: js(e, "query"), body: js(e, "body"), output: js(e, "output") };
  return [[id, { id, method: e.method, path: e.path, ...parts, errors }]];
}

function contract(key: string, x: unknown): [string, SurfaceContract][] {
  const c = rec(x);
  const module = typeof c.module === "string" ? c.module : key;
  const callers = Array.isArray(c.callers) ? c.callers.filter((m) => typeof m === "string") : [];
  const entries = new Map(Object.entries(rec(c.entries)).flatMap(([id, e]) => entry(id, e)));
  return [[module, { module, callers, entries }]];
}

/**
 * A `surface.json` value (the file's `{ data, hash }`, or its `data`) as `keel check` reads it, or `null` when it is
 * no surface of version 2 or 3 (k.compat Surface): `data.version` must be 2 or 3 and `data.contracts` an object;
 * `stores` (absent: none) is read too, and a version 2 file's `sources` is ignored. Malformed entries are skipped.
 */
export function readSurface(value: unknown): Surface | null {
  const v = rec(value);
  const data = isRecord(v.data) ? v.data : v;
  if ((data.version !== 2 && data.version !== 3) || !isRecord(data.contracts)) return null;
  const stores = new Map(
    Object.entries(rec(data.stores)).map(([id, x]) => {
      const transactions = new Map(Object.entries(rec(rec(x).transactions)));
      return [id, { id, state: js(rec(x), "state"), transactions }];
    }),
  );
  return { contracts: new Map(Object.entries(data.contracts).flatMap(([k, c]) => contract(k, c))), stores };
}
