// Spec: std.tables, clause "`columns` derives each kind from the schema and throws E2851 for a `value` column in `sort` without `compare`, a `number` in `search` and an unknown field."
// Seed: 1337.
// std.tables, Rules "E2851 a `columns` entry naming no field or a field of the wrong kind"
// Assumption: `columns` returns no kind table the spec names, so a derived kind is observed through which lists accept it.
import { type Schema, s } from "@keel/schema";
import { columns } from "@keel/std-tables";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, throwsCode } from "./fixtures.ts";

type Kind = "text" | "number" | "enum" | "boolean" | "value";
const Tag = s.format("tag", s.string(), {
  check: (v) => v.length > 0,
  gen: { from: s.string({ min: 1 }), map: (v) => v },
});
const FIELDS: readonly { readonly name: string; readonly kind: Kind; readonly schema: Schema<unknown, boolean> }[] = [
  { name: "string", kind: "text", schema: s.string() },
  { name: "format of a string", kind: "text", schema: Tag },
  { name: "int", kind: "number", schema: s.int() },
  { name: "number", kind: "number", schema: s.number() },
  { name: "enum", kind: "enum", schema: s.enum(["a", "b", "c"]) },
  { name: "boolean", kind: "boolean", schema: s.boolean() },
  { name: "array", kind: "value", schema: s.array(s.string()) },
  { name: "object", kind: "value", schema: s.object({ minor: s.int() }) },
  { name: "json", kind: "value", schema: s.json() },
];
const LISTS = ["key", "search", "filter", "sort"] as const;
type List = (typeof LISTS)[number];

const accepts = (list: List, kind: Kind): boolean => {
  if (list === "key") return kind === "text" || kind === "number";
  if (list === "search") return kind === "text";
  if (list === "filter") return kind === "enum" || kind === "boolean";
  return kind !== "value";
};
/** `columns` over a row of `id` and the field `f`, `f` named in `list` (and shown). Typed loosely: a wrong kind is a type error for the typed call. */
const build = (schema: Schema<unknown, boolean>, list: List, extra: Record<string, unknown> = {}): unknown => {
  const Row = s.object({ id: s.int({ min: 1 }), f: schema });
  const spec = list === "key" ? { key: "f", show: ["f"] } : { key: "id", show: ["f"], [list]: ["f"] };
  return Reflect.apply(columns, undefined, [Row, { ...spec, ...extra }]);
};

describe("std.tables: columns kinds", () => {
  test("`columns` derives each kind from the schema and throws E2851 for a `value` column in `sort` without `compare`, a `number` in `search` and an unknown field", () => {
    fc.assert(
      fc.property(fc.constantFrom(...FIELDS), fc.constantFrom(...LISTS), (field, list) => {
        const code = throwsCode(() => build(field.schema, list));
        expect(code).toBe(accepts(list, field.kind) ? undefined : "E2851");
      }),
      { seed: SEED, numRuns: 150 },
    );
    // the named cases
    const value = FIELDS.find((f) => f.kind === "value");
    const number = FIELDS.find((f) => f.kind === "number");
    if (value === undefined || number === undefined) throw new Error("fixture: kinds missing");
    expect(throwsCode(() => build(value.schema, "sort"))).toBe("E2851");
    expect(throwsCode(() => build(value.schema, "sort", { compare: { f: () => 0 } }))).toBeUndefined();
    expect(throwsCode(() => build(number.schema, "search"))).toBe("E2851");
    expect(throwsCode(() => build(number.schema, "sort"))).toBeUndefined();
  });

  test("E2851 a `columns` entry naming no field or a field of the wrong kind", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z]{3,8}$/).map((name) => `x_${name}`),
        fc.constantFrom("key", "show", "rowHeader", "sort", "search", "filter"),
        (name, list) => {
          const Row = s.object({ id: s.int({ min: 1 }), f: s.string() });
          const base = { key: "id", show: ["f"] };
          const spec =
            list === "key" ? { ...base, key: name } : { ...base, [list]: list === "rowHeader" ? name : [name] };
          expect(throwsCode(() => Reflect.apply(columns, undefined, [Row, spec]))).toBe("E2851");
        },
      ),
      { seed: SEED, numRuns: 100 },
    );
  });
});
