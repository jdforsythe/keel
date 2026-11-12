// Seed 1337. Properties of `accepts` (k.compat Accepts) over generated k.schema pairs, encoded as `surface.json` writes them.
import { type Schema, s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { accepts } from "../src/internal/compat/accepts.ts";
import { jsonSchemaOf } from "./support/jsonSchemaOf.ts";

const SEED = 1337;

type D =
  | { k: "string"; min: number; max: number | undefined }
  | { k: "number"; int: boolean; min: number | undefined; max: number | undefined }
  | { k: "boolean" }
  | { k: "literal"; v: string | number | boolean }
  | { k: "enum"; v: [string, ...string[]] }
  | { k: "json" }
  | { k: "array" | "record" | "nullable"; of: D }
  | { k: "object"; f: [string, D, boolean][]; closed: boolean }
  | { k: "union"; m: [D, D] };

const opt = <T>(a: fc.Arbitrary<T>): fc.Arbitrary<T | undefined> => fc.option(a, { nil: undefined });
const words = fc.constantFrom("p", "q", "r", "t");
const leaf: fc.Arbitrary<D> = fc.oneof(
  fc
    .tuple(fc.nat(3), opt(fc.nat(4)))
    .map(([min, extra]): D => ({ k: "string", min, max: extra === undefined ? undefined : min + extra })),
  fc
    .tuple(fc.boolean(), opt(fc.integer({ min: -5, max: 5 })), opt(fc.nat(9)))
    .map(([int, min, span]): D => ({ k: "number", int, min, max: span === undefined ? undefined : (min ?? 0) + span })),
  fc.constant<D>({ k: "boolean" }),
  fc.oneof(words, fc.integer({ min: -3, max: 3 }), fc.boolean()).map((v): D => ({ k: "literal", v })),
  fc.uniqueArray(words, { minLength: 1, maxLength: 3 }).map((v): D => ({ k: "enum", v: [v[0] ?? "p", ...v.slice(1)] })),
  fc.constant<D>({ k: "json" }),
);
const dArb: fc.Arbitrary<D> = fc.letrec<{ d: D }>((tie) => ({
  d: fc.oneof(
    { depthSize: "small", maxDepth: 3 },
    leaf,
    fc
      .tuple(fc.constantFrom<"array" | "record" | "nullable">("array", "record", "nullable"), tie("d"))
      .map(([k, of]): D => ({ k, of })),
    fc
      .tuple(
        fc.uniqueArray(fc.tuple(fc.constantFrom("name", "note", "qty"), tie("d"), fc.boolean()), {
          selector: (t) => t[0],
          maxLength: 3,
        }),
        fc.boolean(),
      )
      .map(([f, closed]): D => ({ k: "object", f, closed })),
    fc.tuple(tie("d"), tie("d")).map(([a, b]): D => ({ k: "union", m: [a, b] })),
  ),
})).d;

function build(d: D): Schema<unknown> {
  switch (d.k) {
    case "string":
      return s.string(d.max === undefined ? { min: d.min } : { min: d.min, max: d.max });
    case "number": {
      const b = { ...(d.min === undefined ? {} : { min: d.min }), ...(d.max === undefined ? {} : { max: d.max }) };
      return d.int ? s.int(b) : s.number(b);
    }
    case "boolean":
      return s.boolean();
    case "literal":
      return s.literal(d.v);
    case "enum":
      return s.enum(d.v);
    case "json":
      return s.json();
    case "array":
      return s.array(build(d.of));
    case "record":
      return s.record(build(d.of));
    case "nullable":
      return build(d.of).nullable();
    case "object":
      return s.object(Object.fromEntries(d.f.map(([n, f, o]) => [n, o ? build(f).optional() : build(f)])), {
        closed: d.closed,
      });
    case "union":
      return s.union([build(d.m[0]), build(d.m[1])]);
  }
}

/** Schemas that must accept `d`: looser bounds, more values, optional or added optional fields, open objects, unions. */
function widen(d: D): fc.Arbitrary<D> {
  const same = fc.constant(d);
  const extra: fc.Arbitrary<D>[] = [
    fc.constant<D>({ k: "json" }),
    fc.constant<D>({ k: "nullable", of: d }),
    dArb.map((o): D => ({ k: "union", m: [o, d] })),
  ];
  switch (d.k) {
    case "string":
      return fc.oneof(same, ...extra, fc.constant<D>({ k: "string", min: 0, max: undefined }));
    case "number":
      return fc.oneof(same, ...extra, fc.constant<D>({ k: "number", int: false, min: undefined, max: d.max }));
    case "literal":
      return fc.oneof(
        same,
        ...extra,
        fc.constant<D>(
          typeof d.v === "string"
            ? { k: "enum", v: [d.v, "zz"] }
            : typeof d.v === "number"
              ? { k: "number", int: false, min: undefined, max: undefined }
              : { k: "boolean" },
        ),
      );
    case "enum":
      return fc.oneof(same, ...extra, fc.constant<D>({ k: "enum", v: [...d.v, "zz"] }));
    case "array":
    case "record":
    case "nullable":
      return fc.oneof(
        same,
        ...extra,
        widen(d.of).map((of): D => ({ k: d.k, of })),
      );
    case "object":
      return fc.oneof(
        same,
        ...extra,
        fc.tuple(fc.tuple(...d.f.map(([, f]) => widen(f))), fc.array(fc.boolean(), { minLength: 3, maxLength: 3 })).map(
          ([fs, loose]): D => ({
            k: "object",
            f: d.f.map(([n, , o], i): [string, D, boolean] => [n, fs[i] ?? { k: "json" }, o || loose[i] === true]),
            closed: d.closed && loose[0] === true,
          }),
        ),
      );
    case "union":
      return fc.oneof(
        same,
        ...extra,
        fc.tuple(widen(d.m[0]), widen(d.m[1])).map(([a, b]): D => ({ k: "union", m: [a, b] })),
      );
    default:
      return fc.oneof(same, ...extra);
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const J = (d: D) => jsonSchemaOf(build(d).node);
const sound = (a: D, b: D): void => {
  if (accepts(J(a), J(b)) !== null) return;
  const target = build(a);
  fc.assert(
    fc.property(gen(build(b)), (v) => target.parse(v).ok),
    { seed: SEED, numRuns: 25 },
  );
};

describe("accepts", () => {
  it("is reflexive on generated schemas", () => {
    fc.assert(
      fc.property(dArb, (d) => {
        expect(accepts(J(d), J(d))).toBeNull();
      }),
      { seed: SEED, numRuns: 300 },
    );
  });

  it("accepts every widening it generates, and stays transitive across two widenings", () => {
    fc.assert(
      fc.property(
        dArb.chain((c) => widen(c).chain((b) => widen(b).map((a) => [a, b, c] as const))),
        ([a, b, c]) => {
          expect(accepts(J(b), J(c))).toBeNull();
          expect(accepts(J(a), J(b))).toBeNull();
          expect(accepts(J(a), J(c))).toBeNull();
        },
      ),
      { seed: SEED, numRuns: 300 },
    );
  });

  it("for generated pairs, when A accepts B, every value gen(B) yields parses with A", () => {
    fc.assert(
      fc.property(dArb, dArb, (a, b) => sound(a, b)),
      { seed: SEED, numRuns: 300 },
    );
    fc.assert(
      fc.property(
        dArb.chain((b) => widen(b).map((a) => [a, b] as const)),
        ([a, b]) => sound(a, b),
      ),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("refuses a body lacking a required field, a narrower enum, an int for a number, and an open object for a closed one", () => {
    const obj = (fields: Record<string, Schema<unknown>>, closed = false) =>
      jsonSchemaOf(s.object(fields, { closed }).node);
    expect(accepts(obj({ name: s.string(), note: s.string() }), obj({ name: s.string() }))).toEqual({
      path: ["note"],
      why: "missing",
    });
    expect(accepts(jsonSchemaOf(s.enum(["a"]).node), jsonSchemaOf(s.enum(["a", "b"]).node))?.why).toBe("value");
    expect(accepts(jsonSchemaOf(s.int().node), jsonSchemaOf(s.number().node))?.why).toBe("type");
    expect(accepts(obj({ a: s.string() }, true), obj({ a: s.string() }))?.why).toBe("open");
    expect(accepts(obj({ a: s.string() }, true), obj({ a: s.string(), b: s.int() }, true))).toEqual({
      path: ["b"],
      why: "extra",
    });
    expect(accepts(jsonSchemaOf(s.string({ max: 3 }).node), jsonSchemaOf(s.string().node))?.why).toBe("bounds");
  });

  it("takes a field an open object lacks only when it accepts any value; a closed object never has it", () => {
    const obj = (fields: Parameters<typeof s.object>[0], closed = false) =>
      jsonSchemaOf(s.object(fields, { closed }).node);
    const optA = obj({ a: s.string().optional() });
    expect(accepts(optA, obj({}))).toEqual({ path: ["a"], why: "open" });
    expect(accepts(optA, obj({}, true))).toBeNull();
    expect(accepts(obj({ a: s.json().optional() }), obj({}))).toBeNull();
    expect(accepts(obj({ a: s.json().nullable().optional() }), obj({}))).toBeNull();
  });

  it("for an open B, a value carrying a key B lacks, of any JSON value, parses with every A that accepts B", () => {
    const open = dArb.filter((d) => d.k === "object" && !d.closed);
    fc.assert(
      fc.property(open, dArb, fc.constantFrom("name", "note", "qty"), fc.jsonValue(), (b, a, k, x) => {
        if (b.k !== "object" || b.f.some(([n]) => n === k) || accepts(J(a), J(b)) !== null) return;
        fc.assert(
          fc.property(gen(build(b)), (v) => build(a).parse(isObj(v) ? { ...v, [k]: x } : v).ok),
          { seed: SEED, numRuns: 10 },
        );
      }),
      { seed: SEED, numRuns: 300 },
    );
  });
});
