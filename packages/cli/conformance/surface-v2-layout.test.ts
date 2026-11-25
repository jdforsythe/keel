// k.compat, Surface "Its layout, keys sorted, `callers` sorted, an absent `params`, `query` or `body` `null`, no `errors` `{}`, `sources` each file the build evaluated with the hash of its normal form (Sources):"
// Spec: k.compat, clause "`keel build` with `a` importing `y`'s contract writes `data.contracts.y` `{ module, callers: [\"a\"], entries }`, `params` `null` on an entry without one."
// Seed: none (a fixed project). Real binary over a temp project (compat-support.ts).
import { afterAll, expect, test } from "vitest";
import { cleanup, keel, materialize, project, readText } from "./compat-support.ts";

const SLOW = 180_000;
const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});

const rec = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null ? Object.fromEntries(Object.entries(v)) : {};
const sorted = (o: Record<string, unknown>): boolean =>
  JSON.stringify(Object.keys(o)) === JSON.stringify(Object.keys(o).sort());

function surface() {
  const dir = materialize(project({}));
  dirs.push(dir);
  expect(keel(dir, ["build"]).status).toBe(0);
  return rec(JSON.parse(readText(dir, ".keel/surface.json")));
}

test(
  "`.keel/surface.json` holds `data` with `version` 2, `contracts`, `stores` and `sources`, and a `hash`, every object's keys sorted",
  () => {
    const file = surface();
    expect(Object.keys(file).sort()).toEqual(["data", "hash"]);
    expect(String(file.hash)).toMatch(/^fnv1a:[0-9a-f]{8}$/);
    const data = rec(file.data);
    expect(Object.keys(data)).toEqual(["contracts", "sources", "stores", "version"]);
    expect(data.version).toBe(2);
    for (const o of [data, rec(data.contracts), rec(data.stores), rec(data.sources)]) expect(sorted(o)).toBe(true);
  },
  SLOW,
);

test(
  "`data.contracts` is keyed by module, each `{ module, callers, entries }` with `callers` sorted and `entries` keyed by API id",
  () => {
    const y = rec(rec(rec(surface().data).contracts).y);
    expect(Object.keys(y)).toEqual(["callers", "entries", "module"]);
    expect(y.module).toBe("y");
    expect(y.callers).toEqual(["a"]);
    expect(Object.keys(rec(y.entries)).sort()).toEqual(["y.add", "y.load"]);
  },
  SLOW,
);

test(
  "an entry holds `body`, `errors`, `method`, `output`, `params`, `path` and `query`; an absent `params`, `query` or `body` is `null` and no `errors` is `{}`",
  () => {
    const entries = rec(rec(rec(rec(surface().data).contracts).y).entries);
    const load = rec(entries["y.load"]);
    expect(Object.keys(load)).toEqual(["body", "errors", "method", "output", "params", "path", "query"]);
    expect(load.params).toBeNull();
    expect(load.query).toBeNull();
    expect(load.body).toBeNull();
    expect(load.errors).toEqual({});
    expect(load.method).toBe("GET");
    expect(rec(entries["y.add"]).body).not.toBeNull();
  },
  SLOW,
);

test(
  "`data.sources` maps each contract file the build evaluated to an `fnv1a:` content hash; a module with no API entry has no `contracts` key",
  () => {
    const data = rec(surface().data);
    const src = rec(data.sources);
    expect(String(src["modules/y/y.contract.ts"])).toMatch(/^fnv1a:[0-9a-f]{8}$/);
    expect(Object.keys(rec(data.contracts))).toEqual(["y"]);
  },
  SLOW,
);
