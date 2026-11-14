// Spec: std.tables, Conformance "`tableSearch` parses `{}` and drops a `sort` outside `sort` columns (k.router); E2852 fires for a filter named `page` and a `.pii()` search column."
// Seed: 1337.
// @vitest-environment happy-dom
// Spec: std.tables, Rules "E2852 a filter column with a reserved name, or a `.pii()` `search` or `filter` column"
// Assumption: E2852 is thrown by `columns` or by `tableSearch` over it; both calls sit inside the asserted thunk.
import { s } from "@keel/schema";
import { columns, tableSearch } from "@keel/std-tables";
import { renderRoute } from "@keel/testing";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, Search, routes, simCtx, throwsCode } from "./fixtures.ts";

const PII_CLASSES = [
  "name",
  "contact",
  "location",
  "identifier",
  "financial",
  "special",
  "network",
  "content",
] as const;

/** `tableSearch(columns(Row, spec))` untyped, so a reserved name or a marked column reaches the rule. */
const search = (Row: unknown, spec: unknown): unknown =>
  Reflect.apply(tableSearch, undefined, [Reflect.apply(columns, undefined, [Row, spec])]);

describe("std.tables: tableSearch", () => {
  test.skip("`tableSearch` parses `{}` and drops a `sort` outside `sort` columns (k.router); E2852 fires for a filter named `page` and a `.pii()` search column", async () => {
    const parsed = Search.parse({});
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value).toEqual({});

    // `favorite` and `currency` are shown or filter columns, not `sort` columns: the route drops the key and keeps the rest.
    await fc.assert(
      fc.asyncProperty(fc.constantFrom("favorite", "currency", "id", "bogus", "PRICE", ""), async (sort) => {
        const h = await renderRoute("tbl.server", { routes, params: {}, search: { sort, dir: "desc" }, ctx: simCtx() });
        expect(h.route()).toEqual({ id: "tbl.server", params: {}, search: { dir: "desc" }, pending: false });
        h.dispose();
      }),
      { seed: SEED, numRuns: 12 },
    );
    const kept = await renderRoute("tbl.server", { routes, params: {}, search: { sort: "price" }, ctx: simCtx() });
    expect(kept.route()).toEqual({ id: "tbl.server", params: {}, search: { sort: "price" }, pending: false });
    kept.dispose();

    const Row = s.object({ id: s.int({ min: 1 }), page: s.enum(["a", "b"]), name: s.string().pii("name") });
    expect(throwsCode(() => search(Row, { key: "id", show: ["page"], filter: ["page"] }))).toBe("E2852");
    expect(throwsCode(() => search(Row, { key: "id", show: ["name"], search: ["name"] }))).toBe("E2852");
  });

  test("E2852 a filter column with a reserved name, or a `.pii()` `search` or `filter` column", () => {
    // a filter column named sort, dir, page or q, of either filterable kind
    fc.assert(
      fc.property(
        fc.constantFrom("sort", "dir", "page", "q"),
        fc.constantFrom(s.enum(["a", "b"]), s.boolean()),
        (name, schema) => {
          const Row = s.object({ id: s.int({ min: 1 }), [name]: schema });
          expect(throwsCode(() => search(Row, { key: "id", show: [name], filter: [name] }))).toBe("E2852");
        },
      ),
      { seed: SEED, numRuns: 100 },
    );
    // a `.pii()` filter column, whatever its class
    fc.assert(
      fc.property(fc.constantFrom(...PII_CLASSES), fc.constantFrom(s.enum(["a", "b"]), s.boolean()), (cls, base) => {
        const Row = s.object({ id: s.int({ min: 1 }), region: base.pii(cls) });
        expect(throwsCode(() => search(Row, { key: "id", show: ["region"], filter: ["region"] }))).toBe("E2852");
      }),
      { seed: SEED, numRuns: 100 },
    );
    // a `.pii()` search column
    const Person = s.object({ id: s.int({ min: 1 }), email: s.string().pii("contact") });
    expect(throwsCode(() => search(Person, { key: "id", show: ["email"], search: ["email"] }))).toBe("E2852");
    // the same shapes unmarked and unreserved are fine
    const Plain = s.object({ id: s.int({ min: 1 }), email: s.string(), region: s.enum(["a", "b"]) });
    expect(
      throwsCode(() => search(Plain, { key: "id", show: ["email"], search: ["email"], filter: ["region"] })),
    ).toBeUndefined();
  });
});
