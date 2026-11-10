// Format types beyond the conformance clauses: nesting, decodeStrings, secrets, sampleFormat. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { s } from "../src/index.ts";
import { sampleFormat } from "../src/internal/index.ts";

const Even = s.format("even", s.int(), {
  check: (v) => v % 2 === 0,
  gen: { from: s.int({ min: -9, max: 9 }), map: (n) => n * 2 },
});

describe("s.format", () => {
  it("decodeStrings coerces as base, then check refuses with rule format at the field path", () => {
    const F = s.object({ n: Even, list: s.array(Even).optional() });
    const odd = F.decodeStrings(new URLSearchParams([["n", "3"]]));
    expect(odd.ok ? [] : odd.error.data.issues).toEqual([{ path: ["n"], rule: "format" }]);
    const even = F.decodeStrings(
      new URLSearchParams([
        ["n", "4"],
        ["list", "2"],
        ["list", "6"],
      ]),
    );
    expect(even.ok ? even.value : null).toEqual({ n: 4, list: [2, 6] });
  });

  it("a format over a format checks both, and its doc is the outer name", () => {
    const Big = s.format("big-even", Even, {
      check: (v) => v > 10,
      gen: { from: Even, map: (n) => n },
    });
    expect(Big.parse(12).ok).toBe(true);
    expect(Big.parse(8).ok ? [] : Big.parse(8)).toMatchObject({ error: { data: { issues: [{ rule: "format" }] } } });
    expect(Big.parse(13).ok).toBe(false);
    expect(Big.doc()).toBe("big-even");
  });

  it("JSON.stringify of any schema writes its node", () => {
    const O = s.object({ n: Even.optional() });
    expect(JSON.parse(JSON.stringify(O))).toEqual({
      kind: "object",
      fields: { n: { kind: "optional", inner: { kind: "format", name: "even", base: { kind: "int" } } } },
    });
  });

  it("sampleFormat maps an encoded `from` value and keeps it only when check accepts", () => {
    fc.assert(
      fc.property(fc.integer({ min: -9, max: 9 }), (n) => {
        const v = sampleFormat(Even.node, () => n);
        expect(v).toBe(n * 2);
        expect(Even.parse(v).ok).toBe(true);
      }),
      { seed: 1337, numRuns: 30 },
    );
    const Never = s.format("never", s.string(), { check: () => false, gen: { from: s.string(), map: (x) => x } });
    expect(sampleFormat(Never.node, () => "x")).toBeUndefined();
    expect(sampleFormat(s.int().node, () => 1)).toBeUndefined();
    expect(sampleFormat({ kind: "format", name: "lost", base: { kind: "int" } }, () => 1)).toBeUndefined();
  });

  it("enum pathDefault stays in the node and must be a value", () => {
    expect(s.enum(["a", "b"], { pathDefault: "b" }).node).toEqual({
      kind: "enum",
      values: ["a", "b"],
      pathDefault: "b",
    });
    expect(s.enum(["a", "b"]).node).toEqual({ kind: "enum", values: ["a", "b"] });
    expect(() => s.enum(["a"], { pathDefault: "c" })).toThrow(/pathDefault/);
  });
});
