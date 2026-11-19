// `columns` over generated `s.object` schemas either throws E2851 or derives one kind per field. Seed 1337.
import { type Schema, s } from "@keel/schema";
import { type ColumnKind, columns } from "@keel/std-tables";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;
const POOL: readonly { readonly kind: ColumnKind; readonly schema: Schema<unknown, boolean> }[] = [
  { kind: "text", schema: s.string() },
  { kind: "text", schema: s.id("thing") },
  {
    kind: "text",
    schema: s.format("slug", s.string(), {
      check: (v) => v.length > 0,
      gen: { from: s.string({ min: 1 }), map: (v) => v },
    }),
  },
  { kind: "number", schema: s.int() },
  { kind: "number", schema: s.number({ min: 0 }) },
  { kind: "enum", schema: s.enum(["x", "y"]) },
  { kind: "boolean", schema: s.boolean() },
  { kind: "value", schema: s.array(s.int()) },
  { kind: "value", schema: s.object({ minor: s.int() }) },
  { kind: "value", schema: s.string().optional() },
  { kind: "value", schema: s.literal("a") },
  {
    kind: "value",
    schema: s.format("n", s.int(), { check: (v) => v > 0, gen: { from: s.int({ min: 1 }), map: (v) => v } }),
  },
];
const NAMES = ["a", "b", "c", "d", "e"] as const;

const ACCEPTS: Readonly<Record<string, readonly ColumnKind[]>> = {
  key: ["text", "number"],
  search: ["text"],
  filter: ["enum", "boolean"],
};

const rowArb = fc
  .uniqueArray(fc.constantFrom(...NAMES), { minLength: 1, maxLength: NAMES.length })
  .chain((names) =>
    fc.tuple(
      fc.constant(names),
      fc.array(fc.constantFrom(...POOL), { minLength: names.length, maxLength: names.length }),
    ),
  );
const listArb = fc.subarray([...NAMES, "zz"]);

describe("columns", () => {
  test("throws E2851 exactly when an entry names no field or a field of the wrong kind; else one kind per field", () => {
    fc.assert(
      fc.property(
        rowArb,
        fc.constantFrom(...NAMES),
        listArb,
        listArb,
        listArb,
        listArb,
        (row, key, sort, search, filter, show) => {
          const [names, picks] = row;
          const kinds = new Map<string, ColumnKind>(names.map((n, i) => [n, picks[i]?.kind ?? "value"]));
          const Row = s.object(Object.fromEntries(names.map((n, i) => [n, picks[i]?.schema ?? s.json()])));
          const spec = { key, show: show.length === 0 ? [key] : show, sort, search, filter };
          const fits = (list: string, xs: readonly string[]): boolean =>
            xs.every((x) => {
              const k = kinds.get(x);
              return k !== undefined && (ACCEPTS[list]?.includes(k) ?? k !== "value");
            });
          const known = (xs: readonly string[]): boolean => xs.every((x) => kinds.has(x));
          const valid =
            fits("key", [key]) &&
            known(spec.show) &&
            fits("sort", sort) &&
            fits("search", search) &&
            fits("filter", filter);
          let thrown: unknown;
          let out: unknown;
          try {
            out = Reflect.apply(columns, undefined, [Row, spec]);
          } catch (e) {
            thrown = e;
          }
          if (!valid) {
            expect(thrown instanceof Error ? thrown.message.slice(0, 5) : thrown).toBe("E2851");
            return;
          }
          expect(thrown).toBeUndefined();
          const got: unknown = typeof out === "object" && out !== null && "kinds" in out ? out.kinds : undefined;
          expect(got).toEqual(Object.fromEntries(kinds));
        },
      ),
      { seed: SEED, numRuns: 400 },
    );
  });

  test("a value column sorts only with compare, and compare naming no field is E2851", () => {
    const Row = s.object({ id: s.int(), price: s.object({ minor: s.int() }) });
    expect(() => columns(Row, { key: "id", show: ["price"], sort: ["price"] })).toThrow(
      /^E2851 price is a value column/,
    );
    const ok = columns(Row, {
      key: "id",
      show: ["price"],
      sort: ["price"],
      compare: { price: (a, b) => a.minor - b.minor },
    });
    expect(ok.compare.price?.({ id: 1, price: { minor: 2 } }, { id: 2, price: { minor: 5 } })).toBeLessThan(0);
    expect(() =>
      Reflect.apply(columns, undefined, [Row, { key: "id", show: ["id"], compare: { nope: () => 0 } }]),
    ).toThrow(/^E2851/);
    expect(() => Reflect.apply(columns, undefined, [Row, { key: "id", show: ["id"], rowHeader: "price" }])).toThrow(
      /^E2851 rowHeader price is not in show/,
    );
  });
});
