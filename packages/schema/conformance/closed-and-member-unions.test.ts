// Spec: k.schema, clause "Every generated value of a closed object round-trips, and adding an undeclared key fails with rule `unknown-key` at that key. Every generated value of a member union round-trips; a value no member accepts fails with the last member's issues."
// Seed 1337.
import { s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RUNS, SEED } from "./fixtures";

const opts = { seed: SEED, numRuns: RUNS };

const shape = { name: s.string(), n: s.int(), tag: s.string().optional() };
const Closed = s.object(shape, { closed: true });
const Open = s.object(shape);
const Outer = s.object({ inner: Closed });
const declared = new Set(Object.keys(shape));
const extraKey = fc
  .stringMatching(/^[a-z]{1,8}$/)
  .filter((k) => !declared.has(k) && k !== "constructor" && k !== "prototype");

const Pair = s.object({ light: s.string(), dark: s.string() }, { closed: true });
const Theme = s.union([s.string(), Pair]);

describe("k.schema closed objects and member unions (rfc:0029)", () => {
  it("every generated value of a closed object round-trips, also through JSON text", () => {
    fc.assert(
      fc.property(gen(Closed), (v) => {
        const enc = Closed.encode(v);
        const direct = Closed.parse(enc);
        expect(direct.ok).toBe(true);
        if (direct.ok) expect(direct.value).toEqual(v);
        const viaText = Closed.parse(JSON.parse(JSON.stringify(enc)));
        expect(viaText.ok).toBe(true);
        if (viaText.ok) expect(viaText.value).toEqual(v);
      }),
      opts,
    );
  });

  it("adding an undeclared key to a closed object fails with exactly rule unknown-key at [key]", () => {
    fc.assert(
      fc.property(gen(Closed), extraKey, (v, key) => {
        const r = Closed.parse({ ...v, [key]: 1 });
        expect(r.ok).toBe(false);
        if (!r.ok) {
          expect(r.error.code).toBe("schema.invalid");
          expect(r.error.data.issues).toEqual([{ path: [key], rule: "unknown-key" }]);
        }
      }),
      opts,
    );
  });

  it("an undeclared key inside a nested closed object fails at [inner, key]", () => {
    fc.assert(
      fc.property(gen(Closed), extraKey, (v, key) => {
        const r = Outer.parse({ inner: { ...v, [key]: "x" } });
        expect(r.ok).toBe(false);
        if (!r.ok) {
          expect(r.error.data.issues).toEqual([{ path: ["inner", key], rule: "unknown-key" }]);
        }
      }),
      opts,
    );
  });

  it("open objects accept undeclared keys and encode drops them", () => {
    fc.assert(
      fc.property(gen(Open), extraKey, (v, key) => {
        const input = { ...v, [key]: 1 };
        const r = Open.parse(input);
        expect(r.ok).toBe(true);
        expect(Open.encode(input)).toEqual(Open.encode(v));
        expect(Open.encode(input)).not.toHaveProperty([key]);
      }),
      opts,
    );
  });

  it("closed object doc() writes {| a: T |} (nested form)", () => {
    const doc = s.object({ box: s.object({ a: s.string() }, { closed: true }) }).doc();
    expect(doc).toContain("{|");
    expect(doc).toContain("|}");
  });

  it("decodeStrings on a closed object reads declared keys only", () => {
    const C = s.object({ name: s.string() }, { closed: true });
    const r = C.decodeStrings(new URLSearchParams("name=a&extra=1"));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ name: "a" });
  });

  it("every generated value of a member union round-trips, also through JSON text", () => {
    fc.assert(
      fc.property(gen(Theme), (v) => {
        expect(Theme.parse(v).ok).toBe(true);
        const enc = Theme.encode(v);
        for (const wire of [enc, JSON.parse(JSON.stringify(enc))]) {
          const r = Theme.parse(wire);
          expect(r.ok).toBe(true);
          if (r.ok) expect(r.value).toEqual(v);
        }
      }),
      opts,
    );
  });

  it("a member union accepts a string and a pair object", () => {
    const a = Theme.parse("dark");
    const b = Theme.parse({ light: "a", dark: "b" });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (a.ok) expect(a.value).toBe("dark");
    if (b.ok) expect(b.value).toEqual({ light: "a", dark: "b" });
  });

  it("a value no member accepts fails with the last member's issues", () => {
    const bad = Theme.parse({ light: "a", dark: 1 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.data.issues).toEqual([{ path: ["dark"], rule: "type" }]);
    const five = Theme.parse(5);
    expect(five.ok).toBe(false);
    if (!five.ok) expect(five.error.data.issues).toEqual([{ path: [], rule: "type" }]);
  });

  it("encode uses the first accepting member", () => {
    const U = s.union([s.object({ a: s.string() }), s.object({ a: s.string(), b: s.int() }, { closed: true })]);
    expect(U.encode({ a: "x", b: 1 })).toEqual({ a: "x" });
  });

  it("union doc() is a | b", () => {
    expect(s.union([s.string(), s.int()]).doc()).toBe("string | int");
  });

  it("decodeStrings of a member-union field uses the first member whose candidate parses", () => {
    const O = s.object({ c: s.union([s.int(), s.object({ x: s.int() })]) });
    const scalar = O.decodeStrings(new URLSearchParams("c=3"));
    expect(scalar.ok).toBe(true);
    if (scalar.ok) expect(scalar.value).toEqual({ c: 3 });
    const nested = O.decodeStrings(new URLSearchParams("c.x=4"));
    expect(nested.ok).toBe(true);
    if (nested.ok) expect(nested.value).toEqual({ c: { x: 4 } });
  });

  it("gen of a member union produces values of more than one member", () => {
    const values = fc.sample(gen(Theme), { seed: SEED, numRuns: RUNS });
    expect(values.some((v) => typeof v === "string")).toBe(true);
    expect(values.some((v) => typeof v === "object" && v !== null)).toBe(true);
  });
});
