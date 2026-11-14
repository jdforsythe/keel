import { manifest } from "@keel/router";
import { matchHref } from "@keel/router/match";
// `tableSearch` either refuses a table whose query could carry personal data (E2852) or builds a search schema whose
// keys are `sort`, `dir`, `page`, `q` and unmarked enum or boolean filters. Seed 1337.
import { type PiiClass, type Schema, piiPaths, s } from "@keel/schema";
import { columns, tableSearch } from "@keel/std-tables";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;
const CLASSES: readonly PiiClass[] = [
  "name",
  "contact",
  "location",
  "identifier",
  "financial",
  "special",
  "network",
  "content",
];
const mark = (schema: Schema<unknown>, cls: PiiClass | undefined): Schema<unknown> =>
  cls === undefined ? schema : schema.pii(cls);
const classArb = fc.option(fc.constantFrom(...CLASSES), { nil: undefined });

describe("tableSearch", () => {
  test("refuses a marked search or filter column, and otherwise exposes only query keys and unmarked filters", () => {
    fc.assert(
      fc.property(classArb, classArb, classArb, fc.boolean(), (title, region, tagged, whole) => {
        const fields = {
          id: s.int({ min: 1 }),
          title: mark(s.string(), title),
          region: mark(s.enum(["n", "s"]), region),
          flag: mark(s.boolean(), tagged),
        };
        const Row = whole ? s.object(fields).pii("content") : s.object(fields);
        const cols = Reflect.apply(columns, undefined, [
          Row,
          {
            key: "id",
            show: ["title", "region", "flag"],
            sort: ["title"],
            search: ["title"],
            filter: ["region", "flag"],
          },
        ]);
        const marked = piiPaths(Row).map((p) => p.path);
        let schema: unknown;
        let thrown: unknown;
        try {
          schema = Reflect.apply(tableSearch, undefined, [cols]);
        } catch (e) {
          thrown = e;
        }
        if (marked.some((p) => p === "title" || p === "region" || p === "flag")) {
          expect(thrown instanceof Error ? thrown.message.slice(0, 5) : thrown).toBe("E2852");
          return;
        }
        expect(thrown).toBeUndefined();
        const node: unknown =
          typeof schema === "object" && schema !== null && "node" in schema ? schema.node : undefined;
        const keys =
          typeof node === "object" &&
          node !== null &&
          "fields" in node &&
          typeof node.fields === "object" &&
          node.fields !== null
            ? Object.keys(node.fields)
            : [];
        expect(keys.sort()).toEqual(["dir", "flag", "page", "q", "region", "sort"]);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  test("one schema per columns value", () => {
    const Row = s.object({ id: s.int(), tag: s.enum(["a"]) });
    const cols = columns(Row, { key: "id", show: ["tag"], filter: ["tag"] });
    expect(tableSearch(cols)).toBe(tableSearch(cols));
    expect(tableSearch(cols).parse({ tag: "a", page: 2 }).ok).toBe(true);
    expect(tableSearch(cols).parse({ q: 1 }).ok).toBe(true); // no `search` columns: `q` is not a query key
  });

  test("a route drops a `sort` outside the sort columns and keeps the rest of the query", () => {
    const Row = s.object({ id: s.int(), title: s.string(), on: s.boolean() });
    const Search = tableSearch(columns(Row, { key: "id", show: ["title", "on"], sort: ["title"], filter: ["on"] }));
    const routes = manifest({
      "t.list": { path: "/t", params: s.object({}), search: Search, component: () => document.createComment("") },
    });
    fc.assert(
      fc.property(fc.constantFrom("on", "id", "bogus", "TITLE", ""), (sort) => {
        const m = matchHref(routes, `/t?sort=${sort}&dir=desc&on=true`);
        expect(m?.search).toEqual({ dir: "desc", on: true });
      }),
      { seed: SEED, numRuns: 20 },
    );
    expect(matchHref(routes, "/t?sort=title")?.search).toEqual({ sort: "title" });
  });
});
