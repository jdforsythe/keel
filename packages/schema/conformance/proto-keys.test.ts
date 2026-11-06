import { s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
// Clause: parse rejects own __proto__, constructor, prototype keys at any depth; decodeStrings behaves identically. Seed 1337, 100 runs.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RUNS, SEED } from "./fixtures";

const Circle = s.object({ kind: s.literal("circle"), r: s.int() });
const Square = s.object({ kind: s.literal("square"), side: s.int() });
const Item = s.object({ id: s.int(), tags: s.record(s.int()) });
const Doc = s.object({
  title: s.string({ min: 0, max: 8 }),
  items: s.array(Item),
  shape: s.union("kind", [Circle, Square]),
  meta: s.record(s.object({ n: s.int() })),
  extra: s.json(),
});

const KEYS = ["__proto__", "constructor", "prototype"] as const;
type Path = (string | number)[];
const issues = (r: { ok: true } | { ok: false; error: { data: { issues: unknown[] } } }): unknown[] =>
  r.ok ? [] : r.error.data.issues;

/** Every path in `v` that addresses a plain object (the places a key can be injected). */
const objectPaths = (v: unknown, at: Path = []): Path[] =>
  Array.isArray(v)
    ? v.flatMap((x, i) => objectPaths(x, [...at, i]))
    : typeof v === "object" && v !== null
      ? [at, ...Object.entries(v).flatMap(([k, x]) => objectPaths(x, [...at, k]))]
      : [];

const inject = (v: unknown, path: Path, key: string): unknown => {
  const [head, ...rest] = path;
  if (head === undefined) {
    const copy = JSON.parse(JSON.stringify(v));
    Object.defineProperty(copy, key, { value: { p: 1 }, enumerable: true, configurable: true, writable: true });
    return copy;
  }
  if (Array.isArray(v)) return v.map((x, i) => (i === head ? inject(x, rest, key) : x));
  return Object.fromEntries(Object.entries(Object(v)).map(([k, x]) => [k, k === head ? inject(x, rest, key) : x]));
};

describe("k.schema proto keys rejected at any depth", () => {
  it("parse reports rule type at the carrying object, for a random injection path", () => {
    fc.assert(
      fc.property(gen(Doc), fc.nat(), fc.constantFrom(...KEYS), (v, pick, key) => {
        const paths = objectPaths(v);
        const path = paths[pick % paths.length] ?? [];
        // An s.json() value is validated whole: a key anywhere inside it is reported at the json field itself.
        const reported = path[0] === "extra" ? ["extra"] : path;
        expect(issues(Doc.parse(inject(v, path, key)))).toContainEqual({ path: reported, rule: "type" });
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("parse rejects a nested proto key inside an undeclared extra", () => {
    const O = s.object({ title: s.string() });
    const r = O.parse(JSON.parse('{"title":"a","x":{"__proto__":{"p":1}}}'));
    expect(issues(r)).toEqual([{ path: ["x"], rule: "type" }]);
    const deep = O.parse(JSON.parse('{"title":"a","x":[{"y":{"constructor":1}}]}'));
    expect(issues(deep)).toEqual([{ path: ["x", 0, "y"], rule: "type" }]);
  });

  it("decodeStrings rejects, not drops, a proto key at a random depth", () => {
    const D = s.object({
      title: s.string(),
      inner: s.object({ n: s.int(), tags: s.record(s.int()) }),
    });
    const where: [Path, string][] = [
      [[], ""],
      [["inner"], "inner."],
      [["inner", "tags"], "inner.tags."],
    ];
    fc.assert(
      fc.property(fc.constantFrom(...where), fc.constantFrom(...KEYS), ([path, prefix], key) => {
        const r = D.decodeStrings({ title: "t", "inner.n": "1", [`${prefix}${key}`]: "x" });
        expect(issues(r)).toEqual([{ path, rule: "type" }]);
      }),
      { seed: SEED, numRuns: RUNS },
    );
    expect(issues(D.decodeStrings({ title: "t", "inner.n": "1", "unknown.__proto__.p": "1" }))).toEqual([
      { path: ["unknown"], rule: "type" },
    ]);
  });
});
