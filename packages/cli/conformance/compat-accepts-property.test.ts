// Spec: k.compat, clause "For generated pairs of schemas, when `A` accepts `B`, every value `gen(B)` yields parses with `A`."
// Seed 1337. `accepts` is not exported, so it is observed through E1561: the route's action input is `A`, the endpoint's body is `B`;
// no E1561 means the check decided `A` accepts `B`. Slow (a project build per run), so numRuns is small.
// Schemas: s.string(), s.number(), s.enum([...]), s.array(x), s.object({...}), x.optional(), x.nullable(); the top level is an
// object (an action's `input` is an object schema). The endpoint's `output` is the action's answer, so only the request decides.
// `gen(B)` values of an open object carry extra keys of any type (k.compat Accepts: a field an open `B` lacks is accepted only if `A`'s field accepts any value).
import { type Schema, s } from "@keel/schema";
import fc from "fast-check";
import { afterAll, expect, test } from "vitest";
import { SEED, buildAndCheck, cleanup, diags, materialize, project } from "./compat-support.ts";

/** Property runs spawn several `keel build` and `keel check` processes each. */
const SLOW = 120_000;

type D =
  | { k: "string" }
  | { k: "number" }
  | { k: "enum"; v: [string, ...string[]] }
  | { k: "array"; of: D }
  | { k: "nullable"; of: D }
  | { k: "object"; f: Record<string, D>; opt: string[] };

const leaf: fc.Arbitrary<D> = fc.oneof(
  fc.constant<D>({ k: "string" }),
  fc.constant<D>({ k: "number" }),
  fc
    .uniqueArray(fc.constantFrom("p", "q", "r", "t"), { minLength: 1, maxLength: 3 })
    .map((v): D => ({ k: "enum", v: [v[0] ?? "p", ...v.slice(1)] })),
);
const dArb: fc.Arbitrary<D> = fc.letrec<{ d: D }>((tie) => ({
  d: fc.oneof(
    { depthSize: "small", maxDepth: 2 },
    leaf,
    tie("d").map((of): D => ({ k: "array", of })),
    tie("d").map((of): D => ({ k: "nullable", of })),
    fc
      .uniqueArray(fc.tuple(fc.constantFrom("name", "note", "qty"), tie("d"), fc.boolean()), {
        selector: (t) => t[0],
        maxLength: 3,
      })
      .map(
        (fs): D => ({
          k: "object",
          f: Object.fromEntries(fs.map(([n, d]) => [n, d])),
          opt: fs.filter((t) => t[2]).map((t) => t[0]),
        }),
      ),
  ),
})).d;

const src = (d: D): string => {
  switch (d.k) {
    case "string":
      return "s.string()";
    case "number":
      return "s.number()";
    case "enum":
      return `s.enum([${d.v.map((x) => `'${x}'`).join(", ")}])`;
    case "array":
      return `s.array(${src(d.of)})`;
    case "nullable":
      return `${src(d.of)}.nullable()`;
    case "object":
      return `s.object({ ${Object.entries(d.f)
        .map(([n, f]) => `${n}: ${src(f)}${d.opt.includes(n) ? ".optional()" : ""}`)
        .join(", ")} })`;
  }
};

const build = (d: D): Schema<unknown> => {
  switch (d.k) {
    case "string":
      return s.string();
    case "number":
      return s.number();
    case "enum":
      return s.enum(d.v);
    case "array":
      return s.array(build(d.of));
    case "nullable":
      return build(d.of).nullable();
    case "object":
      return s.object(
        Object.fromEntries(
          Object.entries(d.f).map(([n, f]) => [n, d.opt.includes(n) ? build(f).optional() : build(f)]),
        ),
      );
  }
};

const gen = (d: D): fc.Arbitrary<unknown> => {
  switch (d.k) {
    case "string":
      return fc.string({ maxLength: 6 });
    case "number":
      return fc.integer({ min: -9, max: 9 });
    case "enum":
      return fc.constantFrom(...d.v);
    case "array":
      return fc.array(gen(d.of), { maxLength: 3 });
    case "nullable":
      return fc.oneof(fc.constant(null), gen(d.of));
    case "object": {
      const req: Record<string, fc.Arbitrary<unknown>> = {};
      for (const [n, f] of Object.entries(d.f)) req[n] = gen(f);
      // `B` is open: a value of it may carry keys it does not declare, of any type, including names `A` declares.
      const extra = fc
        .dictionary(fc.constantFrom("name", "note", "qty", "zz"), fc.anything(), { maxKeys: 3 })
        .map((e) => Object.fromEntries(Object.entries(e).filter(([n]) => !(n in d.f))));
      return fc
        .tuple(fc.record(req, { requiredKeys: Object.keys(d.f).filter((n) => !d.opt.includes(n)) }), extra)
        .map(([own, more]) => ({ ...more, ...own }));
    }
  }
};

// A widening of `d` that must be accepted: enums gain a value, objects gain an optional field, nullable wraps.
const widen = (d: D): D => {
  switch (d.k) {
    case "enum":
      return { k: "enum", v: [d.v[0], ...d.v.slice(1), "zz"] };
    case "array":
      return { k: "array", of: widen(d.of) };
    case "nullable":
      return { k: "nullable", of: widen(d.of) };
    case "object":
      return { k: "object", f: Object.fromEntries(Object.entries(d.f).map(([n, f]) => [n, widen(f)])), opt: d.opt };
    default:
      return { k: "nullable", of: d };
  }
};

/** A top-level object of generated fields (an action input). */
const objArb: fc.Arbitrary<D> = fc
  .uniqueArray(fc.tuple(fc.constantFrom("name", "note", "qty"), dArb, fc.boolean()), {
    selector: (t) => t[0],
    maxLength: 3,
  })
  .map(
    (fs): D => ({
      k: "object",
      f: Object.fromEntries(fs.map(([n, d]) => [n, d])),
      opt: fs.filter((t) => t[2]).map((t) => t[0]),
    }),
  );

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});
const e1561 = (a: D, b: D): number => {
  const dir = materialize(project({ input: src(a), body: src(b), split: false }));
  dirs.push(dir);
  return diags(buildAndCheck(dir), "E1561").length;
};

test(
  "For generated pairs of schemas, when `A` accepts `B`, every value `gen(B)` yields parses with `A`.",
  () => {
    let accepted = 0;
    const pairs = fc.oneof(
      fc.tuple(objArb, objArb),
      objArb.map((b): [D, D] => [widen(b), b]),
    );
    fc.assert(
      fc.property(pairs, ([a, b]) => {
        if (e1561(a, b) > 0) return;
        accepted++;
        const target = build(a);
        fc.assert(
          fc.property(gen(b), (v) => target.parse(v).ok),
          { seed: SEED, numRuns: 20 },
        );
      }),
      { seed: SEED, numRuns: 6 },
    );
    expect(accepted).toBeGreaterThan(0);
  },
  SLOW,
);

test(
  "a widening of `B` is accepted: no E1561 for A = widen(B)",
  () => {
    fc.assert(
      fc.property(objArb, (b) => {
        expect(e1561(widen(b), b)).toBe(0);
      }),
      { seed: SEED, numRuns: 6 },
    );
  },
  SLOW,
);
