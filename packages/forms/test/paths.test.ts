// @vitest-environment happy-dom
// fast-check seed: 1337
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import fc from "fast-check";
import { expect, expectTypeOf, it } from "vitest";
import { type Field, type FieldPath, type PathValue, form } from "../src/index.ts";

const Order = s.object({
  note: s.string(),
  qty: s.int().optional(),
  address: s.object({ city: s.string(), zip: s.string().nullable() }),
  tags: s.array(s.string()),
  lines: s.array(s.object({ sku: s.id("Sku"), n: s.int() })),
});
type Order = s.infer<typeof Order>;

it("FieldPath is the union of dotted paths; PathValue resolves each", () => {
  expectTypeOf<FieldPath<Order>>().toEqualTypeOf<
    | "note"
    | "qty"
    | "address"
    | "address.city"
    | "address.zip"
    | "tags"
    | `tags.${number}`
    | "lines"
    | `lines.${number}`
    | `lines.${number}.sku`
    | `lines.${number}.n`
  >();
  expectTypeOf<PathValue<Order, "qty">>().toEqualTypeOf<number>();
  expectTypeOf<PathValue<Order, "address.zip">>().toEqualTypeOf<string | null>();
  expectTypeOf<PathValue<Order, "lines.3.n">>().toEqualTypeOf<number>();
  expectTypeOf<PathValue<Order, "tags.0">>().toEqualTypeOf<string>();
});

it("field() is typed by literal path; a computed string is accepted and checked at runtime", () => {
  scope(() => {
    const f = form(Order);
    expectTypeOf(f.field("address.city")).toEqualTypeOf<Field<string>>();
    expectTypeOf(f.field("lines.0.n")).toEqualTypeOf<Field<number>>();
    // A literal path outside FieldPath<Order> resolves the parameter to never (compile error); runtime is E1902.
    expectTypeOf<"address.street">().not.toMatchTypeOf<FieldPath<Order>>();
    const street: string = "address.street";
    expect(() => f.field(street)).toThrow(/E1902/);
    const dynamic: string = "note";
    expectTypeOf(f.field(dynamic)).toEqualTypeOf<Field<unknown>>();
  }).dispose();
});

it("E1902 for every generated path not in the schema; none for paths that are", () => {
  scope(() => {
    const f = form(Order);
    const loose: (path: string) => unknown = f.field;
    const good = [
      "note",
      "qty",
      "address",
      "address.city",
      "address.zip",
      "tags",
      "tags.0",
      "lines.2.sku",
      "lines.10.n",
    ];
    for (const p of good) expect(() => loose(p)).not.toThrow();
    fc.assert(
      fc.property(
        fc.oneof(
          fc.stringMatching(/^[a-z]{1,8}(\.[a-z0-9]{1,8}){0,2}$/),
          fc.constantFrom("", "tags.x", "tags.-1", "tags.01", "lines.0", "lines.0.qty", "note.x", "address."),
        ),
        (p) => {
          fc.pre(!good.includes(p) && p !== "lines.0");
          let code: unknown;
          try {
            loose(p);
          } catch (e) {
            code = typeof e === "object" && e !== null && "code" in e ? e.code : undefined;
          }
          expect(code).toBe("E1902");
        },
      ),
      { seed: 1337, numRuns: 200 },
    );
  }).dispose();
});
