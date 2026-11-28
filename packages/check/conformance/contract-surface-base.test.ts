// Spec: k.compat, clause "`keel check --base` naming a missing file, or one that is not JSON, is one W1568 and exits 0; with `topology.ts` unreadable, a base entry the current one refuses is E1562."
// Spec: k.compat, clause "With a base where `y.add`'s `body` is `{ name }` and module `a`, which imports `y`'s contract, is in deployable `x`, adding a required `note` is one E1562 at `note` whose fix leaves none; with `a` and `y` in one deployable there is none."
// Spec: k.compat, clause "Removing an `output` field a base entry requires is one E1562 with no fix; adding a field to an open output object is none; removing a base entry is one E1562 with no fix."
// Spec: k.compat, clause "`keel check` without `--base` reports no E1562; a changed byte of `.keel/surface.json` is E1005 under `keel check --frozen`."
// ASSUMPTION (the spec names no key layout for `surface.json` v2 beyond "for each contract, its `module`, the modules that import it (`callers`), and each API entry's id, method, `path`, `params`, `query`, `body`, `output` and `errors`"):
// `data = { version: 2, contracts: { <module>: { module, callers, entries: { <id>: { method, path, params, query, body, output, errors } } } }, stores }`.
// The surface is `{ data, hash }` with the compiler's FNV-1a hash, as in fixtures-by-code.ts. Seed 1337.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

type Files = Parameters<typeof check>[0];
type Options = NonNullable<Parameters<typeof check>[1]>;
const canon = (v: unknown): string =>
  JSON.stringify(v, (_k, x: unknown) =>
    x === null || typeof x !== "object" || Array.isArray(x)
      ? x
      : Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, Reflect.get(x, k)]),
        ),
  );
const surfaceFile = (data: unknown): Files[number] => {
  let h = 0x811c9dc5;
  for (const ch of canon(data))
    for (let i = 0; i < ch.length; i++) h = Math.imul(h ^ ch.charCodeAt(i), 0x01000193) >>> 0;
  return {
    path: ".keel/surface.json",
    source: `${canon({ data, hash: `fnv1a:${h.toString(16).padStart(8, "0")}` })}\n`,
  };
};
const fields = (...names: string[]) => ({
  type: "object",
  properties: Object.fromEntries(names.map((n) => [n, { type: "string" }])),
  required: names,
});
const NOTHING = { type: "object", properties: {}, required: [] };
type Entry = { method: string; path: string; body: unknown; output: unknown };
const surface = (entries: Record<string, Entry>, version = 2) => ({
  version,
  contracts: {
    y: {
      module: "y",
      callers: ["a"],
      entries: Object.fromEntries(
        Object.entries(entries).map(([id, e]) => [id, { params: null, query: null, errors: {}, ...e }]),
      ),
    },
  },
  stores: {},
});
const add = (body: unknown, output: unknown = NOTHING): Record<string, Entry> => ({
  "y.add": { method: "POST", path: "/y/add", body, output },
});
const SPLIT = { x: { modules: ["a"], adapter: "node" }, y: { modules: ["y"], adapter: "node" } } as const;
const ONE = { x: { modules: ["a", "y"], adapter: "node" } } as const;
const codes = (current: unknown, base: unknown, topology: Options["topology"]) => {
  const opts: Options = { types: false, base, topology };
  return check([surfaceFile(current)], opts).diagnostics;
};

describe("E1562 over a contract's API entries (surface v2)", () => {
  test("adding a required `note` to `y.add`'s body is one E1562 at `note` whose fix leaves none; with `a` and `y` in one deployable there is none", () => {
    fc.assert(
      fc.property(fc.constantFrom("note", "qty", "label"), (f) => {
        const base = surface(add(fields("name")));
        const current = surface(add(fields("name", f)));
        const d = codes(current, base, SPLIT).filter((x) => x.code === "E1562");
        expect(d).toHaveLength(1);
        expect(String(d[0]?.message)).toContain(f);
        expect(String(d[0]?.message)).toContain("y.add");
        expect(codes(current, base, ONE).filter((x) => x.code === "E1562")).toEqual([]);
      }),
      { seed: 1337, numRuns: 6 },
    );
  });

  test("removing an `output` field a base entry requires is one E1562 with no fix; adding a field to an open output object is none", () => {
    const base = surface(add(fields("name"), fields("id", "extra")));
    const removed = codes(surface(add(fields("name"), fields("id"))), base, SPLIT).filter((x) => x.code === "E1562");
    expect(removed).toHaveLength(1);
    expect(removed[0]?.fix).toBeUndefined();
    const widened = codes(surface(add(fields("name"), fields("id", "extra", "more"))), base, SPLIT).filter(
      (x) => x.code === "E1562",
    );
    expect(widened).toEqual([]);
  });

  test("removing a base entry, or moving it to another method or path, is one E1562 with no fix", () => {
    const base = surface(add(fields("name")));
    const removed = codes(surface({}), base, SPLIT).filter((x) => x.code === "E1562");
    expect(removed).toHaveLength(1);
    expect(removed[0]?.fix).toBeUndefined();
    const moved = codes(
      surface({ "y.add": { method: "PUT", path: "/y/add", body: fields("name"), output: NOTHING } }),
      base,
      SPLIT,
    ).filter((x) => x.code === "E1562");
    expect(moved).toHaveLength(1);
    expect(moved[0]?.fix).toBeUndefined();
  });

  test("a base that is not a `version` 2 or 3 surface is one W1568 and no E1562", () => {
    const current = surface(add(fields("name", "note")));
    for (const base of [surface(add(fields("name")), 4), surface(add(fields("name")), 1), {}, "not json", null]) {
      const d = codes(current, base, SPLIT);
      expect(d.filter((x) => x.code === "W1568")).toHaveLength(1);
      expect(d.filter((x) => x.code === "E1562")).toEqual([]);
    }
  });

  test("a base of version 2 or of version 3 is read: no W1568, and the entry the current one refuses is one E1562", () => {
    const current = surface(add(fields("name", "note")));
    for (const version of [2, 3]) {
      const d = codes(current, surface(add(fields("name")), version), SPLIT);
      expect(d.filter((x) => x.code === "W1568")).toEqual([]);
      expect(d.filter((x) => x.code === "E1562")).toHaveLength(1);
    }
  });

  test("`keel check` without `--base` reports no E1562", () => {
    const opts: Options = { types: false, topology: SPLIT };
    expect(
      check([surfaceFile(surface(add(fields("name", "note"))))], opts).diagnostics.filter((x) => x.code === "E1562"),
    ).toEqual([]);
  });

  test("a changed byte of `.keel/surface.json` is no diagnostic of the in-memory check(), which compares an evaluated view only with a `derived` it is given (k.derived In process); E1005 under `keel check --frozen` is asserted by the cli suite", () => {
    const file = surfaceFile(surface(add(fields("name"))));
    const edited = { ...file, source: file.source.replace('"y.add"', '"y.add" ') };
    expect(check([edited], { types: false }).diagnostics.filter((x) => x.path === ".keel/surface.json")).toEqual([]);
  });
});
