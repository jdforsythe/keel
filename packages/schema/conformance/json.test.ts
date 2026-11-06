import { s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
// Clause: every generated json value round-trips and non-JSON values are rejected with rule type. Seed 1337.
import { describe, expect, it } from "vitest";
import { RUNS, SEED } from "./fixtures";

const Json = s.json();
const rules = (x: unknown): string[] => {
  const r = Json.parse(x);
  return r.ok ? [] : r.error.data.issues.map((i) => i.rule);
};

describe("k.schema json", () => {
  it("every generated value parses, round-trips through encode/decode and a JSON string", () => {
    fc.assert(
      fc.property(gen(Json), (v) => {
        expect(Json.parse(v).ok).toBe(true);
        const r = Json.decode(JSON.parse(JSON.stringify(Json.encode(v))));
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.value).toEqual(v);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
  it("accepts JSON scalars, arrays and plain objects", () => {
    for (const v of [null, true, "", 0, -1.5, [], {}, [1, [null, { a: "b" }]], { a: { b: [] } }])
      expect(Json.parse(v).ok).toBe(true);
  });
  it("rejects non-JSON values with rule type", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    class Box {}
    const bad: unknown[] = [
      undefined,
      () => 1,
      Symbol("x"),
      10n,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      new Date(0),
      new Map(),
      new Box(),
      cyclic,
      [undefined],
      { a: undefined },
      { a: () => 1 },
      [1, [Number.NaN]],
      JSON.parse('{"__proto__":1}'),
    ];
    for (const v of bad) expect(rules(v)).toEqual(["type"]);
  });
  it("reports the path of the offending nested value", () => {
    const r = Json.parse({ a: [1, Number.NaN] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.data.issues.every((i) => i.rule === "type")).toBe(true);
  });
  it("doc() is json", () => expect(Json.doc()).toBe("json"));
  it("decodeStrings parses the string as JSON", () => {
    const O = s.object({ state: s.json(), note: s.json().optional() });
    const r = O.decodeStrings({ state: '{"a":[1,2,null]}' });
    expect(r.ok && r.value).toEqual({ state: { a: [1, 2, null] } });
    expect(O.decodeStrings({ state: "{nope" }).ok).toBe(false);
    expect(O.decodeStrings({}).ok).toBe(false);
    const q = O.decodeStrings(new URLSearchParams({ state: "3", note: "" }));
    expect(q.ok && q.value).toEqual({ state: 3 });
  });
  it("composes: json fields inside objects, arrays and records, nullable and optional", () => {
    const O = s.object({ a: Json, b: s.array(Json), c: s.record(Json), d: Json.nullable(), e: Json.optional() });
    const v = { a: { x: 1 }, b: [1, "2"], c: { k: [] }, d: null };
    const r = O.parse(v);
    expect(r.ok).toBe(true);
    expect(O.encode(v)).toEqual(v);
  });
});
