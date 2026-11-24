// Spec: k.compat, clause "For generated pairs of schemas, when `A` accepts `B`, every value `gen(B)` yields parses with `A`."
// Seed 1337. `accepts` is not exported, so it is observed through E1562: the base entry's `body` is `B`, the current entry's is `A`, the caller in
// another deployable; no E1562 means the check decided `A` accepts `B` (k.compat Base). Each run is a batch of pairs, one entry `y.add<i>` per pair in
// one project (`projectMany`), so a run is two builds and one check whatever its size.
// Schemas: s.string(), s.number(), s.enum([...]), s.array(x), s.object({...}), x.optional(), x.nullable(); the top level is an
// object (an action's `input` is an object schema). Only the entry's `body` differs between base and current.
// `gen(B)` values of an open object carry extra keys of any type (k.compat Accepts: a field an open `B` lacks is accepted only if `A`'s field accepts any value).
import { type Schema, s } from "@keel/schema";
import fc from "fast-check";
import { afterAll, expect, test } from "vitest";
import { SEED, baseSurface, buildAndCheck, cleanup, diags, e1562Of, projectMany, write } from "./compat-support.ts";

/** A run spawns two `keel build` and one `keel check`. */
const SLOW = 120_000;
/** Pairs per run: six pairs drawn from the same arbitraries, judged in one project. */
const PAIRS = 6;

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
/**
 * The E1562 records of the whole run, and for each pair `[A, B]` those of the entry whose base `body` is `B` and current `body` is `A`.
 * The per-entry counts add up to the run's total: no E1562 goes unattributed to a pair.
 */
const e1562 = (pairs: readonly (readonly [D, D])[]): { total: number; each: number[] } => {
  const base = baseSurface(projectMany({ bodies: pairs.map(([, b]) => src(b)) }));
  dirs.push(base.dir);
  write(base.dir, projectMany({ bodies: pairs.map(([a]) => src(a)) }));
  const run = buildAndCheck(base.dir, base.base);
  const each = pairs.map((_, i) => e1562Of(run, `y.add${i}`).length);
  const total = diags(run, "E1562").length;
  expect(each.reduce((x, y) => x + y, 0)).toBe(total);
  return { total, each };
};

test(
  "For generated pairs of schemas, when `A` accepts `B`, every value `gen(B)` yields parses with `A`.",
  () => {
    let accepted = 0;
    const pair = fc.oneof(
      fc.tuple(objArb, objArb),
      objArb.map((b): [D, D] => [widen(b), b]),
    );
    fc.assert(
      fc.property(fc.array(pair, { minLength: PAIRS, maxLength: PAIRS }), (pairs) => {
        const found = e1562(pairs).each;
        pairs.forEach(([a, b], i) => {
          if ((found[i] ?? 0) > 0) return;
          accepted++;
          const target = build(a);
          fc.assert(
            fc.property(gen(b), (v) => target.parse(v).ok),
            { seed: SEED, numRuns: 20 },
          );
        });
      }),
      { seed: SEED, numRuns: 1 },
    );
    expect(accepted).toBeGreaterThan(0);
  },
  SLOW,
);

test(
  "a widening of `B` is accepted: no E1562 for A = widen(B)",
  () => {
    fc.assert(
      fc.property(fc.array(objArb, { minLength: PAIRS, maxLength: PAIRS }), (bs) => {
        const found = e1562(bs.map((b): [D, D] => [widen(b), b]));
        expect(found.each).toEqual(bs.map(() => 0));
        expect(found.total).toBe(0);
      }),
      { seed: SEED, numRuns: 1 },
    );
  },
  SLOW,
);
